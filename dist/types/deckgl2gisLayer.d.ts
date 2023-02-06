import type { Deck, Layer } from '@deck.gl/core/typed';
import { CustomRenderProps, DeckCustomLayer } from './types';
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
export declare class Deck2gisLayer<LayerT extends Layer> implements DeckCustomLayer {
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
    static initDeck2gisProps: (map: Map, deckProps?: CustomRenderProps) => import("@deck.gl/core/typed").DeckProps;
    private frameBuffer?;
    private program?;
    private vao?;
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
    constructor(props: LayerProps<LayerT>);
    /**
     * Sets layer properties and updates the layer.
     * @param props deck.gl layer properties.
     */
    setProps(props: Partial<LayerProps<LayerT>>): void;
}
