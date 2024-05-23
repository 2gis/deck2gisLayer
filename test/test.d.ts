import type { Map } from '@2gis/mapgl/types';
import { Deck2gisLayer, initDeck } from '../src';

declare global {
    interface Window {
        map: Map;
        deck2gisLayer: Deck2gisLayer;
        Deck2gisLayer: typeof Deck2gisLayer;
        initDeck: initDeck;
        deckgl: any;
        sdk: any;
        Deck: any;
        HexagonLayer: any;
        ready: boolean;
    }
}
