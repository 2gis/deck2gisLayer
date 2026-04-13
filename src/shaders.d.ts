/// <reference path="node_modules/@2gis/mapgl/global.d.ts" />

declare module '*.fsh' {
    const value: string;
    export default value;
}

declare module '*.vsh' {
    const value: string;
    export default value;
}

declare module '*.glsl' {
    const value: string;
    export default value;
}

declare module 'gl-state' {
    interface StateStack {
        push(): void;
        pop(): void;
    }
    export default function createStateStack(gl: WebGLRenderingContext | WebGL2RenderingContext): StateStack;
}
