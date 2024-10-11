import { Deck2gisLayer } from '../src';
import { HeatmapLayer, HexagonLayer } from '@deck.gl/aggregation-layers/typed';
import { TextLayer } from '@deck.gl/layers';
import { Color, Deck } from '@deck.gl/core/typed';
import { data } from './data';
import { initDeck } from '../src/utils';

declare const mapgl: any;

const map = new mapgl.Map('container', {
    center: [55.291748, 25.237678],
    zoom: 14.1,
    pitch: 40,
    key: '4970330e-7f1c-4921-808c-0eb7c4e63001',
    webglVersion: 2,
});

let deck;
map.once('idle', () => {
    deck = initDeck(map, Deck, { antialiasing: 'msaa' });
    initDeckGL();
});

const buildingLayer = {
    id: 'house private',
    name: 'Частные дома',
    type: 'polygonExtrusion',
    style: {
        topColor: '#00ff00',
        sideColor: 'rgba(255,62,54,0.82)',
    },
    filter: ['match', ['get', 'sublayer'], ['Technical_house'], true, false],
    minzoom: 16,
    metadata: {
        group: {
            id: '746776',
        },
    },
};

function initDeckGL() {
    const deckLayer1 = createHeatmapLayer(data);
    map.addLayer(deckLayer1);
    const deckLayer2 = createHexagonLayer(data);
    map.addLayer(deckLayer2);
    const deckLayer3 = createHexagonLayer2(data);
    map.addLayer(deckLayer3);
    const deckLayer4 = createTextlayer(data);
    map.addLayer(deckLayer4);
    map.removeLayer('deckgl-HexagonLayer');
    map.addLayer(deckLayer2);
    map.addLayer(buildingLayer);
}

const COLOR_RANGE: Color[] = [
    [1, 152, 189],
    [73, 227, 206],
    [216, 254, 181],
    [254, 237, 177],
    [254, 173, 84],
    [209, 55, 78],
];

function getCharacters() {
    const charSet = 'МмЛлРрДдНнKkMmКкМм1234567890'.split('');

    for (let i = 32; i < 128; i++) {
        // eslint-disable-next-line functional/immutable-data
        charSet.push(String.fromCharCode(i));
    }

    return charSet;
}

export const characterSet = getCharacters();

function createTextlayer(data) {
    const layer = new Deck2gisLayer<TextLayer>({
        id: 'text-layer',
        data,
        deck,
        type: TextLayer,
        characterSet,
        fontFamily: 'SBSansText, Helvetica, Arial, sans-serif',
        getBackgroundColor: [66, 0, 255, 66],
        getColor: [255, 128, 0],
        getPosition: (d) => [d.point.lon, d.point.lat],
        getText: (d) => '' + d.values.capacity,
        getSize: 14,
        background: true,
    });

    return layer;
}

function createHeatmapLayer(data) {
    const layer = new Deck2gisLayer<HeatmapLayer>({
        id: 'deckgl-HeatmapLayer',
        deck,
        colorRange: COLOR_RANGE,
        type: HeatmapLayer,
        data,
        parameters: { depthTest: false },
        getWeight: (d) => d.values.capacity,
        getPosition: (d) => [d.point.lon, d.point.lat],
    });

    return layer;
}
function createHexagonLayer(data) {
    const layer = new Deck2gisLayer<HexagonLayer>({
        id: 'deckgl-HexagonLayer',
        deck,
        colorRange: COLOR_RANGE,
        type: HexagonLayer,
        data,
        parameters: { depthTest: true },
        opacity: 0.4,
        radius: 380,
        elevationScale: 2,
        getPosition: (d: any) => [d.point.lon, d.point.lat],
        extruded: true,
    });

    return layer;
}

function createHexagonLayer2(data) {
    const layer = new Deck2gisLayer<HexagonLayer>({
        id: 'deckgl-HexagonLayer2',
        deck,
        colorRange: COLOR_RANGE,
        type: HexagonLayer,
        data,
        parameters: { depthTest: true },
        opacity: 0.5,
        radius: 500,
        elevationScale: 1,
        getPosition: (d: any) => [d.point.lon, d.point.lat],
        extruded: false,
    });

    return layer;
}

window.addEventListener('resize', () => map.invalidateSize());
