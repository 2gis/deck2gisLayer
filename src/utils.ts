import { MapView } from '@deck.gl/core';
import type { Deck } from '@deck.gl/core';
import type { Layer } from '@deck.gl/core';
import type { Map } from '@2gis/mapgl/types';

import { Deck2gisLayer } from './deckgl2gisLayer';
import type { DeckProps } from 'deck.gl';
import { getViewState, MapglMercatorViewport } from './viewport';

export function prepareDeckInstance({
    map,
    gl,
    deck,
}: {
    map: Map & { __deck?: Deck | null };
    gl: WebGLRenderingContext;
    deck?: Deck;
}): Deck | null {
    // Only create one deck instance per context
    if (map.__deck) {
        return map.__deck;
    }

    const customRender = deck && (deck?.props as any)?._customRender;

    const customRenderProp: any = {
        useDevicePixels: true,
        _customRender: (reason: string) => {
            // todo  need change to public rerender method in mapgl map.triggerRedraw()
            (map as any)._impl.state.needRerender = true;
            // customRender may be subscribed by DeckGL React component to update child props
            // make sure it is still called
            customRender?.(reason);
        },
    };

    const deckProps = initDeck2gisProps(map, customRenderProp);

    let deckInstance: Deck;

    if (!deck || deck.props.gl === gl) {
        // deck is using the WebGLContext created by 2gis
        // block deck from setting the canvas size
        Object.assign(deckProps, {
            gl,
            width: false,
            height: false,
            touchAction: 'unset',
            viewState: getViewState(map),
        });
        // If using the WebGLContext created by deck (React use case), we use deck's viewState to drive the map.
        // Otherwise (pure JS use case), we use the map's viewState to drive deck.
        map.on('move', () => onMapMove(deckInstance, map));
    }

    if (deck) {
        deckInstance = deck as Deck;
        deckInstance.setProps(deckProps);
        deckInstance.props.userData.isExternal = false;
    } else {
        return null;
    }

    map.__deck = deckInstance;
    return deckInstance;
}

export function addLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    deck.props.userData.customLayers.add(layer);
    updateLayers(deck);
}

export function removeLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    deck.props.userData.customLayers.delete(layer);
    updateLayers(deck);
}

export function updateLayer(deck: Deck, _layer: Deck2gisLayer<any>): void {
    updateLayers(deck);
}

export function drawLayer(deck: Deck, map: Map, layer: Deck2gisLayer<any>): void {
    let { currentViewport } = deck.props.userData;
    if (!currentViewport) {
        // This is the first layer drawn in this render cycle.
        // Generate viewport from the current map state.
        currentViewport = getViewport(map);
        deck.props.userData.currentViewport = currentViewport;
    }

    if (!(deck as any).layerManager) {
        return;
    }

    stateBinder(map, layer);

    deck._drawLayers('2gis-repaint', {
        viewports: [currentViewport],
        layerFilter: ({ layer: deckLayer }) => layer.id === deckLayer.id,
        clearCanvas: false,
    });
}

function getViewport(map: Map): MapglMercatorViewport | undefined {
    if (!map) {
        return undefined;
    }

    return new MapglMercatorViewport(map);
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
    if (deck.props.userData.isExternal) {
        return;
    }

    const layers: Layer<any>[] = [];
    let layerIndex = 0;
    deck.props.userData.customLayers.forEach((deckLayer) => {
        const LayerType = deckLayer.props.type;
        const layer = new LayerType(deckLayer.props, { _offset: layerIndex++ });
        layers.push(layer);
    });
    deck.setProps({ layers });
}

export function initDeck2gisProps(map: Map, deckProps?: DeckProps): DeckProps {
    const gl = map.getWebGLContext();
    const deck2gisProps: any = {
        ...deckProps,
        parameters: {
            depthMask: true,
            depthTest: true,
            blend: true,
            blendFunc: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA],
            polygonOffsetFill: true,
            depthFunc: gl.LEQUAL,
            blendEquation: gl.FUNC_ADD,
        },
        userData: {
            isExternal: false,
            customLayers: new Set(),
            map,
        },
        views: [new MapView({ id: '2gis' })],
    };
    // deck is using the WebGLContext created by 2gis
    // block deck from setting the canvas size
    Object.assign(deck2gisProps, {
        gl,
        width: null,
        height: null,
        touchAction: 'unset',
        viewState: getViewState(map),
    });
    return deck2gisProps;
}

// Fix heatmap layer render: need reset gl state after each draw layers
function stateBinder(map: Map, layer: Deck2gisLayer<any>) {
    const gl = map.getWebGLContext();
    if (!layer.props.parameters.cullFaceEnabled) {
        gl.disable(gl.CULL_FACE);
    }
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
}
