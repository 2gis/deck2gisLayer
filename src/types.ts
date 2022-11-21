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

export type CustomRenderProps = Partial<DeckProps> & {
    _2glRenderTarget: RenderTarget;
    _2glProgram: ShaderProgram;
    _2glVao: Vao;
    _2gisFramestart: boolean;
    _customRender: (reason: string) => void;
    _2gisData?: any;
};
