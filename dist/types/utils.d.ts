import type { Map } from '@2gis/mapgl/types';
import { CustomRenderProps, RenderProps } from './types';
import { DeckProps } from '@deck.gl/core/typed';
/**
 * Initializes deck.gl properties for working with the MapGL map.
 * @param map The map instance.
 * @param deckProps CustomRenderProps initialization options.
 */
export declare function initDeck2gisProps(map: Map, deckProps?: RenderProps | CustomRenderProps): DeckProps;
