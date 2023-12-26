import { MapView } from '@deck.gl/core';
import type { Deck, Layer } from '@deck.gl/core/typed';
import type { Map } from '@2gis/mapgl/types';

import { Deck2gisLayer } from './deckgl2gisLayer';
import { getViewState, MapglMercatorViewport } from './viewport';
import fill_fxaa_fsh from './shaders/fillTextureFXAA.fsh';
import fill_fxaa_vsh from './shaders/fillTextureFXAA.vsh';
import fill_fsh from './shaders/fillTexture.fsh';
import fill_vsh from './shaders/fillTexture.vsh';

import {
    AntiAliasingMode,
    CustomRenderInternalProps,
    CustomRenderProps,
    DeckRenderProps,
} from './types';
import { DeckProps } from '@deck.gl/core/typed';
import { RenderTarget } from './2gl/RenderTarget';
import { Texture } from './2gl/Texture';
import { Vao } from './2gl/Vao';
import { ShaderProgram } from './2gl/ShaderProgram';
import { Shader } from './2gl/Shader';
import { Buffer } from './2gl/Buffer';
import * as createStateStack from 'gl-state';

/**
 * @hidden
 * @internal
 */
export function prepareDeckInstance({
    map,
    gl,
    deck,
    renderTarget,
    msaaFrameBuffer,
}: {
    map: Map & { __deck?: Deck | null };
    gl: WebGLRenderingContext;
    deck?: Deck;
    renderTarget: RenderTarget;
    msaaFrameBuffer?: WebGLFramebuffer | null;
}): Deck | null {
    // Only create one deck instance per context
    if (map.__deck) {
        return map.__deck;
    }

    const deckProps = reInitDeck2gisProps(map, renderTarget, deck, msaaFrameBuffer);

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

    if (deck?.['animationLoop']) {
        deckInstance = deck as Deck;
        deckInstance.setProps(deckProps);
    } else {
        return null;
    }
    // todo use public methods after done TILES-4753
    (map as any)._impl.on(
        'framestart',
        () => ((deck.props as CustomRenderInternalProps)._2gisData._2gisFramestart = true),
    );
    map.on('resize', () => onMapResize(map, deck, renderTarget, msaaFrameBuffer));
    map.__deck = deckInstance;
    return deckInstance;
}

/**
 * @hidden
 * @internal
 */
export function addLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    (deck.props as CustomRenderInternalProps)._2gisData._2gisCustomLayers.add(layer);
    updateLayers(deck);
}

/**
 * @hidden
 * @internal
 */
export function removeLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
    (deck.props as CustomRenderInternalProps)._2gisData._2gisCustomLayers.delete(layer);
    updateLayers(deck);
}

/**
 * @hidden
 * @internal
 */
export function updateLayer(deck: Deck, _layer: Deck2gisLayer<any>): void {
    updateLayers(deck);
}

/**
 * @hidden
 * @internal
 */
export function drawLayer(deck: Deck, map: Map, layer: Deck2gisLayer<any>): boolean {
    let currentViewport = (deck.props as CustomRenderInternalProps)._2gisData._2gisCurrentViewport;
    if (!currentViewport) {
        // This is the first layer drawn in this render cycle.
        // Generate viewport from the current map state.
        currentViewport = getViewport(map);
        (deck.props as CustomRenderInternalProps)._2gisData._2gisCurrentViewport = currentViewport;
    }

    if (!isIncludeLayer(deck, layer)) {
        return false;
    }
    stateBinder(map.getWebGLContext());

    deck._drawLayers('2gis-repaint', {
        viewports: [currentViewport],
        layerFilter: ({ layer: deckLayer }) => layer.id === deckLayer.id,
        clearCanvas: false,
    });
    return true;
}

/**
 * @hidden
 * @internal
 */
function isIncludeLayer(deck: Deck, layer: Deck2gisLayer<any>): boolean {
    if (!(deck as any).layerManager) {
        return false;
    }

    if (!(deck as any).layerManager.layers.some((deckLayer) => layer.id === deckLayer.id)) {
        return false;
    }

    return true;
}

/**
 * @hidden
 */
export function getViewport(map: Map): MapglMercatorViewport | undefined {
    if (!map) {
        return undefined;
    }

    return new MapglMercatorViewport(map);
}

/**
 * @hidden
 * @internal
 */
function onMapMove(deck: Deck, map: Map): void {
    if (deck['animationLoop']) {
        deck.setProps({
            viewState: getViewState(map),
        });
        // Camera changed, will trigger a map repaint right after this
        // Clear any change flag triggered by setting viewState so that deck does not request
        // a second repaint
        deck.needsRedraw({ clearRedrawFlags: true });
    }
}

/**
 * @hidden
 * @internal
 */
export function onMapResize(
    map: Map,
    deck: Deck,
    renderTarget: RenderTarget,
    msaaFrameBuffer?: WebGLFramebuffer | null,
) {
    const mapSize = map.getSize();
    const targetTextureWidth = Math.ceil(mapSize[0] * window.devicePixelRatio);
    const targetTextureHeight = Math.ceil(mapSize[1] * window.devicePixelRatio);
    const gl = map.getWebGLContext();

    renderTarget.setSize([targetTextureWidth, targetTextureHeight]);
    renderTarget.bind(gl);
    msaaFrameBuffer
        ? ((deck.props as CustomRenderInternalProps)._2glRenderTarget = renderTarget)
        : (deck.props._framebuffer = (renderTarget as any)._frameBuffer);
    renderTarget.unbind(gl);

    if (msaaFrameBuffer) {
        const depthRenderBuffer = gl.createRenderbuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
        (gl as WebGL2RenderingContext).renderbufferStorageMultisample(
            gl.RENDERBUFFER,
            4,
            (gl as WebGL2RenderingContext).DEPTH_COMPONENT24,
            targetTextureWidth,
            targetTextureHeight,
        );

        const colorRenderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, colorRenderBuffer);

        (gl as WebGL2RenderingContext).renderbufferStorageMultisample(
            gl.RENDERBUFFER,
            4,
            (gl as WebGL2RenderingContext).RGBA8,
            targetTextureWidth,
            targetTextureHeight,
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer);

        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.RENDERBUFFER,
            colorRenderBuffer,
        );

        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            depthRenderBuffer,
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    (deck as any).glStateStore = initWebglStateStores(map);
}

/**
 * @hidden
 * @internal
 */
function updateLayers(deck: Deck): void {
    if (deck['animationLoop']) {
        const layers: Layer<any>[] = [];
        let layerIndex = 0;
        (deck as any).glStateStore.useDeckWebglState();
        (deck.props as CustomRenderInternalProps)._2gisData._2gisCustomLayers.forEach(
            (deckLayer) => {
                const LayerType = deckLayer.props.type;
                const layer = new LayerType(deckLayer.props, { _offset: layerIndex++ });
                layers.push(layer);
            },
        );
        deck.setProps({ layers });
        (deck as any).glStateStore.useMapglWebglState();
    }
}

/**
 * Internally initializes deck.gl properties for working with the MapGL map.
 * @param map The map instance.
 * @param deck The Deck.gl instance.
 * @param renderTarget 2gl RenderTarget.
 * @hidden
 * @internal
 */
function reInitDeck2gisProps(
    map: Map,
    renderTarget: RenderTarget,
    deck?: Deck,
    msaaFrameBuffer?: WebGLFramebuffer | null,
): DeckProps {
    const gl = map.getWebGLContext();
    const customRender = deck && (deck?.props as any)?._customRender;
    const antialiasing = (deck?.props as CustomRenderProps).antialiasing || 'none';

    const program = createProgram(antialiasing);

    const vao = createVao(program);

    const customRenderProps: CustomRenderInternalProps = {
        _antialiasing: 'none',
        useDevicePixels: true,
        _2gisFramestart: false,
        _2glRenderTarget: renderTarget,
        _2glMsaaFrameBuffer: msaaFrameBuffer,
        _2glProgram: program,
        _2glVao: vao,
        _framebuffer: msaaFrameBuffer || (renderTarget as any)._frameBuffer,
        _customRender: (reason: string) => {
            // todo  need change to public rerender method in mapgl map.triggerRedraw()
            map.triggerRerender();
            // customRender may be subscribed by DeckGL React component to update child props
            // make sure it is still called
            customRender?.(reason);
        },
    };
    const deck2gisProps: CustomRenderInternalProps = {
        ...customRenderProps,
        parameters: {
            depthMask: true,
            depthTest: true,
            blend: true,
            blendFunc: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA],
            polygonOffsetFill: true,
            depthFunc: gl.LEQUAL,
            blendEquation: gl.FUNC_ADD,
        },
        _antialiasing: (deck?.props as CustomRenderProps).antialiasing || 'none',
        _2gisData: {
            _2gisCustomLayers:
                (deck?.props as CustomRenderInternalProps)._2gisData._2gisCustomLayers || new Set(),
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

function initWebglStateStores(map: Map) {
    const useDeckStorei = (gl) => {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.disable(gl.CULL_FACE);
    };
    const mapglState = createStateStack(map.getWebGLContext());
    const deckGlState = createStateStack(map.getWebGLContext());
    const gl = map.getWebGLContext();
    const useDeckWebglState = () => {
        mapglState.push();
        deckGlState.pop();
        useDeckStorei(gl);
    };
    const useMapglWebglState = () => {
        deckGlState.push();
        mapglState.pop();
        useDeckStorei(gl);
    };
    mapglState.push();
    useDeckStorei(gl);
    deckGlState.push();
    return { useDeckWebglState, useMapglWebglState, mapglState, deckGlState };
}

export function initDeck(map: Map, Deck: any, deckProps?: DeckRenderProps): Deck {
    const deck = new Deck(initDeck2gisProps(map, deckProps));
    deck.glStateStore = initWebglStateStores(map);

    // init Deck render frameBuffers and renderTarget with deck webGl state.
    deck.glStateStore.useDeckWebglState();

    const gl = map.getWebGLContext() as WebGL2RenderingContext | WebGLRenderingContext;
    const mapSize = map.getSize();
    const targetTextureWidth = Math.ceil(mapSize[0] * window.devicePixelRatio);
    const targetTextureHeight = Math.ceil(mapSize[1] * window.devicePixelRatio);
    const renderTarget = new RenderTarget({
        size: [targetTextureWidth, targetTextureHeight],
        magFilter: Texture.LinearFilter,
        minFilter: Texture.LinearFilter,
        wrapS: Texture.ClampToEdgeWrapping,
        wrapT: Texture.ClampToEdgeWrapping,
    });
    renderTarget.bind(gl);
    renderTarget.unbind(gl);
    let msaaFrameBuffer;

    if (
        !(gl instanceof WebGLRenderingContext) &&
        gl &&
        deckProps?.antialiasing === 'msaa' &&
        gl.getContextAttributes()?.antialias === false
    ) {
        msaaFrameBuffer = gl.createFramebuffer();
        const depthRenderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
        gl.renderbufferStorageMultisample(
            gl.RENDERBUFFER,
            4,
            gl.DEPTH_COMPONENT24,
            targetTextureWidth,
            targetTextureHeight,
        );

        const colorRenderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, colorRenderBuffer);

        gl.renderbufferStorageMultisample(
            gl.RENDERBUFFER,
            4,
            gl.RGBA8,
            targetTextureWidth,
            targetTextureHeight,
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer);

        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.RENDERBUFFER,
            colorRenderBuffer,
        );

        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            depthRenderBuffer,
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    const deckReInit = prepareDeckInstance({
        map,
        gl,
        deck,
        renderTarget: renderTarget,
        msaaFrameBuffer: msaaFrameBuffer,
    });
    map.triggerRerender();
    (deckReInit?.props as CustomRenderInternalProps)._2gisInitDeck = true;

    // reset webGl state to mapgl.
    deck.glStateStore.useMapglWebglState();

    return deckReInit as Deck;
}

/**
 * Initializes deck.gl properties for working with the MapGL map.
 * @param map The map instance.
 * @param deckProps CustomRenderProps initialization options.
 */
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
        _antialiasing: deckProps?.antialiasing || 'none',
        //   _framebuffer: ((new RenderTarget({ size: [1, 1] })).bind(gl).unbind(gl) as any)._frameBuffer,
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
/**
 * @hidden
 * @internal
 */
function stateBinder(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
}

/**
 * @hidden
 * @internal
 */
export function createVao(program: ShaderProgram) {
    const screenVertices = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];

    return new Vao(program, {
        a_vec2_position: new Buffer(new Int8Array(screenVertices), {
            itemSize: 2,
            dataType: Buffer.Byte,
            stride: 0,
            offset: 0,
            normalized: false,
        }),
    });
}

/**
 * @hidden
 * @internal
 */
export function createProgramFill() {
    return new ShaderProgram({
        vertex: new Shader('vertex', fill_vsh),
        fragment: new Shader('fragment', fill_fsh),
        uniforms: [{ name: 'u_sr2d_texture', type: '1i' }],
        attributes: [{ name: 'a_vec2_position', location: 0 }],
    });
}

/**
 * @hidden
 * @internal
 */
export function createProgramFillFXAA() {
    return new ShaderProgram({
        vertex: new Shader('vertex', fill_fxaa_vsh),
        fragment: new Shader('fragment', fill_fxaa_fsh),
        uniforms: [
            { name: 'iResolution', type: '2f' },
            { name: 'u_sr2d_texture', type: '1i' },
            { name: 'enabled', type: '1i' },
        ],
        attributes: [{ name: 'a_vec2_position', location: 0 }],
    });
}

/**
 * @param {AntiAliasingMode} antialiasing antialiasing mode.
 * @hidden
 * @internal
 */
export function createProgram(antialiasingMode: AntiAliasingMode) {
    if (antialiasingMode === 'fxaa') {
        return createProgramFillFXAA();
    }
    return createProgramFill();
}
