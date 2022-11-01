import { Deck2gisLayer } from '../src';
import { HeatmapLayer, HexagonLayer } from '@deck.gl/aggregation-layers';
import { Deck, RGBAColor } from '@deck.gl/core';
import { data } from './data';
import { initDeck2gisProps } from '../src/utils';

declare const mapgl: any;

const map = new mapgl.Map('container', {
    center: [55.291748, 25.237678],
    zoom: 14.1,
    pitch: 40,
    key: '4970330e-7f1c-4921-808c-0eb7c4e63001',
});

const deck = new Deck(initDeck2gisProps(map));
map.once('ready', () => {
    initDeckGL();
});

function initDeckGL() {
    const deckLayer = createHeatmapLayer(data);
    map.addLayer(deckLayer);
    const deckLayer2 = createHexagonLayer(data);
    map.addLayer(deckLayer2);
    const deckLayer3 = createHexagonLayer2(data);
    map.addLayer(deckLayer3);
}

const COLOR_RANGE: RGBAColor[] = [
    [1, 152, 189],
    [73, 227, 206],
    [216, 254, 181],
    [254, 237, 177],
    [254, 173, 84],
    [209, 55, 78],
];

function createHeatmapLayer(data) {
    const layer = new Deck2gisLayer<HeatmapLayer<any>>({
        id: 'deckgl-HeatmapLayer',
        deck,
        colorRange: COLOR_RANGE,
        type: HeatmapLayer,
        data,
        parameters: { depthTest: false },
        getWeight: (d) => d.values.capacity,
        getPosition: (d) => [d.point.lon, d.point.lat],
    });

    layer.onAdd();

    return layer;
}
function createHexagonLayer(data) {
    const layer = new Deck2gisLayer<HexagonLayer<any>>({
        id: 'deckgl-HexagonLayer',
        deck,
        colorRange: COLOR_RANGE,
        type: HexagonLayer,
        data,
        parameters: { depthTest: true },
        opacity: 0.8,
        radius: 480,
        elevationScale: 2,
        getPosition: (d: any) => [d.point.lon, d.point.lat],
        extruded: true,
        antialiasing: true,
    });

    layer.onAdd();
    return layer;
}

function createHexagonLayer2(data) {
    const layer = new Deck2gisLayer<HexagonLayer<any>>({
        id: 'deckgl-HexagonLayer2',
        deck,
        colorRange: COLOR_RANGE,
        type: HexagonLayer,
        data,
        parameters: { depthTest: true },
        opacity: 0.2,
        radius: 700,
        elevationScale: 1,
        getPosition: (d: any) => [d.point.lon, d.point.lat],
        extruded: true,
    });

    layer.onAdd();
    return layer;
}

window.addEventListener('resize', () => map.invalidateSize());
