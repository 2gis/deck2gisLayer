import { Shader } from './Shader';
import { AttributeDefinition, ShaderAttribute } from './ShaderAttribute';
import { ShaderUniform, UniformDefinition } from './ShaderUniform';
import { Buffer } from './Buffer';
import { GLContext, ShaderDefinitions } from './types';
import { BufferChannel } from './BufferChannel';

/**
 * Шейдерная программа инициализирует шейдеры, подготавливает и связывает данные с WebGL.
 *
 * @param {Object} options
 * @param {Shader} vertex Вершинный шейдер
 * @param {Shader} fragment Фрагментный шейдер
 * @param {UniformDefinition[]} [options.uniforms=[]] Описание юниформ
 * @param {AttributeDefinition[]} [options.attributes=[]] Описание атрибутов
 */
export class ShaderProgram {
    public uniforms: Record<string, ShaderUniform> = {};
    public attributes: Record<string, ShaderAttribute> = {};
    private _vertexShader: Shader;
    private _fragmentShader: Shader;
    private _webglProgram: WebGLProgram | null = null;
    private _linked = false;
    private _located = false;
    private _error = false;
    constructor(options: {
        vertex: Shader;
        fragment: Shader;
        uniforms?: UniformDefinition[];
        attributes?: AttributeDefinition[];
    }) {
        options = options || {};

        this._vertexShader = options.vertex;
        this._fragmentShader = options.fragment;

        options.uniforms = options.uniforms || [];
        options.uniforms.forEach((obj) => {
            this.uniforms[obj.name] = new ShaderUniform(obj);
        });

        options.attributes = options.attributes || [];
        options.attributes.forEach((obj) => {
            this.attributes[obj.name] = new ShaderAttribute(obj);
        });
    }

    /**
     * Инициализирует программу с контекстом WebGl
     * @param gl
     */
    public enable(gl: GLContext, externalDefinitions?: ShaderDefinitions) {
        if (this._error) {
            return this;
        }
        this.link(gl, externalDefinitions);
        this.locate(gl);
        if (this._error) {
            return this;
        }

        gl.useProgram(this._webglProgram);

        return this;
    }

    /**
     * Связывает юниформы и атрибуты программы с контекстом WebGl
     *
     * @param gl
     * @param [uniforms] Key-value объект содержащий значения юниформ
     * @param [attributes] Key-value объект содержащий значения атрибутов
     */
    public bind(
        gl: GLContext,
        uniforms?: Record<string, any>,
        attributes?: Record<string, Buffer | BufferChannel>,
    ) {
        if (this._error) {
            return this;
        }
        if (uniforms) {
            for (const name in uniforms) {
                this.uniforms[name].bind(gl, uniforms[name]);
            }
        }

        if (attributes) {
            for (const name in attributes) {
                this.attributes[name].bind(gl, attributes[name]);
            }
        }

        return this;
    }

    /**
     * Выключает программу
     * @param gl
     */
    public disable(gl: GLContext) {
        if (this._error) {
            return this;
        }

        for (const name in this.attributes) {
            this.attributes[name].disable(gl);
        }

        return this;
    }

    /**
     * Компилирует шейдеры и слинковывает программу.
     * Одна из двух необходимых функций для работы шейдерной программы.
     * @param gl
     */
    public link(gl: GLContext, externalDefinitions?: ShaderDefinitions) {
        // Сейчас ничего не произойдет, если после линковки повторно вызвать link с другими externalDefinitions.
        // По-идее, должна произойти пересборка шейдеров + новая линковка
        if (this._linked || this._error) {
            return this;
        }

        try {
            this._webglProgram = gl.createProgram();
            if (!this._webglProgram) {
                throw new Error('Failed to create shader program');
            }

            const vs = this._vertexShader.get(gl, externalDefinitions);
            const fs = this._fragmentShader.get(gl, externalDefinitions);

            if (vs) {
                gl.attachShader(this._webglProgram, vs);
            }

            if (fs) {
                gl.attachShader(this._webglProgram, fs);
            }

            for (const name in this.attributes) {
                this.attributes[name].bindLocation(gl, this._webglProgram);
            }

            gl.linkProgram(this._webglProgram);
            if (!gl.getProgramParameter(this._webglProgram, gl.LINK_STATUS)) {
                throw new Error(
                    gl.getProgramInfoLog(this._webglProgram) ||
                        "Couldn't get shader program Info Log",
                );
            }

            this._linked = true;
        } catch (error) {
            this._error = true;
            throw error;
        }

        return this;
    }

    /**
     * Лоцирует атрибуты и юниформе на основе шейдера.
     * Одна из двух необходимых функций для работы шейдерной программы.
     * @param gl
     */
    public locate(gl: GLContext) {
        if (this._located || this._error || !this._webglProgram) {
            return this;
        }

        for (const name in this.attributes) {
            this.attributes[name].getLocation(gl, this._webglProgram);
        }

        for (const name in this.uniforms) {
            this.uniforms[name].getLocation(gl, this._webglProgram);
        }

        this._located = true;

        return this;
    }
}
