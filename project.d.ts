import * as _mapgl from '@2gis/mapgl/types';

declare global {
    const mapgl: typeof _mapgl;
}

export as namespace mapgl;
export = _mapgl;

declare module '*.fsh' {
    const _: string;
    export default _;
}

declare module '*.vsh' {
    const _: string;
    export default _;
}
