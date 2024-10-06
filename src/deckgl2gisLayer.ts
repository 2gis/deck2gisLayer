// Use fork mapbox layer in deck.gl
// https://github.com/visgl/deck.gl/tree/master/modules/mapbox

import { addLayer, removeLayer, updateLayer, drawLayer, initDeck, onMapResize } from './utils';
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
    props: LayerProps<LayerT> | undefined;
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
    antialiasing: boolean;
    isDestroyed: boolean;

    /**
     * Initializes deck.gl instance for working with the MapGL map.
     * @param map The map instance.
     * @param Deck The Deck.gl class
     * @param deckProps CustomRenderProps initialization options.
     */
    static initDeck = (map: Map, Deck: any, deckProps?: CustomRenderProps) =>
        initDeck(map, Deck, deckProps);

    /* eslint-disable no-this-before-super */
    /**
     * Example:
     * ```js
     * const deckLayer = new mapgl.Deck2gisLayer(map, Deck, {
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
        this.props = props;
        this.gl = (
            this.props.deck.props as CustomRenderInternalProps
        )._2gisData._2gisMap.getWebGLContext();
        this.antialiasing = Boolean(props.antialiasing);
    }

    /**
     * @hidden
     * @internal
     * MapGL calls this method after adding a layer to a map.
     */
    public onAdd = () => {
        if (this.props?.deck && !this.isDestroyed) {
            addLayer(this.props.deck, this);
        }
    };
    /**
     * @hidden
     * @internal
     * MapGL calls this method after removing a layer from a map.
     */
    public onRemove = () => {
        if (this.props && this.props.deck) {
            removeLayer(this.props.deck, this);
        }
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
            if (this.props.deck) {
                updateLayer(this.props.deck, this);
            }
        }
    }

    /**
     * Destroys the layer and frees all related resources.
     */
    public destroy = () => {
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
        if (!this.props || !(this.props?.deck as any)?.props) {
            return;
        }
        const renderTarget = (this.props.deck as any).props._2glRenderTarget;
        const msaaFrameBuffer = (this.props.deck as any).props._2glMsaaFrameBuffer;
        const program = (this.props.deck as any).props._2glProgram;
        const vao = (this.props.deck as any).props._2glVao;

        if (
            this.isDestroyed ||
            !this.props.deck ||
            !(this.props.deck as any)?.layerManager ||
            !(this.props.deck.props as CustomRenderInternalProps)._2gisData._2gisMap ||
            !renderTarget ||
            !program ||
            !vao ||
            !this.gl ||
            !this.props ||
            !(this.props.deck.props as CustomRenderInternalProps)._2glRenderTarget ||
            !(this.props.deck.props as CustomRenderInternalProps)._2gisInitDeck
        ) {
            return;
        }
        (this.props.deck as any).glStateStore.useDeckWebglState();

        const mapSize = (
            this.props.deck.props as CustomRenderInternalProps
        )._2gisData._2gisMap.getSize();
        const { _2gisData } = this.props.deck.props as CustomRenderInternalProps;
        const gl = this.gl;
        const clearColor = (this.props as any)?.parameters?.clearColor || [1, 1, 1];

        if (_2gisData._2gisFramestart) {
            if (this.props.deck.width !== mapSize[0] || this.props.deck.height !== mapSize[1]) {
                (this.props.deck as any).animationLoop._resizeCanvasDrawingBuffer();
                (this.props.deck as any).animationLoop._resizeViewport();
                renderTarget.bind(this.gl);
                onMapResize(
                    (this.props.deck.props as CustomRenderInternalProps)._2gisData._2gisMap,
                    this.props.deck,
                    renderTarget,
                    msaaFrameBuffer,
                );
            }
            msaaFrameBuffer
                ? gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer)
                : renderTarget.bind(gl);
            gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 0);
            gl.clearDepth(1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            _2gisData._2gisCurrentViewport = undefined;
            _2gisData._2gisFramestart = false;
        } else {
            msaaFrameBuffer
                ? gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer)
                : renderTarget.bind(gl);
            gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        renderTarget.unbind(gl);

        const isDrawed = drawLayer(
            this.props.deck,
            (this.props.deck.props as CustomRenderInternalProps)._2gisData._2gisMap,
            this,
        );
        if (!isDrawed) {
            (this.props.deck as any).glStateStore.useMapglWebglState();
            return;
        }

        if (msaaFrameBuffer) {
            this.blitMsaaFrameBuffer();
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const texture = renderTarget.getTexture();
        texture.enable(gl, 0);
        program.enable(gl);

        this.programmBinder();

        gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.depthMask(true);

        (this.props.deck as any).glStateStore.useMapglWebglState();
    };

    private programmBinder() {
        const program = (this.props?.deck as any)?.props?._2glProgram;
        const vao = (this.props?.deck as any)?.props?._2glVao;
        if (
            !this.props?.deck ||
            !(this.props.deck.props as CustomRenderInternalProps)._2gisData._2gisMap ||
            !program ||
            !vao ||
            !this.gl
        ) {
            return;
        }

        const mapSize = (
            this.props.deck.props as CustomRenderInternalProps
        )._2gisData._2gisMap.getSize();
        const gl = this.gl;
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
        const mapSize = (
            this.props?.deck.props as CustomRenderInternalProps
        )._2gisData._2gisMap?.getSize();
        const msaaFrameBuffer = (this.props?.deck as any)?.props?._2glMsaaFrameBuffer;
        const renderTarget = (this.props?.deck as any)?.props?._2glRenderTarget;
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
