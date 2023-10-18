import { GLContext } from './types';

export type UniformTypeNumber = '1f' | '1i';

export type UniformTypeArray =
    | '2i'
    | '3i'
    | '4i'
    | '2f'
    | '3f'
    | '4f'
    | '1fv'
    | '2fv'
    | '3fv'
    | '4fv'
    | '1iv'
    | '2iv'
    | '3iv'
    | '4iv'
    | 'mat2'
    | 'mat3'
    | 'mat4';

export type UniformType = UniformTypeNumber | UniformTypeArray;

/**
 * Шейдерная юниформа, используется только {@link ShaderProgram}
 *
 * @param {UniformDefinition} options
 * @ignore
 */
export class ShaderUniform {
    public name: string;
    public type: string;
    public location: WebGLUniformLocation | null = null;
    constructor(options: UniformDefinition) {
        this.name = options.name;
        this.type = options.type;
    }

    public getLocation(gl: GLContext, webglProgram: WebGLProgram) {
        this.location = gl.getUniformLocation(webglProgram, this.name);
        return this;
    }

    public bind(gl: GLContext, value: any) {
        switch (this.type) {
            case '1i':
                gl.uniform1i(this.location, value);
                break;
            case '1f':
                gl.uniform1f(this.location, value);
                break;
            case '2i':
                gl.uniform2i(this.location, value[0], value[1]);
                break;
            case '2f':
                gl.uniform2f(this.location, value[0], value[1]);
                break;
            case '3i':
                gl.uniform3i(this.location, value[0], value[1], value[2]);
                break;
            case '3f':
                gl.uniform3f(this.location, value[0], value[1], value[2]);
                break;
            case '4i':
                gl.uniform4i(this.location, value[0], value[1], value[2], value[3]);
                break;
            case '4f':
                gl.uniform4f(this.location, value[0], value[1], value[2], value[3]);
                break;
            case '1iv':
                gl.uniform1iv(this.location, value);
                break;
            case '1fv':
                gl.uniform1fv(this.location, value);
                break;
            case '2iv':
                gl.uniform2iv(this.location, value);
                break;
            case '2fv':
                gl.uniform2fv(this.location, value);
                break;
            case '3iv':
                gl.uniform3iv(this.location, value);
                break;
            case '3fv':
                gl.uniform3fv(this.location, value);
                break;
            case '4iv':
                gl.uniform4iv(this.location, value);
                break;
            case '4fv':
                gl.uniform4fv(this.location, value);
                break;
            case 'mat2':
                gl.uniformMatrix2fv(this.location, false, value);
                break;
            case 'mat3':
                gl.uniformMatrix3fv(this.location, false, value);
                break;
            case 'mat4':
                gl.uniformMatrix4fv(this.location, false, value);
                break;
            default:
                throw new Error(`[2gl] Unsupported uniform type: '${this.type}'`);
        }

        return this;
    }
}

/**
 * Описание шейдерной юниформы
 */
export interface UniformDefinition {
    /**
     * Название юниформы
     */
    name: string;
    /**
     * Тип юниформы, может быть: mat[234], [1234][fi], [1234][fi]v
     */
    type: UniformType;
}
