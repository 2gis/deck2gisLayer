import { Buffer, BufferBindOptions } from './Buffer';
import { GLContext } from './types';

/**
 * Класс BufferChannel используется, если данные в обычном буфере имееют разные типы
 * и предназначены для разных атрибутов шейдера, т.е. нужно использовать webgl параметры stride и offset.
 * При инициализации классу передаётся {@link Buffer}. Несколько BufferChannel могут использовать один и тот же Buffer.
 * Во время рендеринга BufferChannel связывает полученный буфер с нужными параметрами.
 *
 * @param {Buffer} buffer Типизированный массив данных, например, координат вершин
 * @param {BufferBindOptions} options
 */
export class BufferChannel {
    /**
     * Параметры для связывания буфера
     */
    public options: BufferBindOptions;
    /**
     * Исходный буфер
     */
    private _buffer: Buffer;
    constructor(buffer: Buffer, options = {}) {
        this._buffer = buffer;
        this.options = Object.assign({}, Buffer.defaultOptions, options);
    }

    /**
     * Связывает данные с контекстом WebGL с нужными параметрами.
     * Вызывает {@link Buffer#bind} исходного буфера.
     */
    public bind(
        gl: GLContext,
        location: number,
        options?: BufferBindOptions,
        instancesExt?: ANGLE_instanced_arrays,
        locationsCount?: number,
    ) {
        this._buffer.bind(gl, location, options || this.options, instancesExt, locationsCount);
    }
}
