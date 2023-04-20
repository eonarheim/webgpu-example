import { Screen } from "./screen";

export class Texture {
    public tex!: GPUTexture;
    constructor(public imgPath: string) {}

    async load(screen: Screen) {
        // load texture image
        const img = document.createElement('img');
        img.src = this.imgPath;
        await img.decode();
        const bitmap = await createImageBitmap(img);

        this.tex = screen.device.createTexture({
            size: [bitmap.width, bitmap.height, 1],
            format: screen.presentationFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });

        screen.device.queue.copyExternalImageToTexture(
            { source: bitmap, flipY: false },
            { texture: this.tex },
            [bitmap.width, bitmap.height]
        )
    }
}