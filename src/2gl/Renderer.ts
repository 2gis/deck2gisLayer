import { GLContext } from './types';

/**
 * Используется для инициализация WebGL контекста и отрисовки объектов.
 * Для некоторых объектов может использовать специфичные рендеры.
 *
 * @param {Object} options
 * @param {HTMLElement} [options.canvas] Элемент canvas
 * @param {GLContext} [options.gl] Если элемент canvas не указан, то можно напрямую передать WebGL контекст
 * @param {Number} [options.pixelRatio=1] Pixel ratio экрана
 * @param {Boolean} [options.antialias=true] Использовать ли антиалиасинг
 * @param {Boolean} [options.stencil=false] Использовать ли stencil buffer
 * @param {Number[]} [options.clearColor=[1,1,1,1]] Цвет заливки в формате RGBA
 * @param {Boolean} [options.preserveDrawingBuffer=false] Сохранять ли содержимое Drawing Buffer
 * (может влиять на производительность)
 * */
export class Renderer {
    public clearColor: Vec4;
    public webGlExtensions: Record<string, any> = {};
    protected _gl: GLContext;
    private _canvasElement: HTMLCanvasElement | null = null;
    private _pixelRatio: number;
    private _size: Vec2 = [1, 1];
    constructor(options: RendererOptions) {
        options = options || {};

        if ('canvas' in options) {
            this._canvasElement =
                typeof options.canvas === 'string'
                    ? (document.getElementById(options.canvas) as HTMLCanvasElement)
                    : options.canvas;

            const attributes = {
                antialias: options.antialias !== undefined ? options.antialias : true,
                stencil: options.stencil !== undefined ? options.stencil : false,
                failIfMajorPerformanceCaveat:
                    options.failIfMajorPerformanceCaveat !== undefined
                        ? options.failIfMajorPerformanceCaveat
                        : false,
                preserveDrawingBuffer:
                    options.preserveDrawingBuffer !== undefined
                        ? options.preserveDrawingBuffer
                        : false,
            };

            this._gl = (
                options.version === 2
                    ? this._canvasElement.getContext('webgl2', attributes)
                    : this._canvasElement.getContext('webgl', attributes) ||
                      this._canvasElement.getContext('experimental-webgl', attributes)
            ) as GLContext;
        } else {
            this._gl = options.gl;
        }

        this._pixelRatio = options.pixelRatio || 1;

        /**
         * Цвет заливки в формате RGBA
         * @type {Array}
         */
        this.clearColor = options.clearColor || [1, 1, 1, 1];

        /**
         * Список включенных WebGL расширений
         * @type {Object}
         */
        this.webGlExtensions = {};
    }

    /**
     * Устанавливает параметр pixel ratio
     * @param {Number} value
     */
    public setPixelRatio(value: number) {
        this._pixelRatio = value;

        return this;
    }

    /**
     * Возвращает текущий pixel ratio
     * @returns {Number}
     */
    public getPixelRatio() {
        return this._pixelRatio;
    }

    /**
     * Устанавливает размеры элементу canvas и viewport для WebGL
     * @param {Number} width Ширина в пикселях
     * @param {Number} height Высота в пикселях
     */
    public setSize(width: number, height: number) {
        this._size = [width * this._pixelRatio, height * this._pixelRatio];

        if (this._canvasElement) {
            this._canvasElement.width = this._size[0];
            this._canvasElement.height = this._size[1];
            this._canvasElement.style.width = `${width}px`;
            this._canvasElement.style.height = `${height}px`;
        }

        this.setViewport();

        return this;
    }

    /**
     * Устанавливает viewport для WebGL
     * Если размеры не указаны, то выставляет размеры указанные в функции {@link Renderer#setSize}
     * @param {Number} [width] Ширина в пикселях
     * @param {Number} [height] Высота в пикселях
     */
    public setViewport(width?: number, height?: number) {
        if (width !== undefined && height !== undefined) {
            this._gl.viewport(0, 0, width, height);
        } else {
            this._gl.viewport(0, 0, this._size[0], this._size[1]);
        }

        return this;
    }

    /**
     * Возвращает текущий viewport WebGL
     * @returns {Array}
     */
    public getSize() {
        return this._size;
    }

    /**
     * Включает расширение WebGL
     *
     * @param {String} name Название расширения
     */
    public addExtension(name: string) {
        this.webGlExtensions[name] = this._gl.getExtension(name);
        return this;
    }
}

interface RendererOptsWithGL {
    pixelRatio?: number;
    clearColor?: [number, number, number, number];
    gl: GLContext;
}

interface RendererOptsWithCanvas extends WebGLContextAttributes {
    version?: number;
    pixelRatio?: number;
    clearColor?: [number, number, number, number];
    canvas: HTMLCanvasElement | string;
}

type RendererOptions = RendererOptsWithGL | RendererOptsWithCanvas;
