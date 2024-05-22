import { pageSetUp, Page } from '../puppeteer';
import { API_KEY } from '../puppeteer/config';
import {
    makeScreenshotsPath,
    makeSnapshot,
    initMapWithOptions,
    waitForReadiness,
    defaultFontsPath,
} from '../puppeteer/utils';
import {HexagonLayer} from "@deck.gl/aggregation-layers/typed";
import { sleep } from '../utils';

describe('plugin', () => {
    let page: Page;
    const dirPath = makeScreenshotsPath('plugin');
    beforeEach(async () => {
        page = await pageSetUp();
        await initMapWithOptions(page, {
            style: 'eb10e2c3-3c28-4b81-b74b-859c9c4cf47e',
            // style: blankStyle,
            styleOptions: {
                fontsPath: defaultFontsPath,
            },
            // @ts-ignore
            copyright: false,
            zoomControl: false,
            key: API_KEY,
            zoom: 12.5,
            center: [55.296872, 25.261885],
        });
        await waitForReadiness(page);
    });
    afterEach(async () => {
        await page.close();
    });


    it('add hexagon', async () => {
        await page.evaluate( () => {
        // @ts-ignore
        const deckgl = window.initDeck(window.map, window.Deck, {antialiasing: 'msaa'});
        // @ts-ignore
        const data = [
            {
                point: {
                    lon: 55.296872,
                    lat: 25.261885,
                },
            },
            {
                point: {
                    lon: 55.296644,
                    lat: 25.262364,
                },
            },
            {
                point: {
                    lon: 55.299031,
                    lat: 25.254415,
                },
            },
            {
                point: {
                    lon: 55.299031,
                    lat: 25.254415,
                },
            },
        ];
        // @ts-ignore
        const deckHexagonLayer = new window.Deck2gisLayer<HexagonLayer>({
            id: 'deckgl-HexagonLayer',
            deck: deckgl,
            type: window.HexagonLayer,
            data,
            radius: 480,
            getPosition: (d) => [d.point.lon, d.point.lat],
        });
        
            window.map.addLayer(deckHexagonLayer);
       
        });

        await sleep(8000);
        await makeSnapshot(page, dirPath, 'add_hexagon');
    });
});
