import { Buffer } from './Buffer';
import { BufferChannel } from './BufferChannel';
import { GLContext } from './types';

/**
 * Шейдерный атрибут, используется только {@link ShaderProgram}
 * @param {AttributeDefinition} options Опции создания атрибута
 */
export class ShaderAttribute {
    public name: string;
    public index: boolean | undefined;
    public location: number;
    public locationsCount: number;
    private _enable = false;
    constructor(options: AttributeDefinition) {
        this.name = options.name;
        this.index = options.index;
        this.location = options.location !== undefined ? options.location : -1;
        this.locationsCount = options.locationsCount ?? 1;
        checkAttributeLocationCount(this.locationsCount);
    }
    public bindLocation(gl: GLContext, shaderProgram: WebGLProgram) {
        if (this.location !== -1 && this.index !== true) {
            gl.bindAttribLocation(shaderProgram, this.location, this.name);
        }
        return this;
    }

    public getLocation(gl: GLContext, shaderProgram: WebGLProgram) {
        if (this.location === -1 && this.index !== true) {
            this.location = gl.getAttribLocation(shaderProgram, this.name);
        }
        return this;
    }

    public bind(gl: GLContext, buffer: Buffer | BufferChannel) {
        if (!this._enable && this.index !== true) {
            for (let i = 0; i < this.locationsCount; i++) {
                gl.enableVertexAttribArray(this.location + i);
            }
            this._enable = true;
        }
        buffer.bind(gl, this.location, undefined);
        return this;
    }

    public disable(gl: GLContext) {
        if (this._enable && this.index !== true) {
            for (let i = 0; i < this.locationsCount; i++) {
                gl.disableVertexAttribArray(this.location + i);
            }
            this._enable = false;
        }
        return this;
    }
}

/**
 * Описание шейдерного атрибута
 */
export interface AttributeDefinition {
    /**
     * @property name Название атрибута
     */
    name: string;
    /**
     * @property [index] Если атрибут используется для передачи индексов, то true
     */
    index?: boolean;
    /**
     * @property [location] Можно напрямую выставить location атрибуту, чтобы не вызывался getAttributeLocation
     */
    location?: number;
    /**
     * @property [locationsCount] Количество слотов, которые нужны атрибуту.
     * Для атрибутов типа `float`, `vec2`, `vec3` и `vec4` оно равно 1 (значение по умолчанию).
     * Для атрибутов типа `mat2`, `mat3` и `mat4` оно равно 2, 3, и 4 соответственно.
     */
    locationsCount?: number;
}

/**
 * Проверяет принадлежность количества локаций диапазону 1-4.
 * В случае несоответствия генерирует ошибку.
 */
export function checkAttributeLocationCount(locationCount: number) {
    if (locationCount < 0 || locationCount > 4) {
        throw new Error(`[2gl] Invalid attribute location count. Must be 1, 2, 3 or 4`);
    }
}
