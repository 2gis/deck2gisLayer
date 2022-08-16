import { Deck, WebMercatorViewport, MapView } from '@deck.gl/core';
import type { Layer, DeckProps, MapViewState } from '@deck.gl/core';
import type { Map } from '@2gis/mapgl/types';

import { DeckCustomLayer } from './types';
import { Deck2gisLayer } from './deckgl2gisLayer';

type UserData = {
    isExternal: boolean;
    currentViewport?: WebMercatorViewport | null;
    customLayers: Set<DeckCustomLayer>;
};

export function getDeckInstance({
    map,
    gl,
    deck,
}: {
    map: Map & { __deck?: Deck | null };
    gl: WebGLRenderingContext;
    deck?: Deck;
}): Deck {
    // Only create one deck instance per context
    if (map.__deck) {
        return map.__deck;
    }

    const customRender = deck?.props._customRender;

    const deckProps: DeckProps = {
        useDevicePixels: true,
        _customRender: (reason: string) => {
            // todo  need change to public rerender method in mapgl
            (map as any)._impl.state.needRerender = true;
            // customRender may be subscribed by DeckGL React component to update child props
            // make sure it is still called
            customRender?.(reason);
        },
        // TODO: import these defaults from a single source of truth
        parameters: {
            depthMask: true,
            depthTest: true,
            blend: true,
            blendFunc: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA],
            polygonOffsetFill: true,
            depthFunc: gl.LEQUAL,
            blendEquation: gl.FUNC_ADD,
        },
        views: (deck && deck.props.views) || [new MapView({ id: '2gis' })],
    };

    let deckInstance: Deck;

    if (!deck || deck.props.gl === gl) {
        // deck is using the WebGLContext created by 2gis
        // block deck from setting the canvas size
        Object.assign(deckProps, {
            gl,
            width: null,
            height: null,
            touchAction: 'unset',
            viewState: getViewState(map),
        });
        // If using the WebGLContext created by deck (React use case), we use deck's viewState to drive the map.
        // Otherwise (pure JS use case), we use the map's viewState to drive deck.
        map.on('move', () => onMapMove(deckInstance, map));
    }

    if (deck) {
        deckInstance = deck;
        deck.setProps(deckProps);
        (deck.userData as UserData).isExternal = true;
    } else {
        deckInstance = new Deck(deckProps);
        // todo need wait new mapgl version with this event
        (map as any).on('destroy', () => {
            deckInstance.finalize();
            map.__deck = null;
        });
    }

    (deckInstance.userData as UserData).customLayers = new Set();
    map.__deck = deckInstance;
    return deckInstance;
}

export function addLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    (deck.userData as UserData).customLayers.add(layer);
    updateLayers(deck);
}

export function removeLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    (deck.userData as UserData).customLayers.delete(layer);
    updateLayers(deck);
}

export function updateLayer(deck: Deck, _layer: Deck2gisLayer<any>): void {
    updateLayers(deck);
}

export function drawLayer(deck: Deck, map: Map, layer: Deck2gisLayer<any>): void {
    let { currentViewport } = deck.userData as UserData;
    let clearStack = false;
    if (!currentViewport) {
        // This is the first layer drawn in this render cycle.
        // Generate viewport from the current map state.
        currentViewport = getViewport(deck, map, true);
        (deck.userData as UserData).currentViewport = currentViewport;
        clearStack = true;
    }

    if (!deck.isInitialized) {
        return;
    }

    deck._drawLayers('2gis-repaint', {
        viewports: [currentViewport],
        layerFilter: ({ layer: deckLayer }) => layer.id === deckLayer.id,
        clearStack,
        clearCanvas: false,
    });
}

export function getViewState(map: Map): MapViewState & {
    repeat: boolean;
    padding: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
} {
    const [lng, lat] = map.getCenter();

    const viewState: MapViewState & {
        repeat: boolean;
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

function getViewport(deck: Deck, map: Map, useMapboxProjection = true): WebMercatorViewport {
    return new WebMercatorViewport(
        Object.assign(
            {
                id: 'mapbox',
                x: 0,
                y: 0,
                width: deck.width,
                height: deck.height,
            },
            getViewState(map),
            useMapboxProjection
                ? {
                      nearZMultiplier: 1 / (deck.height || 1),
                  }
                : {
                      // use deck.gl's own default
                      nearZMultiplier: 0.1,
                  },
        ),
    );
}

function onMapMove(deck: Deck, map: Map): void {
    deck.setProps({
        viewState: getViewState(map),
    });
    // Camera changed, will trigger a map repaint right after this
    // Clear any change flag triggered by setting viewState so that deck does not request
    // a second repaint
    deck.needsRedraw({ clearRedrawFlags: true });
}

function updateLayers(deck: Deck): void {
    if ((deck.userData as UserData).isExternal) {
        return;
    }

    const layers: Layer[] = [];
    (deck.userData as UserData).customLayers.forEach((deckLayer) => {
        const LayerType = deckLayer.props.type;
        const layer = new LayerType(deckLayer.props);
        layers.push(layer);
    });
    deck.setProps({ layers });
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
    const { view } = correctViewAndSize((map as any)._impl.state);
    if (view.y > 0) {
        return (100 / view.y) * fov;
    }
    return fovy;
}

function correctViewAndSize(state) {
    const { size, pitch, padding } = state;

    const correctedPaddingTopScreen = Math.max(0, padding.top - padding.bottom) * Math.tan(pitch);
    const correctedScreenHeightWithPadding =
        correctScreenHeight(size[1]) + correctedPaddingTopScreen;

    // Определяем область просмотра
    const view = {
        x: (padding.right - padding.left) / 2,
        y: (padding.bottom - padding.top) / 2,
        width: size[0],
        height: size[1],
    };

    // Дополнительно сдвигаем область просмотра под фактическую высоту экрана
    view.y += (correctedScreenHeightWithPadding - size[1]) / 2;

    return { view };
}

function correctScreenHeight(height: number): number {
    const minCalculationScreenHeight = 1000;
    return Math.max(height, minCalculationScreenHeight);
}
