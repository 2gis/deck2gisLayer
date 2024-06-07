import type { Map, Polyline } from '@2gis/mapgl/types';
import { Deck2gisLayer, initDeck } from '../src';

declare global {
    interface Window {
        Deck2gisLayer: typeof Deck2gisLayer;
        Polyline: typeof Polyline;
        map: Map;
        deck2gisLayer: Deck2gisLayer;
        initDeck: initDeck;
        deckgl: any;
        polyline: mapgl.Polyline;
        sdk: any;
        Deck: any;
        HexagonLayer: any;
        ready: boolean;
    }
}
