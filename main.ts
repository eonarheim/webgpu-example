console.log('Hello WebGPU');

import swordPNG from './icon.png';

function createQuad(x: number, y: number, width: number, height: number) {
    // clip space
    const vertices = new Float32Array([
        // x, y 
        // triangle 1
        x + 0.0, y + 0.0,
        x + width, y + 0.0,
        x + 0.0, y + height,

        // triangle 2
        x + 0.0,y + height,
        x + width, y + 0.0,
        x + width, y + height
    ]);

    return vertices;
}

async function main() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();

    if (!device) {
        throw new Error("Error no WebGPU");
        return;
    }

    const canvas = document.getElementById('game') as HTMLCanvasElement;
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext('webgpu');

    // rgba8unorm or bgra8unorm
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context?.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
    });

    function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number) {
        return new Float32Array([
            2 / (right - left), 0, 0, 0,
            0, 2 / (top - bottom), 0, 0,
            0, 0, 2 / (near - far), 0,
        
            (left + right) / (left - right),
            (bottom + top) / (bottom - top),
            (near + far) / (near - far),
            1,
        ]);
    }

    // uniform buffer

    const matrixBuffer = device.createBuffer({
        size: 4 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const orthMatrix =  ortho(
        0,
        canvas.clientWidth,
        canvas.clientHeight,
        0,
        -10,
        10
    );

    device.queue.writeBuffer(matrixBuffer, 0, orthMatrix);

    // load texture image
    const img = document.createElement('img');
    img.src = swordPNG;

    await img.decode();
    const bitmap = await createImageBitmap(img);

    const swordTexture = device.createTexture({
        size: [bitmap.width, bitmap.height, 1],
        format: presentationFormat,
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    device.queue.copyExternalImageToTexture(
        { source: bitmap, flipY: false },
        { texture: swordTexture },
        [bitmap.width, bitmap.height]
    )

    let swordX = 0;
    let swordY = 100;
    let swordVelX = 100; // pixels/sec

    // geometry
    let vertices = createQuad(swordX, swordY, 100, 100);
    
    // uv
    const uv = new Float32Array([
        // triangle 1
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,

        // triangle 2
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0
    ]);

    // Create a handle for the vertex buffer
    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });


    
    
    // Create a handle for the uv
    const uvBuffer = device.createBuffer({
        size: uv.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(uvBuffer, 0, uv, 0, uv.length);


    // create vertex & fragment
    const shader = device.createShaderModule({
        label: 'Shader Code',
        code: `
        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) uv: vec2f,
        };

        @group(0) @binding(2) var<uniform> matrix: mat4x4<f32>;
        @vertex fn vertex(
            @location(0) position: vec2f,
            @location(1) uv: vec2f
        ) -> VertexOutput {
            var output: VertexOutput;
            output.position = matrix * vec4f(position, 0.0, 1.0);
            output.uv = uv;
            return output;
        }

        @group(0) @binding(0) var ourSampler: sampler;
        @group(0) @binding(1) var ourTexture: texture_2d<f32>;
        @fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
            return textureSample(ourTexture, ourSampler, input.uv);
        }
        
        `
    })

    // create pipeline
    const pipeline = device.createRenderPipeline({
        label: 'Our sick triangle rendering',
        layout: 'auto',
        vertex: {
            module: shader,
            entryPoint: 'vertex',
            buffers: [
                {
                    arrayStride: 4 * 2, // 4 bytes per float * 2 floats in a vec2f
                    attributes: [
                        { 
                            format: 'float32x2', // https://gpuweb.github.io/gpuweb/#enumdef-gpuvertexformat
                            offset: 0,
                            shaderLocation: 0
                        }
                    ]
                },
                {
                    arrayStride: 4 * 2, // 4 bytes per float * 2 floats in a vec2f
                    attributes: [
                        { 
                            format: 'float32x2', // https://gpuweb.github.io/gpuweb/#enumdef-gpuvertexformat
                            offset: 0,
                            shaderLocation: 1
                        }
                    ]
                }
            ],
        },
        fragment: {
            module: shader,
            entryPoint: 'fragment',
            targets: [
                { 
                    format: presentationFormat,
                    blend: {
                        color: {
                            operation: 'add',
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha'
                        },
                        alpha: {
                            operation: 'add',
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha'
                        }
                    }
                }
            ]
        }
    });

    const sampler = device.createSampler({
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        magFilter: 'nearest',
        minFilter: 'nearest'
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: swordTexture.createView() },
            { binding: 2, resource: { buffer: matrixBuffer } }
        ]
    })

    function update(elapsedMs: number) {
        const seconds = elapsedMs / 1000;

        swordX += swordVelX * seconds; // 1 pixel to the right every frame
        vertices = createQuad(swordX, swordY, 100, 100);

        // Actually need to fill the vertex buffer in the gpu with our data
        device!.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);
    }

    function draw() {
        const commandEncoder = device!.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass({
            label: 'Awesome render pass',
            colorAttachments: [
                {
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                    view: context!.getCurrentTexture().createView()
                }
            ]
        });

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setVertexBuffer(1, uvBuffer);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6);
        renderPass.end();

        device!.queue.submit([commandEncoder.finish()]);
    }

    let lastTime = performance.now();
    function mainloop(time: number) {
        requestAnimationFrame(mainloop);
        const now = time;
        const elapsedMs = now - lastTime;
        update(elapsedMs);
        draw();
        lastTime = now;
    }

    mainloop(performance.now());
}

main();