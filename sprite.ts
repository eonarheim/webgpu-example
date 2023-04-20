import { Texture } from "./texture";
import { Screen } from "./screen";

function createQuad(x: number, y: number, width: number, height: number) {
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

export class Sprite {
    x: number = 0;
    y: number = 0;
    velX: number = 0;
    velY: number = 0;
    width: number = 100;
    height: number = 100;

    public quad = createQuad(this.x, this.y, this.width, this.height);

    public uv = new Float32Array([
        // triangle 1
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,

        // triangle 2
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0
    ]);
    public vertexBuffer: GPUBuffer;
    public uvBuffer: GPUBuffer;

    constructor(texture: Texture, screen: Screen) {
        this.width = texture.tex.width;
        this.height = texture.tex.height;
        this.vertexBuffer = screen.device.createBuffer({
            size: this.quad.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        this.uvBuffer = screen.device.createBuffer({
            size: this.uv.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
    }

    update(elapsedMs: number) {
        const seconds = elapsedMs / 1000;

        this.x += this.velX * seconds; // 1 pixel to the right every frame
        this.y += this.velY * seconds; // 1 pixel to the right every frame
        this.quad = createQuad(this.x, this.y, this.width, this.height);
    }

}