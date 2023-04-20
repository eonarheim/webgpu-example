import { Screen } from './screen';
import swordPNG from './icon.png';
import { Texture } from './texture';
import { Sprite } from './sprite';

async function main() {
    const screen = new Screen(600, 400);
    await screen.init();

    const device = screen.device;

    // uniform buffer
    const matrixBuffer = device.createBuffer({
        size: 4 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(matrixBuffer, 0, screen.matrix);

    // load texture image
    const swordTexture = new Texture(swordPNG);
    await swordTexture.load(screen);

    // sword sprite

    const sprite = new Sprite(swordTexture, screen);
    sprite.velX = 100; // pixels/sec

    const sprite2 = new Sprite(swordTexture, screen);
    sprite2.x = 600;
    sprite2.velX = -100;

    const sprites = [sprite, sprite2];

    function randomNumber(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    for (let i = 0; i < 1000; i++) {
        const sprite = new Sprite(swordTexture, screen);
        sprite.x = Math.random() * 600;
        sprite.y = Math.random() * 400;
        sprite.velX = randomNumber(-100, 100);
        sprite.velY = randomNumber(-100, 100);
        sprites.push(sprite);
    }


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
                    format: screen.presentationFormat,
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
            { binding: 1, resource: swordTexture.tex.createView() },
            { binding: 2, resource: { buffer: matrixBuffer } }
        ]
    })

    function update(elapsedMs: number) {
        for (let sprite of sprites) {
            sprite.update(elapsedMs);
        }
    }

    function draw() {
        const commandEncoder = device!.createCommandEncoder();
        const clearPass = commandEncoder.beginRenderPass({
            label: 'Awesome render pass',
            colorAttachments: [
                {
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                    view: screen.context!.getCurrentTexture().createView()
                }
            ]
        });
        clearPass.end();
        // const commandEncoder = device!.createCommandEncoder();
        for (let sprite of sprites) {
            // Actually need to fill the vertex & uv buffer in the gpu with our data
            device!.queue.writeBuffer(sprite.uvBuffer, 0, sprite.uv, 0, sprite.uv.length);
            device!.queue.writeBuffer(sprite.vertexBuffer, 0, sprite.quad, 0, sprite.quad.length);

            const renderPass = commandEncoder.beginRenderPass({
                label: 'Awesome render pass',
                colorAttachments: [
                    {
                        loadOp: 'load',
                        storeOp: 'store',
                        view: screen.context!.getCurrentTexture().createView()
                    }
                ]
            });

            renderPass.setPipeline(pipeline);
            renderPass.setVertexBuffer(0, sprite.vertexBuffer);
            renderPass.setVertexBuffer(1, sprite.uvBuffer);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.draw(6);
            renderPass.end();
        }
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