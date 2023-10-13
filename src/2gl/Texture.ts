import { GLContext } from './types';

/**
 * Текстуры используются для отрисовки изображений в WebGL
 */
export class Texture {
    public static readonly ClampToEdgeWrapping = 8;
    public static readonly Repeat = 9;
    public static readonly MirroredRepeat = 10;

    public static readonly NearestFilter = 1;
    public static readonly NearestMipMapNearestFilter = 2;
    public static readonly NearestMipMapLinearFilter = 3;
    public static readonly LinearFilter = 4;
    public static readonly LinearMipMapNearestFilter = 5;
    public static readonly LinearMipMapLinearFilter = 6;

    public static readonly DepthComponentFormat = 7;
    public static readonly RgbaFormat = 11;
    public static readonly AlphaFormat = 12;
    public static readonly RgbFormat = 13;

    public static readonly UnsignedByte = 14;
    public static readonly Float = 15;
    public static readonly UnsignedInt = 16;

    public static readonly RedFormat = 17;

    public static readonly defaultOptions: TextureOptions = {
        magFilter: Texture.LinearFilter,
        minFilter: Texture.LinearMipMapLinearFilter,
        wrapS: Texture.ClampToEdgeWrapping,
        wrapT: Texture.ClampToEdgeWrapping,
        format: Texture.RgbaFormat,
        generateMipmaps: true,
        flipY: true,
        premultiplyAlpha: true,
        type: Texture.UnsignedByte,
    };

    /**
     * Параметры для связывания текстуры
     */
    public readonly options: TextureOptions;

    private _src: TexImageSource | ArrayBufferView | null = null;

    /**
     * Контекст WebGL, в котором была инициализирована текстура.
     * Используется только для удаления, подумать хорошо, прежде чем использовать для чего-то ещё.
     * @ignore
     */
    private _glContext: GLContext | null = null;
    private _texture: WebGLTexture | null = null;

    /**
     * @param {TexImageSource} [src=null] В качестве
     * изображения может быть либо элемент img, либо canvas
     * @param {?TextureOptions} options
     */
    constructor(
        src: TexImageSource | ArrayBufferView | null = null,
        options: TextureOptions | Record<string, unknown> = {},
    ) {
        this._src = src;
        this.options = Object.assign({}, Texture.defaultOptions, options);
    }

    /**
     * Связывает WebGL и данные текстуры.
     * При первом вызов происходит инициализация.
     *
     * @param {WebGLRenderingContext} gl
     * @param {?Number} index Номер текстуры в контексте WebGL.
     * Если его нет, используется уже активированный юнит текстуры.
     */
    public enable(gl: GLContext, index?: number) {
        const unit = index ?? this.options.unit;

        if (unit !== undefined) {
            gl.activeTexture(gl.TEXTURE0 + unit);
        }

        if (!this._texture) {
            this.prepare(gl);
        }

        gl.bindTexture(gl.TEXTURE_2D, this._texture);

        return this;
    }

    /**
     * Удаляет текстуру из видеокарты
     */
    public remove() {
        if (this._texture && this._glContext) {
            this._glContext.deleteTexture(this._texture);
            this._glContext = null;
            this._texture = null;
        }

        return this;
    }

    /**
     * Возвращает WebGL текстуру
     * @return {WebGLTexture}
     */
    public getTexture() {
        return this._texture;
    }

    /**
     * Обновляет часть текстуры
     *
     * @param {WebGLRenderingContext} gl
     * @param {HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData | TypedArray} src
     * @param {number} x Горизонтальное смещение, с которого записываем в текстуру
     * @param {number} y Вертикальное смещение, с которого записываем в текстуру
     */
    public subImage(gl: GLContext, src: TexImageSource, x: number, y: number) {
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.options.flipY);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.options.premultiplyAlpha);
        const format = this._toGlParam(gl, this.options.format);
        const type = this._toGlParam(gl, this.options.type ?? Texture.UnsignedByte);
        if (format === null || type === null) {
            return this;
        }

        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, format, type, src);

        return this;
    }

    /**
     * Кладёт текстуру в видеокарту
     * @param {WebGLRenderingContext} gl
     */
    public prepare(gl: GLContext) {
        this._glContext = gl;
        this._texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.options.flipY);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.options.premultiplyAlpha);

        const format = this._toGlParam(gl, this.options.format);
        const type = this._toGlParam(gl, this.options.type ?? Texture.UnsignedByte);
        const wrapS = this._toGlParam(gl, this.options.wrapS);
        const wrapT = this._toGlParam(gl, this.options.wrapT);
        const magFilter = this._toGlParam(gl, this.options.magFilter ?? Texture.LinearFilter);
        const minFilter = this._toGlParam(
            gl,
            this.options.minFilter ?? Texture.LinearMipMapLinearFilter,
        );

        if (format !== null && type !== null) {
            const internalFormat = this.hookInternalFormat(format, type, gl);
            // В случае, если options.size определен, то _src должен быть либо null либо ArrayBufferView
            if (ArrayBuffer.isView(this._src) || this._src === null) {
                if (this.options.size) {
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        internalFormat,
                        this.options.size[0],
                        this.options.size[1],
                        0,
                        format,
                        type,
                        this._src,
                    );
                }
            } else if (this._src) {
                gl.texImage2D(gl.TEXTURE_2D, 0, format, format, type, this._src);
            }
        }

        if (wrapS !== null && wrapT !== null) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
        }

        if (magFilter !== null && minFilter !== null) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        }

        if (
            this.options.generateMipmaps &&
            this.options.minFilter !== Texture.NearestFilter &&
            this.options.minFilter !== Texture.LinearFilter
        ) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);

        return this;
    }

    private _toGlParam(gl: GLContext, param: number) {
        if (param === Texture.ClampToEdgeWrapping) {
            return gl.CLAMP_TO_EDGE;
        }
        if (param === Texture.Repeat) {
            return gl.REPEAT;
        }
        if (param === Texture.MirroredRepeat) {
            return gl.MIRRORED_REPEAT;
        }

        if (param === Texture.NearestFilter) {
            return gl.NEAREST;
        }
        if (param === Texture.NearestMipMapNearestFilter) {
            return gl.NEAREST_MIPMAP_NEAREST;
        }
        if (param === Texture.NearestMipMapLinearFilter) {
            return gl.NEAREST_MIPMAP_LINEAR;
        }

        if (param === Texture.LinearFilter) {
            return gl.LINEAR;
        }
        if (param === Texture.LinearMipMapNearestFilter) {
            return gl.LINEAR_MIPMAP_NEAREST;
        }
        if (param === Texture.LinearMipMapLinearFilter) {
            return gl.LINEAR_MIPMAP_LINEAR;
        }
        if (param === Texture.RgbaFormat) {
            return gl.RGBA;
        }
        if (param === Texture.AlphaFormat) {
            return gl.ALPHA;
        }
        if (param === Texture.RgbFormat) {
            return gl.RGB;
        }
        if (param === Texture.DepthComponentFormat) {
            return gl.DEPTH_COMPONENT;
        }

        if (param === Texture.UnsignedByte) {
            return gl.UNSIGNED_BYTE;
        }
        if (param === Texture.Float) {
            return gl.FLOAT;
        }
        if (param === Texture.UnsignedInt) {
            return gl.UNSIGNED_INT;
        }
        if (param === Texture.RedFormat && !(gl instanceof WebGLRenderingContext)) {
            return gl.RED;
        }

        return null;
    }

    private hookInternalFormat(
        format: number,
        type: number,
        gl: WebGL2RenderingContext | WebGLRenderingContext,
    ) {
        if (gl instanceof WebGLRenderingContext) {
            return format;
        }
        if (format === gl.DEPTH_COMPONENT) {
            return gl.DEPTH_COMPONENT24;
        }
        if (type === gl.FLOAT && format === gl.RGBA) {
            return gl.RGBA32F;
        }
        if (type === gl.FLOAT && format === gl.RED) {
            return gl.R32F;
        }
        return format;
    }
}

/**
 * Параметры связывания текстуры
 */
export interface TextureOptions {
    magFilter: number;
    minFilter: number;
    wrapS: number;
    wrapT: number;
    format: number;
    generateMipmaps: boolean;
    flipY: boolean;
    premultiplyAlpha: boolean;
    size?: Vec2;
    unit?: number;
    type?: number;
    texcoord?: number;
}
