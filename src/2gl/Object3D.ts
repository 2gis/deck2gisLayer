import * as vec3 from '@2gis/gl-matrix/vec3';
import * as mat4 from '@2gis/gl-matrix/mat4';
import * as quat from '@2gis/gl-matrix/quat';

/**
 * Базовый класс для 3D объектов.
 */
export class Object3D {
    /**
     * Каждый Object3D может включать в себя другие объекты.
     * Позиция, поворот и масштаб дочерних объектов будет зависеть от родителя.
     */
    public children: Object3D[] = [];
    /**
     * Родитель, т.е. объект в котором данный Object3D будет дочерним
     */
    public parent: Object3D | null = null;
    /**
     * Будет ли объект отображаться на сцене, если нет, то все дочерние объекты тоже не будут отображаться.
     */
    public visible = true;
    /**
     * Масштаб объекта
     */
    public scale = vec3.fromValues(1, 1, 1);
    /**
     * Позиция объекта в локальной системе координат относительно родителя
     */
    public position = vec3.create();
    /**
     * Отвечает за поворот объекта
     */
    public quaternion = quat.create();
    /**
     * Матрица определяющая поворот, масштаб и позицию объекта в локальной системе координат
     * относительно родителя.
     */
    public localMatrix = mat4.create();
    /**
     * Матрица определяющая поворот, масштаб и позицию объекта в глобальной системе координат.
     */
    public worldMatrix = mat4.create();
    /**
     * Если true, то worldMatrix будет обновлена перед рендерингом
     */
    public worldMatrixNeedsUpdate = false;

    /**
     * Добавляет дочерний объект
     * @param object Дочерний объект
     */
    public add(object: Object3D) {
        if (object.parent) {
            object.parent.remove(object);
        }

        object.parent = this;
        this.children.push(object);

        return this;
    }

    /**
     * Убирает дочерний объект
     * @param object Дочерний объект
     */
    public remove(object: Object3D) {
        const index = this.children.indexOf(object);

        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);
        }

        return this;
    }

    /**
     * Вызывается рендером для подготовки и отрисовки объекта.
     */
    public render() {
        if (!this.visible) {
            return this;
        }

        if (this.worldMatrixNeedsUpdate) {
            this.updateWorldMatrix();
        }

        return this;
    }

    /**
     * Обновляет локальную матрицу объекта. Необходимо использовать каждый раз после изменения position, scale
     * и quaternion.
     * */
    public updateLocalMatrix() {
        mat4.fromRotationTranslationScale(
            this.localMatrix,
            this.quaternion,
            this.position,
            this.scale,
        );

        this.worldMatrixNeedsUpdate = true;

        return this;
    }

    /**
     * Обновляет глобальную матрицу объекта.
     * */
    public updateWorldMatrix() {
        if (this.parent) {
            mat4.mul(this.worldMatrix, this.parent.worldMatrix, this.localMatrix);
        } else {
            mat4.copy(this.worldMatrix, this.localMatrix);
        }

        this.children.forEach((child) => child.updateWorldMatrix());

        this.worldMatrixNeedsUpdate = false;

        return this;
    }

    /**
     * Возвращает позицию объекта относительно глобальных координат.
     */
    public getWorldPosition() {
        return vec3.fromValues(this.worldMatrix[12], this.worldMatrix[13], this.worldMatrix[14]);
    }

    /**
     * Вызывает переданный callback для себя и для каждого дочернего класса.
     */
    public traverse(callback: (obj: Object3D) => void) {
        callback(this);

        this.children.forEach((child) => child.traverse(callback));

        return this;
    }

    /**
     * Работает также как и {@link Object3D#traverse}, но только для объектов с visible = true
     */
    public traverseVisible(callback: (obj: Object3D) => void) {
        if (!this.visible) {
            return this;
        }

        callback(this);

        this.children.forEach((child) => child.traverseVisible(callback));

        return this;
    }
}
