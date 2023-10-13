import { checkAttributeLocationCount } from './ShaderAttribute';
import { GLContext } from './types';

/**
 * Используется для хранения и подготовки данных для передачи в атрибуты шейдера
 */
export class Buffer {
    public static readonly ArrayBuffer = 1;
    public static readonly ElementArrayBuffer = 2;

    public static readonly StaticDraw = 10;
    public static readonly DynamicDraw = 11;

    public static readonly Float = 20;
    public static readonly UnsignedByte = 21;
    public static readonly UnsignedShort = 22;
    public static readonly UnsignedInt = 23;
    public static readonly Byte = 24;
    public static readonly Short = 25;
    public static readonly Int = 26;

    public static readonly defaultOptions: BufferBindOptions = {
        itemSize: 3,
        dataType: this.Float,
        stride: 0,
        offset: 0,
        normalized: false,
        instanceDivisor: 0,
        drawType: Buffer.StaticDraw,
    };

    /**
     * Размер данных в буфере в байтах
     */
    public byteLength: number;
    /**
     * Тип буфера. Буфер может использоваться для передачи массива данных,
     * так и для передачи индексов элементов из данных.
     * @type {Buffer.ArrayBuffer | Buffer.ElementArrayBuffer}
     */
    public type: number;

    /**
     * Параметры для связывания буфера
     */
    public options: BufferBindOptions;

    /**
     * Указывает, как часто данные буфера будут изменяться.
     * @type {Buffer.StaticDraw | Buffer.DynamicDraw}
     */
    public drawType: number;

    /**
     * Тип элементов в индeксном буфере. Применим только к буферам типа ElementArrayBuffer
     * UNSIGNED_INT поддерживается при поддержке расширения OES_element_index_uint (core в WebGL2)
     * Определяется автоматически на основе наибольшего элемента в буфере
     * @type {Buffer.UnsignedByte | Buffer.UnsignedShort | Buffer.UnsignedInt | null}
     */
    public elementsType: number | null = null;

    private _initData: number | BufferSource | null;
    /**
     * Исходный WebGL буфер
     */
    private _glBuffer: WebGLBuffer | null = null;

    /**
     * Контекст WebGL, в котором был инициализирован буфер.
     * Используется только для удаления буфера, подумать хорошо, прежде чем использовать для чего-то ещё.
     */
    private _glContext: GLContext | null = null;

    /**
     * @param initData Данные для инита буфера: содержимое буфера или его размер
     * @param options Параметры передачи буфера в видеокарту,
     * могут быть переопределены из {@link BufferChannel}
     * @param isElementArray Флаг определяющий является ли буффер индексным (если true)
     * или повертексным (если false)
     */
    constructor(
        initData: DataView | TypedArray | ArrayBuffer | number,
        options?: Partial<BufferBindOptions>,
        isElementArray = false,
    ) {
        this._initData = initData;
        this.byteLength = typeof initData === 'number' ? initData : initData.byteLength;
        this.type = isElementArray ? Buffer.ElementArrayBuffer : Buffer.ArrayBuffer;
        this.options = Object.assign({}, Buffer.defaultOptions, options);
        this.drawType = options?.drawType ?? Buffer.StaticDraw;

        const supportedElementArrayTypes = [
            Buffer.UnsignedByte,
            Buffer.UnsignedShort,
            Buffer.UnsignedInt,
        ];
        if (isElementArray && !supportedElementArrayTypes.includes(this.options.dataType)) {
            console.warn(
                'Please provide dataType of one of the following values:' +
                    'Buffer.UnsignedByte, Buffer.UnsignedShort, Buffer.UnsignedInt. Defaulting to UnsignedInt',
            );
            this.options.dataType = Buffer.UnsignedInt;
        }
    }

    /**
     * Возвращает размер типа данных в байтах
     * @param {number} dataType
     * @ignore
     */
    private static _dataTypeSize(dataType: number) {
        switch (dataType) {
            case Buffer.Byte:
            case Buffer.UnsignedByte:
                return 1;
            case Buffer.UnsignedShort:
            case Buffer.Short:
                return 2;
            case Buffer.Float:
            case Buffer.Int:
            case Buffer.UnsignedInt:
                return 4;
        }

        throw new Error(`[2gl] Unsupported Buffer data type: ${String(dataType)}`);
    }

    /**
     * Связывает данные с контекстом WebGL.
     *
     * В случае Buffer.ArrayBuffer связывает с атрибутами шейдера.
     * А в случае Buffer.ElementArrayBuffer связывает массив индексов.
     *
     * Если используется первый раз, добавляет данные в контекст WebGL.
     *
     * @param gl Контекст WebGL
     * @param location Положение аттрибута для связывания данных с переменными в шейдере
     * @param options Параметры передаваемые в функцию vertexAttribPointer, если их нет,
     * то используются параметры конкретного буфера. Параметры должны быть переданы все.
     * @param instancesExt Экстеншн для работы с instanced буферами,
     * @param locationsCount Количество слотов необходимых атрибуту. По умолчанию равен 1.
     */
    public bind(
        gl: GLContext,
        location?: number | null,
        options?: BufferBindOptions | null,
        instancesExt?: ANGLE_instanced_arrays | null,
        locationsCount?: number,
    ) {
        if (!this._glBuffer) {
            this.prepare(gl);
        }

        if (this.type === Buffer.ArrayBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._glBuffer);

            location = location || 0;
            options = options || this.options;
            locationsCount = locationsCount ?? 1;
            checkAttributeLocationCount(locationsCount);
            const type = this._toGlParam(gl, options.dataType) || gl.FLOAT;

            if (locationsCount === 1) {
                gl.vertexAttribPointer(
                    location,
                    options.itemSize,
                    type,
                    options.normalized,
                    options.stride,
                    options.offset,
                );
                this.bindVertexAttribDivisor(gl, location, options, instancesExt);
            } else {
                /** Размер элемента в байтах */
                const componentSize = Buffer._dataTypeSize(options.dataType);

                for (let i = 0; i < locationsCount; i++) {
                    gl.vertexAttribPointer(
                        location + i,
                        locationsCount,
                        type,
                        options.normalized,
                        options.stride,
                        options.offset + i * locationsCount * componentSize,
                    );
                    this.bindVertexAttribDivisor(gl, location + i, options, instancesExt);
                }
            }
        } else if (this.type === Buffer.ElementArrayBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._glBuffer);
        }

        return this;
    }

    /**
     * Удаляет данные из контекста WebGL.
     */
    public remove() {
        this._unprepare();

        return this;
    }

    /**
     * Заменяет часть буфера новыми данными и отправляет их в видеокарту
     * @param {WebGLRenderingContext} gl
     * @param {Number} index Индекс, с которого начать замену
     * @param {TypedArray} data Новые данные
     */
    public subData(gl: WebGLRenderingContext, index: number, data: TypedArray) {
        const type = this._toGlParam(gl, this.type) || gl.ARRAY_BUFFER;
        gl.bindBuffer(type, this._glBuffer);
        gl.bufferSubData(type, index, data);

        return this;
    }

    /**
     * Кладёт данные в видеокарту
     * @param gl WebGL Контекст
     * @ignore
     */
    public prepare(gl: GLContext) {
        this._glContext = gl;
        this._glBuffer = gl.createBuffer();
        const type = this._toGlParam(gl, this.type) || gl.ARRAY_BUFFER;
        const drawType = this._toGlParam(gl, this.drawType) || gl.STATIC_DRAW;
        gl.bindBuffer(type, this._glBuffer);
        // @ts-ignore
        // Типы верны, но в TS перегруженные функции не понимают union-типы
        gl.bufferData(type, this._initData, drawType);
        this._initData = null;
        return this;
    }
    /**
     * Возвращает GL-тип буфера
     * @param {WebGLRenderingContext} gl
     * @returns {number | null} GL-тип буфера
     * @ignore
     */
    public getGLType(gl: GLContext) {
        return this._toGlParam(gl, this.options.dataType);
    }

    /**
     * Удаляет данные из видеокарты
     * @ignore
     */
    private _unprepare() {
        if (this._glBuffer && this._glContext) {
            this._glContext.deleteBuffer(this._glBuffer);
            this._glBuffer = null;
            this._glContext = null;
        }
    }

    /**
     * Преобразовывает параметры буфера в параметры WebGL
     * @param {WebGLRenderingContext | WebGL2RenderingContext} gl
     * @param {Buffer.ArrayBuffer | Buffer.ElementArrayBuffer} param
     * @ignore
     */
    private _toGlParam(gl: GLContext, param: number) {
        if (param === Buffer.ArrayBuffer) {
            return gl.ARRAY_BUFFER;
        }
        if (param === Buffer.ElementArrayBuffer) {
            return gl.ELEMENT_ARRAY_BUFFER;
        }
        if (param === Buffer.StaticDraw) {
            return gl.STATIC_DRAW;
        }
        if (param === Buffer.DynamicDraw) {
            return gl.DYNAMIC_DRAW;
        }
        if (param === Buffer.Byte) {
            return gl.BYTE;
        }
        if (param === Buffer.Short) {
            return gl.SHORT;
        }
        if (param === Buffer.Int) {
            return gl.INT;
        }
        if (param === Buffer.Float) {
            return gl.FLOAT;
        }
        if (param === Buffer.UnsignedByte) {
            return gl.UNSIGNED_BYTE;
        }
        if (param === Buffer.UnsignedShort) {
            return gl.UNSIGNED_SHORT;
        }
        if (param === Buffer.UnsignedInt) {
            return gl.UNSIGNED_INT;
        }
        return null;
    }

    private _hasRealWebGLContext() {
        return (
            typeof window !== 'undefined' &&
            ('WebGLRenderingContext' in window || 'WebGL2RenderingContext' in window)
        );
    }

    private bindVertexAttribDivisor(
        gl: GLContext,
        location: number,
        options: BufferBindOptions,
        instancesExt?: ANGLE_instanced_arrays | null,
    ) {
        if (options.instanceDivisor && this._hasRealWebGLContext()) {
            if (gl instanceof WebGLRenderingContext) {
                if (instancesExt) {
                    instancesExt.vertexAttribDivisorANGLE(location, options.instanceDivisor);
                } else {
                    console.error(
                        "Can't set up instanced attribute divisor. " +
                            'Missing ANGLE_instanced_arrays extension',
                    );
                }
            } else {
                gl.vertexAttribDivisor(location, options.instanceDivisor);
            }
        }
    }
}

/**
 * Параметры передаваемые в функцию vertexAttribPointer.
 *
 */
export interface BufferBindOptions {
    /**
     * @property {Number} Размерность элементов в атрибуте. Возможные значения:
     *  1 - `float`,
     *  2 - `vec2`,
     *  3 - `vec3`,
     *  4 - `vec4`,
     *  9 - `mat3`,
     * 16 - `mat4`,
     */
    itemSize: number;
    /**
     * @property {Buffer.Float | Buffer.UnsignedByte} dataType Тип данных в буфере
     */
    dataType: number;
    /**
     * @property {Boolean} normalized Используется для целочисленных типов. Если выставлен в true, то
     * значения имеющие тип BYTE от -128 до 128 будут переведены от -1.0 до 1.0.
     */
    normalized: boolean;
    /**
     * @property {Number} stride
     */
    stride: number;
    /**
     * @property {Number} offset
     */
    offset: number;
    /**
     * @property {Number} instanceDivisor
     */
    instanceDivisor: number;
    /**
     * @property {Buffer.StaticDraw | Buffer.DynamicDraw} drawType
     */
    drawType: number;
}
