import { Texture, TextureOptions } from './Texture';
import { GLContext } from './types';

/**
 * Используется для создания фреймбуфера, куда можно отрендерить кадр.
 */
export class RenderTarget {
    public static defaultOptions = Object.assign({}, Texture.defaultOptions, {
        size: [0, 0],
        generateMipmaps: false,
        depthTexture: false,
    });
    /**
     * Параметры для связывания фреймбуфера
     * @type {RenderTargetOptions}
     */
    public readonly options: RenderTargetOptions;
    /**
     * Текстура создается в конструкторе, чтобы можно было сразу получить на нее ссылку.
     */
    private _texture: Texture | null = null;
    /**
     * Контекст WebGL, в котором был инициализирован фреймбуфер.
     * Используется только для удаления, подумать хорошо, прежде чем использовать для чего-то ещё.
     */
    private _glContext: GLContext | null = null;
    private _frameBuffer: WebGLFramebuffer | null = null;
    private _depthBuffer: Texture | WebGLRenderbuffer | null = null;

    constructor(options: Partial<RenderTargetOptions> = {}) {
        this.options = Object.assign({}, RenderTarget.defaultOptions, options);
        this._texture = new Texture(null, this.options);
    }

    /**
     * Связывает компоненты с контекстом WebGL
     * @param {WebGLRenderingContext} gl
     */
    public bind(gl: GLContext) {
        if (!this._frameBuffer) {
            this._prepare(gl);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer);

        return this;
    }

    /**
     * Устанавливает пустой фреймбуфер у контекста WebGL
     * @param {WebGLRenderingContext} gl
     */
    public unbind(gl: GLContext) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return this;
    }

    /**
     * Удаляет фреймбуфер из видеокарты
     */
    public remove() {
        this._unprepare();
        return this;
    }

    /**
     * Устанавливает размер фреймбуферу
     * @param {vec2} size
     */
    public setSize(size: Vec2) {
        this.options.size = size;
        this._unprepare();
        return this;
    }

    /**
     * Возвращает текущую текстуру фреймбуфера
     */
    public getTexture(): Texture | null {
        return this._texture;
    }

    /**
     * Возвращает текущие буфер или текстуру глубины фреймбуфера
     */
    public getDepthBuffer(): Texture | WebGLRenderbuffer | null {
        return this._depthBuffer;
    }

    /**
     * Инициализирует фреймбуфер, текстуры и рендербуфер
     * @param {WebGLRenderingContext} gl
     * @ignore
     */
    private _prepare(gl: GLContext) {
        this._glContext = gl;

        // Проверяем наличие текстуры, т.к. она может быть удалена через метод _unprepare.
        if (!this._texture) {
            this._texture = new Texture(null, this.options);
        }
        this._texture.prepare(gl);

        this._frameBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameBuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this._texture.getTexture(),
            0,
        );

        if (this.options.depthTexture) {
            const depthBuffer = (this._depthBuffer = new Texture(null, {
                magFilter: Texture.NearestFilter,
                minFilter: Texture.NearestFilter,
                format: Texture.DepthComponentFormat,
                size: this.options.size,
                premultiplyAlpha: false,
                generateMipmaps: false,
                type: Texture.UnsignedInt,
            }));
            depthBuffer.prepare(gl);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.TEXTURE_2D,
                depthBuffer.getTexture(),
                0,
            );
        } else {
            this._depthBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthBuffer);
            gl.renderbufferStorage(
                gl.RENDERBUFFER,
                gl.DEPTH_COMPONENT16,
                this.options.size[0],
                this.options.size[1],
            );
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.RENDERBUFFER,
                this._depthBuffer,
            );
        }

        this._checkComplete(gl);

        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * Удаляет данные из видеокарты
     * @ignore
     */
    private _unprepare() {
        if (this._texture) {
            this._texture.remove();
            this._texture = null;
        }

        if (this._glContext && this._depthBuffer) {
            this._depthBuffer instanceof Texture
                ? this._depthBuffer.remove()
                : this._glContext.deleteRenderbuffer(this._depthBuffer);
            this._depthBuffer = null;
        }

        if (this._glContext && this._frameBuffer) {
            this._glContext.deleteFramebuffer(this._frameBuffer);
            this._frameBuffer = null;
        }
    }

    /**
     * Проверяет инициализацию фреймбуфера
     * @param {WebGLRenderingContext} gl
     * @ignore
     */
    private _checkComplete(gl: GLContext) {
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        if (status === gl.FRAMEBUFFER_COMPLETE) {
            return;
        } else if (status === gl.FRAMEBUFFER_UNSUPPORTED) {
            console.log('Framebuffer is unsupported');
        } else if (status === gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) {
            console.log('Framebuffer incomplete attachment');
        } else if (status === gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) {
            console.log('Framebuffer incomplete dimensions');
        } else if (status === gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) {
            console.log('Framebuffer incomplete missing attachment');
        } else {
            console.log(`Unexpected framebuffer status: ${status}`);
        }
    }
}

/**
 * Параметры связывания текстуры
 */
interface RenderTargetOptions extends TextureOptions {
    size: Vec2;
    depthTexture: boolean;
}
