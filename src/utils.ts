import { MapView } from '@deck.gl/core';
import type { Deck, Layer } from '@deck.gl/core/typed';
import type { Map } from '@2gis/mapgl/types';

import { Deck2gisLayer } from './deckgl2gisLayer';
import { getViewState, MapglMercatorViewport } from './viewport';
import Vao from '2gl/Vao';
import Buffer from '2gl/Buffer';
import ShaderProgram from '2gl/ShaderProgram';
import RenderTarget from '2gl/RenderTarget';
import Shader from '2gl/Shader';

import fill_fsh from './optimized.fsh';
import fill_vsh from './optimized.vsh';
import { CustomRenderProps } from './types';
import { DeckProps } from '@deck.gl/core/typed';

export function prepareDeckInstance({
    map,
    gl,
    deck,
    renderTarget,
}: {
    map: Map & { __deck?: Deck | null };
    gl: WebGLRenderingContext;
    deck?: Deck;
    renderTarget: RenderTarget;
}): Deck | null {
    // Only create one deck instance per context
    if (map.__deck) {
        return map.__deck;
    }

    const customRender = deck && (deck?.props as any)?._customRender;
    const program = createProgram();
    const vao = createVao(program);

    const customRenderProps: CustomRenderProps = {
        useDevicePixels: true,
        _2gisFramestart: false,
        _2glRenderTarget: renderTarget,
        _2glProgram: program,
        _2glVao: vao,
        _framebuffer: (renderTarget as any)._frameBuffer,
        _customRender: (reason: string) => {
            // todo  need change to public rerender method in mapgl map.triggerRedraw()
            (map as any)._impl.state.needRerender = true;
            // customRender may be subscribed by DeckGL React component to update child props
            // make sure it is still called
            customRender?.(reason);
        },
    };

    const deckProps = initDeck2gisProps(map, customRenderProps);

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
    } else {
        return null;
    }
    (map as any)._impl.on('framestart', () => ((deck.props as CustomRenderProps)._2gisData._2gisFramestart = true));
    map.on('resize', () => onMapResize(map, deck, renderTarget));
    map.__deck = deckInstance;
    return deckInstance;
}

export function addLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    (deck.props as CustomRenderProps)._2gisData._2gisCustomLayers.add(layer);
    updateLayers(deck);
}

export function removeLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    (deck.props as CustomRenderProps)._2gisData._2gisCustomLayers.delete(layer);
    updateLayers(deck);
}

export function updateLayer(deck: Deck, _layer: Deck2gisLayer<any>): void {
    updateLayers(deck);
}

export function drawLayer(deck: Deck, map: Map, layer: Deck2gisLayer<any>): void {
    let currentViewport = (deck.props as CustomRenderProps)._2gisData._2gisCurrentViewport;
    if (!currentViewport) {
        // This is the first layer drawn in this render cycle.
        // Generate viewport from the current map state.
        currentViewport = getViewport(map);
        (deck.props as CustomRenderProps)._2gisData._2gisCurrentViewport = currentViewport;
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

function onMapResize(map: Map, deck: Deck, renderTarget: RenderTarget) {
    const mapSize = map.getSize();
    const gl = map.getWebGLContext();
    const size = [mapSize[0] * window.devicePixelRatio, mapSize[1] * window.devicePixelRatio];
    renderTarget.setSize(size);
    renderTarget.bind(gl);
    deck.props._framebuffer = (renderTarget as any)._frameBuffer;
    renderTarget.unbind(gl);
}

function updateLayers(deck: Deck): void {
    const layers: Layer<any>[] = [];
    let layerIndex = 0;
    (deck.props as CustomRenderProps)._2gisData._2gisCustomLayers.forEach((deckLayer) => {
        const LayerType = deckLayer.props.type;
        const layer = new LayerType(deckLayer.props, { _offset: layerIndex++ });
        layers.push(layer);
    });
    deck.setProps({ layers });
}

export function initDeck2gisProps(map: Map, deckProps?: CustomRenderProps): DeckProps {
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
        _2gisData: {
            _2gisCustomLayers: new Set(),
            _2gisMap: map,
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

export function createVao(program: ShaderProgram) {
    const screenVertices = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
    return new Vao(program, {
        position: new Buffer(new Int8Array(screenVertices), {
            itemSize: 2,
            dataType: Buffer.Byte,
            stride: 0,
            offset: 0,
            normalized: false,
        }),
    });
}

export function createProgram() {
    return new ShaderProgram({
        vertex: new Shader('vertex', fill_vsh),
        fragment: new Shader('fragment', fill_fsh),
        uniforms: [
            { name: 'iResolution', type: '2f' },
            { name: 'iChannel0', type: '1i' },
            { name: 'enabled', type: '1i' },
        ],
        attributes: [{ name: 'position', location: 0 }],
    });
}
