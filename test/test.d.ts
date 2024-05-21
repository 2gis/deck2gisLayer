import type {Map} from '@2gis/mapgl/types';
import {Deck2gisLayer, initDeck} from '../src';
import {Deck} from '@deck.gl/core/typed';


declare global {
    interface Window {
        map: Map;
        deck2gisLayer: Deck2gisLayer,
        Deck2gisLayer: typeof Deck2gisLayer,
        initDeck: initDeck,
        Deck: Deck,
        ready: boolean;
    }
}
