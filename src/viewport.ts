import { WebMercatorViewport } from '@deck.gl/core/typed';
import type { Map } from '@2gis/mapgl/types';
import { WebMercatorViewportOptions } from '@deck.gl/core/typed/viewports/web-mercator-viewport';

export class MapglMercatorViewport extends WebMercatorViewport {
    constructor(map: Map) {
        const [width, height] = map.getSize();

        super(
            Object.assign(
                {
                    id: '2gis',
                    x: 0,
                    y: 0,
                    width,
                    height,
                },
                getViewState(map),
                {
                    nearZMultiplier: 1 / (height || 1),
                },
            ),
        );
    }

    get projectionMode() {
        return 4;
    }
}

export function getViewState(map: Map): WebMercatorViewportOptions & {
    padding: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
} {
    const [lng, lat] = map.getCenter();
    const viewState: WebMercatorViewportOptions & {
        padding: {
            left: number;
            right: number;
            top: number;
            bottom: number;
        };
    } = {
        // Longitude returned by getCenter can be outside of [-180, 180] when zooming near the anti meridian
        // https://github.com/visgl/deck.gl/issues/6894
        longitude: ((lng + 540) % 360) - 180,
        latitude: lat,
        zoom: getZoom(map),
        bearing: getBearing(map),
        pitch: map.getPitch(),
        padding: map.getPadding(),
        repeat: getRenderWorldCopies(),
        fovy: fovCorrection(map, 60, true),
    };

    return viewState;
}

function getZoom(map: Map) {
    return map.getZoom() - 1;
}

function getRenderWorldCopies() {
    return false;
}

function getBearing(map: Map) {
    return -map.getRotation();
}

function fovCorrection(map: Map, fovy: number, needCorrect?: boolean) {
    if (!needCorrect) {
        return fovy;
    }
    const cameraConfig = { fov: fovy, near: 1000 };
    const { fov } = cameraConfig;
    const height = correctViewAndSize((map as any)._impl.state);
    if (height > 100) {
        return (100 / height) * fov;
    }
    return fovy;
}

function correctViewAndSize(state) {
    const { size, pitch, padding } = state;

    const correctedPaddingTopScreen = Math.max(0, padding.top - padding.bottom) * Math.tan(pitch);
    const correctedScreenHeightWithPadding =
        correctScreenHeight(size[1]) + correctedPaddingTopScreen;

    return (padding.bottom - padding.top) / 2 + (correctedScreenHeightWithPadding - size[1]) / 2;
}

function correctScreenHeight(height: number): number {
    const minCalculationScreenHeight = 1000;
    return Math.max(height, minCalculationScreenHeight);
}
