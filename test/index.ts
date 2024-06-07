import { Deck2gisLayer, initDeck } from '../src';
import { Deck } from '@deck.gl/core/typed';
import { HexagonLayer } from '@deck.gl/aggregation-layers/typed';

window.Deck2gisLayer = Deck2gisLayer;
window.initDeck = initDeck;
window.Deck = Deck;
window.HexagonLayer = HexagonLayer;
window.Polyline = mapgl.Polyline;
