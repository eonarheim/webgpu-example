

export class Screen {
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public matrix!: Float32Array;
    public presentationFormat!: GPUTextureFormat;
    constructor(public width: number, public height: number) {
        this.matrix = this.ortho(
            0,
            width,
            height,
            0,
            -10,
            10
        );
    }

    private ortho(left: number, right: number, bottom: number, top: number, near: number, far: number) {
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

    async init() {
        const adapter = await navigator.gpu?.requestAdapter();
        const device = await adapter?.requestDevice();
        if (!device) {
            throw new Error("Error no WebGPU");
            return;
        }
        this.device = device;
        const canvas = document.getElementById('game') as HTMLCanvasElement;
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('webgpu') as GPUCanvasContext;
    
        // rgba8unorm or bgra8unorm
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context?.configure({
            device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
        });
    }
}