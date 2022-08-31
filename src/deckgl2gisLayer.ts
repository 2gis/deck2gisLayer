// Use fork mapbox layer in deck.gl
// https://github.com/visgl/deck.gl/tree/master/modules/mapbox

import { getDeckInstance, addLayer, removeLayer, updateLayer, drawLayer } from './utils';
import type { Deck, Layer } from '@deck.gl/core';
import { DeckCustomLayer } from './types';
import type { Map } from '@2gis/mapgl/types';
import createShader from 'gl-shader';
import triangle from 'a-big-triangle';

import RenderTarget from '2gl/RenderTarget';
import Texture from '2gl/Texture';

import fill_fsh from './optimized.fsh';
import fill_vsh from './optimized.vsh';




export type LayerProps<LayerT extends Layer<any>> = Partial<LayerT['props']> & {
    id: string;
    deck?: Deck;
};


export class Deck2gisLayer<LayerT extends Layer<any>> implements DeckCustomLayer {
    id: string;
    type: 'custom';
    renderingMode: '2d' | '3d';
    map: Map | null;
    deck: Deck | null;
    props: LayerProps<LayerT>;
    frameBuffer: RenderTarget;
    gl: any;
    shader: any;
    textureIndex: number;
    enabled:boolean;

    /* eslint-disable no-this-before-super */
    constructor(props: LayerProps<LayerT>) {
        if (!props.id) {
            throw new Error('Layer must have an unique id');
        }

        this.id = props.id;
        this.type = 'custom';
        this.renderingMode = props.renderingMode || '3d';
        this.map = null;
        this.deck = null;
        this.props = props;
        this.textureIndex = 0;
        this.enabled = true;
    }


    onAdd = (map: Map, gl: WebGLRenderingContext) => {
        this.map = map;
        const mapSize = map.getSize();
        this.frameBuffer = new RenderTarget({
            size: [
                Math.ceil((mapSize[0] * window.devicePixelRatio)),
                Math.ceil((mapSize[1] * window.devicePixelRatio)),
            ],
            magFilter: Texture.LinearFilter,
            minFilter: Texture.LinearFilter,
            wrapS: Texture.ClampToEdgeWrapping,
            wrapT: Texture.ClampToEdgeWrapping,
        });

        const rt = this.frameBuffer.bind(gl);
        this.textureIndex = (map as any)._impl.modules.imageManager.addPreparedTexture(rt.getTexture());
        this.gl = gl;
        this.deck = getDeckInstance({ map, gl, deck: this.props.deck, frame: rt._frameBuffer });
        this.shader = createShader(gl, fill_vsh, fill_fsh);
        this.shader.bind();
        this.shader.uniforms.iResolution = [mapSize[0] * window.devicePixelRatio, mapSize[1] * window.devicePixelRatio];
        this.shader.uniforms.iChannel0 = this.textureIndex;
        this.shader.uniforms.enabled = this.enabled;
        console.log('anti-aliasing:',this.enabled);
        addLayer(this.deck, this);
        (map as any).on('click', ()=>{this.enabled = !this.enabled; (this.map as any)._impl.state.needRerender = true;  console.log('anti-aliasing:',this.enabled);})
    };

    

    onRemove = () => {
        if (this.deck) {
            removeLayer(this.deck, this);
        }
    };

    setProps(props: LayerProps<LayerT>) {
        // id cannot be changed
        Object.assign(this.props, props, { id: this.id });
        // safe guard in case setProps is called before onAdd
        if (this.deck) {
            updateLayer(this.deck, this);
        }
    }

    render = () => {
        if (this.deck && this.map) {
            (this.deck as any).userData.currentViewport = undefined;
            const gl = this.gl;
            this.frameBuffer.bind(this.gl);
            gl.clearColor(1, 1, 1, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            this.frameBuffer.unbind(this.gl);
            drawLayer(this.deck!, this.map!, this);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            const texture = this.frameBuffer.getTexture();
            texture.enable(gl, this.textureIndex);
            this.shader.bind();
            this.shader.uniforms.enabled = this.enabled;
            gl.disable(gl.CULL_FACE);
            triangle(gl)



        }
    };
}
