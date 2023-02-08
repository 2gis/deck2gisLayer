// Use fork mapbox layer in deck.gl
// https://github.com/visgl/deck.gl/tree/master/modules/mapbox

import {
    prepareDeckInstance,
    addLayer,
    removeLayer,
    updateLayer,
    drawLayer,
    initDeck2gisProps,
    onMapResize,
} from './utils';
import type { Deck, Layer } from '@deck.gl/core/typed';
import { CustomRenderProps, DeckCustomLayer } from './types';
import type { Map } from '@2gis/mapgl/types';

import RenderTarget from '2gl/RenderTarget';
import Texture from '2gl/Texture';
import type Vao from '2gl/Vao';
import type ShaderProgram from '2gl/ShaderProgram';

/**
 * Any Layer class from deck.gl.
 */
export type DeckLayer = any;

/**
 * Deck2gisLayer required props.
 */
export interface Deck2gisLayerProps {
    id: string;
    renderingMode?: '2d' | '3d';
    deck: Deck;
    type: DeckLayer;
    antialiasing?: boolean;
}

/**
 * LayerProps is type extends from Layer:
 * https://deck.gl/docs/api-reference/core/layer
 */
export type LayerProps<LayerT extends Layer> = Deck2gisLayerProps & Partial<LayerT['props']>;

/**
 * A class that provides rendering any deck.gl layer inside the MapGl canvas / WebGL context.
 */
export class Deck2gisLayer<LayerT extends Layer> implements DeckCustomLayer {
    id: string;
    type: 'custom';
    renderingMode: '2d' | '3d';
    map: Map | null;
    deck: Deck | null;
    props: LayerProps<LayerT>;
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
    antialiasing: boolean;

    /**
     * Initializes deck.gl properties for working with the MapGL map.
     * @param map The map instance.
     * @param deckProps CustomRenderProps initialization options.
     */
    static initDeck2gisProps = (map: Map, deckProps?: CustomRenderProps) =>
        initDeck2gisProps(map, deckProps);

    private frameBuffer?: RenderTarget;
    private program?: ShaderProgram;
    private vao?: Vao;

    /* eslint-disable no-this-before-super */
    /**
     * Example:
     * ```js
     * const deckLayer = new mapgl.Deck2gisLayer(map, {
     *     id: 'deckLayer',
     *     deck,
     *     type: HexagonLayer,
     *     data,
     *     getPosition: (d) => [d.point.lon, d.point.lat]
     * });
     *
     * map.addLayer(deckLayer);
     * ```
     * @param map The map instance.
     * @param options Deck2gisLayer initialization options.
     */
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

    /**
     * @hidden
     * @internal
     * MapGL calls this method after adding a layer to a map.
     */
    public onAdd = () => {
        if (!this.map && this.props.deck) {
            const map = (this.props.deck.props as CustomRenderProps)._2gisData._2gisMap;
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

    /**
     * @hidden
     * @internal
     * MapGL calls this method after removing a layer from a map.
     */
    public onRemove = () => {
        if (this.deck) {
            removeLayer(this.deck, this);
        }
    };

    /**
     * Sets layer properties and updates the layer.
     * @param props deck.gl layer properties.
     */
    public setProps(props: Partial<LayerProps<LayerT>>) {
        // id cannot be changed
        Object.assign(this.props, props, { id: this.id });
        this.antialiasing = Boolean(props.antialiasing);
        // safe guard in case setProps is called before onAdd
        if (this.deck) {
            updateLayer(this.deck, this);
        }
    }

    /**
     * @hidden
     * @internal
     * MapGL calls this method on each map frame rendering.
     */
    public render = () => {
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
        const mapSize = this.map.getSize();
        if (this.deck.width !== mapSize[0] || this.deck.height !== mapSize[1]) {
            (this.deck as any).animationLoop._resizeCanvasDrawingBuffer();
            (this.deck as any).animationLoop._resizeViewport();
            const renderTarget = this.frameBuffer.bind(this.gl);
            onMapResize(this.map, this.deck, renderTarget);
        }
        const { _2gisData } = this.deck.props as CustomRenderProps;
        const gl = this.gl;
        this.frameBuffer.bind(gl);
        gl.clearColor(1, 1, 1, 0);

        if (_2gisData._2gisFramestart) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            _2gisData._2gisCurrentViewport = undefined;
            _2gisData._2gisFramestart = false;
        } else {
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        this.frameBuffer.unbind(gl);
        drawLayer(this.deck, this.map, this);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
