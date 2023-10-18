import { Buffer } from './Buffer';
import { BufferChannel } from './BufferChannel';
import { ShaderProgram } from './ShaderProgram';
import { GLContext } from './types';

export interface AttributesAliases {
    [shaderAttributeName: string]: string;
}

export type VaoAttributes = Record<string, Buffer | BufferChannel>;

/**
 * Обертка над vertex array object.
 * https://developer.mozilla.org/ru/docs/Web/API/OES_vertex_array_object
 *
 * Для использования необходимо включить расширение renderer.addExtension('OES_vertex_array_object')
 *
 */
export class Vao {
    public indicesBuffer: Buffer | null;
    private _vao: WebGLVertexArrayObject | null = null;
    private _attributes: VaoAttributes;
    private _shaderProgram: ShaderProgram;

    /**
     * WebGL экстеншен, в котором был инициализирован буфер.
     */
    private _vaoExt: OES_vertex_array_object | null = null;
    private _gl: GLContext | null = null;

    private attributesAliases: AttributesAliases = {};

    /**
     * @param shaderProgram Шейдерная программа, каждый Vao привязан к одной шейдерной программе.
     * @param attributes Key-value объект содержащий данные атрибутов.
     * @param indicesBuffer Буффер индексов.
     */
    constructor(
        shaderProgram: ShaderProgram,
        attributes: VaoAttributes,
        indicesBuffer: Buffer | null = null,
    ) {
        this._attributes = attributes;
        this._shaderProgram = shaderProgram;
        this.indicesBuffer = indicesBuffer;
    }

    public static merge(vaos: Vao[]) {
        const first = vaos[0];
        const attrs = {};
        const aliases = {};
        for (const vao of vaos) {
            Object.assign(attrs, vao._attributes);
            Object.assign(aliases, vao.attributesAliases);
        }
        const vao = new Vao(first._shaderProgram, attrs, first.indicesBuffer);
        vao.setAttributesAliases(aliases);
        return vao;
    }

    /** Копирует Vao */
    public copy() {
        const vao = new Vao(this._shaderProgram, this._attributes, this.indicesBuffer);
        vao.setAttributesAliases(this.attributesAliases);
        return vao;
    }

    /**
     * Связывает vao с контекстом WebGL.
     *
     * @param state Стейт рендера
     */
    public bind(state: {
        gl: GLContext;
        extensions: {
            OES_vertex_array_object?: OES_vertex_array_object;
            ANGLE_instanced_arrays?: ANGLE_instanced_arrays;
        };
    }) {
        const vaoExt = state.extensions.OES_vertex_array_object;
        const instancesExt = state.extensions.ANGLE_instanced_arrays;

        this._bind(state.gl, vaoExt, instancesExt);

        return this;
    }

    /**
     * Отвязывает vao от контекста WebGL.
     * ВНИМАНИЕ: Этот метод нужно вызывать всегда, перед тем как будет использоваться
     * стандартный подход для связывания атрибутов через {@link ShaderProgram#bind}.
     */
    public unbind() {
        this._glBindVertexArray(null);

        return this;
    }

    public setAttribute(name: string, buffer: Buffer | BufferChannel) {
        this._attributes[name] = buffer;
        this.remove();
    }

    /**
     * Удаляет vao.
     */
    public remove() {
        if (this._vao) {
            this._glDeleteVertexArray(this._vao);
            this._vao = null;
        }

        return this;
    }

    /**
     * Возвращает GL-тип индексного буфера или null
     * @param {WebGLRenderingContext | WebGL2RenderingContext} gl Gl-контекст
     * @returns {number | null} GL-тип индексного буфера
     */
    public getElementsGLType(gl: GLContext) {
        if (this.indicesBuffer) {
            return this.indicesBuffer.getGLType(gl);
        }
        return null;
    }

    /**
     * Карта псевдонимов вида { 'shader_att_name': 'vao_attr_name' }.
     * Эти псевдонимы могут использоваться при связке буферов с шейдерными атрибутами в методе bind.
     * Например, в Vao задан буфер 'texcoord_0'. В шейдере он может использоваться под именем 'texcoord_color'.
     * @param {AttributesAliases}  aliases Карта пвседонимов
     */
    public setAttributesAliases(aliases: AttributesAliases) {
        Object.assign(this.attributesAliases, aliases);
        // Инвалидируем текщуий VAO, если он был создан. Нужно привязать атрибуты заново
        this.remove();
    }

    private setAttributes(gl: GLContext, instancesExt?: ANGLE_instanced_arrays) {
        const shaderAttributes = this._shaderProgram.attributes;
        const attributes = this._attributes;

        // Биндим атрибуты переданные в конструктор, их параметры берём из шейдерной программы
        for (const attrNameInShader in shaderAttributes) {
            const alias = this.attributesAliases[attrNameInShader];
            const attrNameInVao = alias || attrNameInShader;
            const vaoAttributeBuffer = attributes[attrNameInVao];
            if (!vaoAttributeBuffer) {
                // TODO: TILES-5322: Некоторые шейдерные программы ожидают атрибуты, которые не включаются,
                // поскольку они отсутствуют в VAO. В шейдере из таких атрибутов читаются нули, что, видимо,
                // нас пока устраивает. В целях консистентности данных стоит добавить все недостающие буферы,
                // или подключать шейдерные программы, не требующие отсутвующих в VAO атрибутов.
                // Чтобы увидеть все такие атрибуты - раскомментируй console.error ниже.

                // console.error(
                //     `VAO doesn't have an attribute named "${attrNameInVao}" that is requested by shader program.`,
                // );
                continue;
            }
            const shaderAttribute = shaderAttributes[attrNameInShader];
            if (shaderAttribute.index !== true) {
                for (let i = 0; i < shaderAttribute.locationsCount; i++) {
                    gl.enableVertexAttribArray(shaderAttribute.location + i);
                }
            }
            vaoAttributeBuffer.bind(
                gl,
                shaderAttribute.location,
                undefined,
                instancesExt,
                shaderAttribute.locationsCount,
            );
        }
        if (this.indicesBuffer) {
            this.indicesBuffer.bind(gl);
        }
    }

    private _bind(
        gl: GLContext,
        vaoExt?: OES_vertex_array_object,
        instancesExt?: ANGLE_instanced_arrays,
    ) {
        if (!this._vao) {
            this._prepare(gl, vaoExt, instancesExt);
        } else {
            this._glBindVertexArray(this._vao);
        }
    }

    private _prepare(
        gl: GLContext,
        vaoExt?: OES_vertex_array_object,
        instancesExt?: ANGLE_instanced_arrays,
    ) {
        this._gl = gl;
        if (vaoExt) {
            this._vaoExt = vaoExt;
        }

        this._vao = this._glCreateVertexArray();
        this._glBindVertexArray(this._vao);

        this.setAttributes(gl, instancesExt);
    }

    private _glCreateVertexArray() {
        const gl = this._gl;
        const ext = this._vaoExt;
        if (gl && this._isWebGL2(gl)) {
            return gl.createVertexArray();
        } else if (ext) {
            return ext.createVertexArrayOES();
        }
        return null;
    }

    private _glBindVertexArray(vao: WebGLVertexArrayObject | null) {
        const gl = this._gl;
        const ext = this._vaoExt;
        if (gl && this._isWebGL2(gl)) {
            gl.bindVertexArray(vao);
        } else if (ext) {
            ext.bindVertexArrayOES(vao);
        } else if (gl) {
            // В случае фоллбека - биндим атрибуты прямо из шейдерной программы
            this._shaderProgram.bind(gl, undefined, this._attributes);
        }
    }

    private _glDeleteVertexArray(vao: WebGLVertexArrayObject) {
        const gl = this._gl;
        const ext = this._vaoExt;
        if (gl && this._isWebGL2(gl)) {
            gl.deleteVertexArray(vao);
        } else if (ext) {
            ext.deleteVertexArrayOES(vao);
        }
    }

    private _isWebGL2(gl: GLContext): gl is WebGL2RenderingContext {
        return (
            typeof window !== 'undefined' &&
            'WebGL2RenderingContext' in window &&
            gl instanceof WebGL2RenderingContext
        );
    }
}
