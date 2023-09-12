// Use fork mapbox layer in deck.gl
// https://github.com/visgl/deck.gl/tree/master/modules/mapbox

import {
    addLayer,
    removeLayer,
    updateLayer,
    drawLayer,
    initDeck2gis,
    onMapResize,
    stateBinder,
} from './utils';
import type { Deck, Layer } from '@deck.gl/core/typed';
import { CustomRenderInternalProps, CustomRenderProps, DeckCustomLayer } from './types';
import type { Map } from '@2gis/mapgl/types';

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
    props: LayerProps<LayerT> | undefined;
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
    antialiasing: boolean;
    isDestroyed: boolean;

    /**
     * Initializes deck.gl properties for working with the MapGL map.
     * @param map The map instance.
     * @param deckProps CustomRenderProps initialization options.
     */
    static initDeck2gis = (map: Map, Deck: Deck, deckProps?: CustomRenderProps) =>
        initDeck2gis(map, Deck, deckProps);

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
        this.isDestroyed = false;
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
        const map: Map = (this.props?.deck.props as CustomRenderInternalProps)._2gisData._2gisMap;

        if (!this.map && this.props?.deck && !this.isDestroyed) {
            this.map = map;
            if ((map as any).__deck) {
                this.deck = (map as any).__deck;
                this.gl = map.getWebGLContext();
            }
        }

        if ((this.props?.deck.props as CustomRenderProps).skipMapAddRemoveEvents) {
            return;
        }

        if (this.deck && !this.isDestroyed) {
            addLayer(this.deck, this);
        }
    };
    /**
     * @hidden
     * @internal
     * MapGL calls this method after removing a layer from a map.
     */
    public onRemove = () => {
        if ((this.props?.deck.props as CustomRenderProps).skipMapAddRemoveEvents) {
            return;
        }
        if (this.deck) {
            removeLayer(this.deck, this);
        }
        this.deck = null;
        this.map = null;
    };

    /**
     * Sets layer properties and updates the layer.
     * @param props deck.gl layer properties.
     */
    public setProps(props: Partial<LayerProps<LayerT>>) {
        if (!this.isDestroyed && this.props) {
            // id cannot be changed
            Object.assign(this.props, props, { id: this.id });
            this.antialiasing = Boolean(props.antialiasing);
            // safe guard in case setProps is called before onAdd
            if (this.deck) {
                updateLayer(this.deck, this);
            }
        }
    }

    public getDeckLayer(): Layer {
        if (this.gl) {
            stateBinder(this.gl, this);
        }
        const deckLayer = this;
        const LayerType = deckLayer?.props?.type;
        return new LayerType(deckLayer.props);
    }

    /**
     * Destroys the layer and frees all related resources.
     */
    public destroy = () => {
        this.deck = null;
        this.map = null;
        this.gl = undefined;
        this.isDestroyed = true;
        this.props = undefined;
    };

    /**
     * @hidden
     * @internal
     * MapGL calls this method on each map frame rendering.
     */
    public render = () => {
        if (!this.deck || !this.map || !this.gl) {
            return;
        }
        const program = (this.deck.props as CustomRenderInternalProps)._2glProgram;
        const vao = (this.deck.props as CustomRenderInternalProps)._2glVao;
        const renderTarget = (this.deck.props as CustomRenderInternalProps)._2glRenderTarget;
        const msaaFrameBuffer = (this.deck.props as CustomRenderInternalProps)._2glMsaaFrameBuffer;
        if (
            this.isDestroyed ||
            !this.deck ||
            !(this.deck as any).layerManager ||
            !this.map ||
            !program ||
            !vao ||
            !renderTarget
        ) {
            return;
        }
        const mapSize = this.map.getSize();
        const { _2gisData } = this.deck.props as CustomRenderInternalProps;
        const gl = this.gl;

        if (_2gisData._2gisFramestart) {
            if (this.deck.width !== mapSize[0] || this.deck.height !== mapSize[1]) {
                (this.deck as any).animationLoop._resizeCanvasDrawingBuffer();
                (this.deck as any).animationLoop._resizeViewport();
                renderTarget.bind(this.gl);
                onMapResize(this.map, this.deck, renderTarget, msaaFrameBuffer);
            }
            msaaFrameBuffer
                ? gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer)
                : renderTarget.bind(gl);
            gl.clearColor(1, 1, 1, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            _2gisData._2gisCurrentViewport = undefined;
            _2gisData._2gisFramestart = false;
        } else {
            msaaFrameBuffer
                ? gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer)
                : renderTarget.bind(gl);
            gl.clearColor(1, 1, 1, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        renderTarget.unbind(gl);

        const needDraw = drawLayer(this.deck, this.map, this);

        if (needDraw && this.currentAntialiasingMode() !== 'none') {
            if (msaaFrameBuffer) {
                this.blitMsaaFrameBuffer();
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            const texture = renderTarget.getTexture();
            texture.enable(gl, 0);
            program.enable(gl);

            this.programmBinder();

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    };

    private programmBinder() {
        if (!this.deck || !this.map || !this.gl) {
            return;
        }
        const gl = this.gl;
        const program = (this.deck.props as CustomRenderInternalProps)._2glProgram;
        const vao = (this.deck.props as CustomRenderInternalProps)._2glVao;

        if (!program || !vao) {
            return;
        }

        const mapSize = this.map.getSize();

        if (this.currentAntialiasingMode() === 'fxaa') {
            program.bind(gl, {
                iResolution: [
                    mapSize[0] * window.devicePixelRatio,
                    mapSize[1] * window.devicePixelRatio,
                ],
                u_sr2d_texture: 0,
                enabled: 1,
            });
        } else {
            program.bind(gl, {
                u_sr2d_texture: 0,
            });
        }

        vao.bind({
            gl,
            extensions: { OES_vertex_array_object: gl.getExtension('OES_vertex_array_object') },
        });
    }

    private blitMsaaFrameBuffer() {
        const gl = this.gl;
        const msaaFrameBuffer = (this.deck?.props as CustomRenderInternalProps)._2glMsaaFrameBuffer;
        const renderTarget = (this.deck?.props as CustomRenderInternalProps)._2glRenderTarget;
        const mapSize = this.map?.getSize();
        if (msaaFrameBuffer && mapSize && gl && !(gl instanceof WebGLRenderingContext)) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaaFrameBuffer);

            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, (renderTarget as any)._frameBuffer);

            gl.clearBufferfv(gl.COLOR, 0, [0.0, 0.0, 0.0, 0.0]);

            gl.blitFramebuffer(
                0,
                0,
                mapSize[0] * window.devicePixelRatio,
                mapSize[1] * window.devicePixelRatio,
                0,
                0,
                mapSize[0] * window.devicePixelRatio,
                mapSize[1] * window.devicePixelRatio,
                gl.COLOR_BUFFER_BIT,
                gl.NEAREST,
            );
        }
    }

    private currentAntialiasingMode() {
        return (this.props?.deck.props as CustomRenderProps).antialiasing;
    }
}
