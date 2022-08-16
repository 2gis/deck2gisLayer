import { Deck2gisLayer } from '../src';
import { HexagonLayer } from '@deck.gl/aggregation-layers';

declare global {
    const mapgl: any;
}
declare var window: any;

const map = new mapgl.Map('container', {
    center: [55.31878, 25.23584],
    zoom: 16.2,
    key: '4970330e-7f1c-4921-808c-0eb7c4e63001',
});
initDeckGL();

async function initDeckGL() {
    console.log('Layer data - Loading...');
    fetch(
        'https://urbi-geo-api-staging2.web-staging.2gis.ru/building/items/values?tag=floors_count,height&bounds=POLYGON+((55.13142+25.544679,+55.203999+25.567715,+55.279599+25.566579,+55.43176+25.759947,+55.55436+25.811148,+55.666094+25.897751,+55.76817+25.925981,+55.826597+26.007005,+55.888369+26.151722,+56.086425+26.050441,+56.15912+26.062127,+56.195513+25.979301,+56.163975+25.946893,+56.177561+25.892732,+56.139167+25.8325,+56.1725+25.769167,+56.140833+25.735,+56.143611+25.676111,+56.191111+25.648056,+56.201874+25.611984,+56.253291+25.60219,+56.266328+25.606335,+56.254586+25.613159,+56.264173+25.627665,+56.418384+25.682657,+56.549221+25.692716,+56.591385+25.549234,+56.602446+25.323577,+56.585359+25.087633,+56.594079+25.007481,+56.323288+24.972644,+56.348923+24.934376,+56.338442+24.914535,+56.259358+24.859817,+56.205659+24.850507,+56.201022+24.784219,+56.144333+24.741556,+56.060585+24.746639,+56.036157+24.810922,+55.978341+24.877363,+55.980164+24.894492,+56.062185+24.870801,+56.042048+24.886589,+56.058722+24.949126,+56.042075+24.947686,+56.045483+24.967887,+56.006871+24.994727,+55.960882+25.005958,+55.910907+24.965663,+55.851301+24.965812,+55.812409+24.910874,+55.836502+24.671031,+55.793833+24.637012,+55.816207+24.615223,+55.767784+24.572526,+55.764989+24.52949,+55.834202+24.409554,+55.833944+24.327733,+55.759405+24.261142,+55.752895+24.234821,+55.833523+24.200902,+55.954447+24.222568,+55.969652+24.182449,+55.960753+24.170318,+56.017506+24.066605,+55.902317+24.046941,+55.833035+24.01459,+55.801126+24.025482,+55.781754+24.055948,+55.731246+24.058066,+55.485274+23.944384,+55.533725+23.849352,+55.531869+23.757286,+55.569228+23.720734,+55.572308+23.629646,+55.452588+23.465217,+55.430691+23.399593,+55.416507+23.382151,+55.401537+23.392525,+55.232271+23.110348,+55.216283+23.02621,+55.227508+22.791619,+55.21284+22.705686,+55.137388+22.631591,+52.58104+22.939203,+51.590376+24.126971,+51.589825+24.26588,+51.529512+24.336352,+51.416071+24.393194,+51.466454+24.462489,+51.565206+24.553035,+51.589187+24.619704,+51.586122+24.664189,+52.02542+24.75828,+52.309194+24.842176,+52.378334+24.900336,+52.337088+24.949252,+52.345961+24.997718,+52.405921+25.018775,+52.450032+24.982958,+52.647202+25.143128,+52.894479+25.470458,+54.182354+25.450646,+55.13142+25.544679))',
    )
        .then((response) => {
            return response.json();
        })
        .then((d) => {
            console.log('Layer data - Loaded');
            const data = d.items;
            const deckLayer = createDeckLayer(data, map);
            map.addLayer(deckLayer);
        });
}

function createDeckLayer(data, map) {
    const poiLayer = new Deck2gisLayer({
        id: 'deckgl-pois',
        type: HexagonLayer,
        data,
        opacity: 0.4,
        pickable: true,

        parameters: {
            depthTest: false,
        },
        radius: 100,
        elevationScale: 4,
        getPosition: (d: any) => [d.point.lon, d.point.lat],
        extruded: false,
    } as any);
    // todo need add call in map.addLayer(layer) for customLayer
    poiLayer.onAdd(map, map.getWebGLContext());
    return poiLayer;
}

window.addEventListener('resize', () => map.invalidateSize());
