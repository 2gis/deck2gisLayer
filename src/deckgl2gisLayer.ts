// Use fork mapbox layer in deck.gl
// https://github.com/visgl/deck.gl/tree/master/modules/mapbox

import { prepareDeckInstance, addLayer, removeLayer, updateLayer, drawLayer } from './utils';
import type { Deck, Layer } from '@deck.gl/core';
import { DeckCustomLayer } from './types';
import type { Map } from '@2gis/mapgl/types';

import RenderTarget from '2gl/RenderTarget';
import Texture from '2gl/Texture';
import type Vao from '2gl/Vao';
import type ShaderProgram from '2gl/ShaderProgram';

export type LayerProps<LayerT extends Layer<any>> = Partial<LayerT['props']> & {
    id: string;
    renderingMode?: '2d' | '3d';
    deck: Deck;
    type: any;
    antialiasing?: boolean;
};

export class Deck2gisLayer<LayerT extends Layer<any>> implements DeckCustomLayer {
    id: string;
    type: 'custom';
    renderingMode: '2d' | '3d';
    map: Map | null;
    deck: Deck | null;
    props: LayerProps<LayerT>;
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
    antialiasing: boolean;

    private frameBuffer?: RenderTarget;
    private program?: ShaderProgram;
    private vao?: Vao;

    /* eslint-disable no-this-before-super */
    constructor(props: LayerProps<LayerT>) {
        if (!props.id) {
            throw new Error('Layer must have a unique id');
        }

        this.id = props.id;
        this.type = 'custom';
        this.renderingMode = props.renderingMode || '3d';
        this.map = null;
        this.deck = null;
        this.props = props;
        this.antialiasing = Boolean(props.antialiasing);
    }

    onAdd = () => {
        if (!this.map && this.props.deck) {
            const map = this.props.deck.props.userData._2gisMap;
            this.map = map;
            const gl = (this.gl = map.getWebGLContext());
            if ((map as any).__deck) {
                this.deck = (map as any).__deck;
                this.frameBuffer = (this.deck as any).props._2glRenderTarget;
            }

            if (!this.frameBuffer || !this.deck) {
                const mapSize = map.getSize();
                this.frameBuffer = new RenderTarget({
                    size: [
                        Math.ceil(mapSize[0] * window.devicePixelRatio),
                        Math.ceil(mapSize[1] * window.devicePixelRatio),
                    ],
                    magFilter: Texture.LinearFilter,
                    minFilter: Texture.LinearFilter,
                    wrapS: Texture.ClampToEdgeWrapping,
                    wrapT: Texture.ClampToEdgeWrapping,
                });
                const renderTarget = this.frameBuffer.bind(gl);
                this.frameBuffer.unbind(gl);
                this.deck = prepareDeckInstance({ map, gl, deck: this.props.deck, renderTarget });
            }

            this.program = (this.deck as any).props._2glProgram;
            this.vao = (this.deck as any).props._2glVao;
        }

        if (this.deck) {
            addLayer(this.deck, this);
        }
    };

    onRemove = () => {
        if (this.deck) {
            removeLayer(this.deck, this);
        }
    };

    setProps(props: Partial<LayerProps<LayerT>>) {
        // id cannot be changed
        Object.assign(this.props, props, { id: this.id });
        this.antialiasing = Boolean(props.antialiasing);
        // safe guard in case setProps is called before onAdd
        if (this.deck) {
            updateLayer(this.deck, this);
        }
    }

    render = () => {
        if (
            !this.deck ||
            !this.map ||
            !this.frameBuffer ||
            !this.program ||
            !this.vao ||
            !this.gl
        ) {
            return;
        }
        const { userData } = this.deck.props;
        userData._2gisCurrentViewport = undefined;
        const gl = this.gl;
        this.frameBuffer.bind(gl);
        gl.clearColor(1, 1, 1, 0);

        if (userData._2gisFramestart) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            userData._2gisFramestart = false;
        } else {
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        this.frameBuffer.unbind(gl);
        drawLayer(this.deck, this.map, this);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const mapSize = this.map.getSize();
        const texture = this.frameBuffer.getTexture();
        texture.enable(gl, 0);
        this.program.enable(gl);
        this.program.bind(gl, {
            iResolution: [
                mapSize[0] * window.devicePixelRatio,
                mapSize[1] * window.devicePixelRatio,
            ],
            iChannel0: 0,
            enabled: Number(this.antialiasing),
        });

        this.vao.bind({
            gl,
            extensions: { OES_vertex_array_object: gl.getExtension('OES_vertex_array_object') },
        });

        gl.disable(gl.CULL_FACE);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
}
