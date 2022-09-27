import { Deck2gisLayer } from '../src';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { Deck } from '@deck.gl/core';
import { data } from './data';
import { initDeck2gisProps } from '../src/utils';

declare global {
    const mapgl: any;
}
declare var window: any;

const map = new mapgl.Map('container', {
    center: [55.291748, 25.257678],
    zoom: 16.2,
    key: '4970330e-7f1c-4921-808c-0eb7c4e63001',
});

const deck = new Deck(initDeck2gisProps(map));

map.once('ready', () => initDeckGL());

function initDeckGL() {
    const deckLayer = createDeckLayer(data, map);
    map.addLayer(deckLayer);
}

const COLOR_RANGE = [
    [1, 152, 189],
    [73, 227, 206],
    [216, 254, 181],
    [254, 237, 177],
    [254, 173, 84],
    [209, 55, 78],
];

function createDeckLayer(data, map) {
    const poiLayer = new Deck2gisLayer({
        id: 'deckgl-pois',
        deck,
        type: HexagonLayer,
        data,
        opacity: 0.8,
        pickable: true,
        colorRange: COLOR_RANGE,
        parameters: {},
        radius: 80,
        elevationScale: 1,
        getPosition: (d: any) => [d.point.lon, d.point.lat],
        extruded: true,
    } as any);
    // todo need add call in map.addLayer(layer) for customLayer
    poiLayer.onAdd(map);
    return poiLayer;
}

window.addEventListener('resize', () => map.invalidateSize());
