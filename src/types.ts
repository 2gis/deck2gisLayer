import type RenderTarget from '2gl/RenderTarget';
import type Vao from '2gl/Vao';
import type ShaderProgram from '2gl/ShaderProgram';
import { DeckProps } from '@deck.gl/core/typed';

export interface DeckCustomLayer {
    type: 'custom';
    id: string;
    render: (gl: WebGLRenderingContext) => void;
    props: any;
}

/**
 * @hidden
 * @internal
 */
export interface MapViewState {
    repeat: boolean;
    padding: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    longitude: number;
    latitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
    fovy: number;
}

/**
 * @hidden
 * @internal
 */
export type CustomRenderInternalProps = Partial<DeckProps> & {
    _customRender?: (reason: string) => void;
    _2gisData?: any;
    _2glRenderTarget?: RenderTarget;
    _2glMsaaFrameBuffer?: WebGLFramebuffer | null;
    _2glProgram?: ShaderProgram;
    _2glVao?: Vao;
    _2gisFramestart?: boolean;
    _antialiasing?: AntiAliasingMode;
};

export type AntiAliasingMode = 'fxaa' | 'msaa' | 'none';

export type CustomRenderProps = {
    antialiasing?: AntiAliasingMode;
    skipMapAddRemoveEvents?: boolean;
};

/**
 * CustomRenderProps is type extends from DeckProps:
 * https://deck.gl/docs/api-reference/core/deck#properties
 */
export type DeckRenderProps = Partial<DeckProps> & CustomRenderProps;
