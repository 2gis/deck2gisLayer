import { GLContext, ShaderDefinitions } from './types';

/**
 * Шейдер компилирует код и хранит его в видеокарте.
 * Один шейдер может быть использован для нескольких программ.
 *
 * @param type Тип шейдера: или vertex, или fragment
 * @param code Код шейдера написанный на языке GLSL.
 * Можно передать несколько строк в виде массива, тогда перед компиляцией строки сложатся.
 * @param definitions Список #define попадающих в код шейдера
 */
export class Shader {
    public static Vertex = 1;
    public static Fragment = 2;
    /**
     * Тип шейдера
     * @type {Shader.Vertex | Shader.Fragment}
     */
    public type: number;

    /**
     * Код шейдера
     */
    private sourceCode: string | string[];
    private shader: WebGLShader | null = null;
    private defines: ShaderDefinitions;

    constructor(type: string, code: string | string[], definitions: ShaderDefinitions = []) {
        this.type = type === 'vertex' ? Shader.Vertex : Shader.Fragment;
        this.sourceCode = code;
        this.defines = definitions;
    }

    /**
     * Возвращает webgl шейдер для связывания с программой.
     * Если шейдер используюется первый раз, то компилирует его.
     * @param gl Контекст WebGL
     * @param [externalDefinitions] Внешние #define, которые могут перезаписать существующие определения
     */
    public get(gl: GLContext, externalDefinitions?: ShaderDefinitions) {
        if (!this.shader) {
            this.compile(gl, externalDefinitions);
        }
        return this.shader;
    }

    /**
     * Удаляет шейдер из видеокарты
     * @param gl Контекст WebGl
     */
    public remove(gl: GLContext) {
        if (this.shader) {
            gl.deleteShader(this.shader);
        }
    }

    /**
     * Возвращает текстовый код шейдера
     */
    public getCode() {
        return this.assembleShaderText().slice();
    }

    /**
     * Компилирует данный шейдер
     */
    private compile(gl: GLContext, externalDefinitions?: ShaderDefinitions) {
        const glType = this.type === Shader.Vertex ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
        const shader = (this.shader = gl.createShader(glType));

        if (!shader || gl.isContextLost()) {
            throw new Error(
                `[2gl] Failed to create shader. Shader is null: ${String(
                    !shader,
                )}. Context is lost: ${String(gl.isContextLost())}`,
            );
        }

        if (externalDefinitions) {
            this.combineDefintions(externalDefinitions);
        }
        const code = this.assembleShaderText();
        gl.shaderSource(shader, code);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const infoLog = gl.getShaderInfoLog(shader);
            const codeLines = (code || '').split('\n');
            throw new Error(
                infoLog
                    ? infoLog.replace(
                          /^ERROR:\s*(\d+):(\d+):\s*(.*?)\n/,
                          // It's useful to inject erroneous line of code
                          // in the error message to concise what happened
                          function (wholeMatch: string, col: number, row: number, message: string) {
                              const line = codeLines[Number(row) - 1];
                              if (line) {
                                  return `ERROR ${col}:${row}: ${message}\nErroneous line: <<${line}>>\n`;
                              } else {
                                  return wholeMatch;
                              }
                          },
                      )
                    : 'Unknown shader compilation error',
            );
        }
    }

    private combineDefintions(externalDefinitions: ShaderDefinitions) {
        for (const { type, value } of externalDefinitions) {
            const existingDef = this.defines.find((d) => d.type === type);
            if (existingDef) {
                existingDef.value = value;
            } else {
                this.defines.push({ type, value });
            }
        }
    }

    private assembleShaderText() {
        const code = this.sourceCode;
        const result = this.defines.map((def) => {
            if (def.value !== undefined) {
                return '#define ' + def.type + ' ' + def.value;
            } else {
                return '#define ' + def.type;
            }
        });

        const lines = Array.isArray(code) ? code : [code || ''];
        let firstLine = true;
        for (const line of lines) {
            // Если в шейдерах указана версия, то ее нужно обязательно
            // поместить первой строкой
            if (firstLine && line.indexOf('#version') !== -1) {
                result.unshift(line);
            } else {
                result.push(line);
            }
            firstLine = false;
        }
        return result.join('\n');
    }
}
