import {pageSetUp, Page} from '../puppeteer';
import {API_KEY, DEFAULT_STYLE} from '../puppeteer/config';
import {
    makeScreenshotsPath,
    makeSnapshot,
    initMapWithOptions,
    defaultFontsPath,
    waitForMapReady,
} from '../puppeteer/utils';
import {HexagonLayer} from "@deck.gl/aggregation-layers/typed";
import * as puppeteer from "puppeteer";

describe('Base tests', () => {
    let page: Page;
    const dirPath = makeScreenshotsPath('plugin');
    beforeEach(async () => {
        page = await pageSetUp();
        await initMapWithOptions(page, {
            style: DEFAULT_STYLE,
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
        await waitForMapReady(page);
        await page.evaluate(() => {
            window.deckgl = window.initDeck(window.map, window.Deck, {antialiasing: 'msaa'});
        })
    });
    afterEach(async () => {
        await page.close();
    });

    async function addHexagonLayer(page: puppeteer.Page) {
        await page.evaluate(() => {
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

            const deckHexagonLayer = new window.Deck2gisLayer<HexagonLayer>({
                id: 'deckgl-HexagonLayer',
                deck: window.deckgl,
                type: window.HexagonLayer,
                data,
                radius: 480,
                getPosition: (d) => [d.point.lon, d.point.lat],
            });
            window.map.addLayer(deckHexagonLayer);
        });
    }

    it('add hexagon', async () => {
        await addHexagonLayer(page);
        await waitForMapReady(page);
        await makeSnapshot(page, dirPath, 'add_hexagon');
    });

    it('add and delete hexagon', async () => {
        await addHexagonLayer(page);
        await waitForMapReady(page);
        await page.evaluate(() => {
            window.map.removeLayer('deckgl-HexagonLayer')
        })
        await waitForMapReady(page);
        await makeSnapshot(page, dirPath, 'add_and_delete_hexagon');
    });

    it('resize viewport', async () => {
        await addHexagonLayer(page);
        await waitForMapReady(page);
        await page.setViewport({width: 200, height: 200})
        await page.evaluate(() => {
            window.map.invalidateSize()
        });
        await waitForMapReady(page);
        await makeSnapshot(page, dirPath, 'resize_viewport');
    });
});
