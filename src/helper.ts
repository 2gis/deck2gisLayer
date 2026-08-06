import type { Map } from "@2gis/mapgl/types";
import type { Deck, Layer } from "@deck.gl/core";
import type { DeckProps } from "@deck.gl/core";
import { MapView } from "@deck.gl/core";
import { getViewState, MapglMercatorViewport } from "./viewport";

import { Deck2gisLayer } from "./mapglDeckLayers";

import {
  AntiAliasingMode,
  CustomRenderInternalProps,
  CustomRenderProps,
  DeckRenderProps,
} from "./types";
import { initWebglStateStores } from "./webGLStateStore";
import {
  createFramebufferMSAA,
  createProgram,
  createRenderTarget,
  createVao,
  wrapFramebuffer,
} from "./renderer";

/**
 * Initializes deck.gl instance for working with the MapGL map.
 * @param map The map instance.
 * @param Deck The Deck.gl
 * @param deckProps DeckRenderProps initialization options.
 */
export function initDeck(
  map: Map,
  Deck: any,
  deckProps?: DeckRenderProps,
): Deck {
  const deck = new Deck(initDeck2gisProps(map, deckProps));
  console.info("Deck2GisLayers v3.14");
  // Initialize WebGL state stores and set the initial state to deck's store
  // Должно вызываться сразу после создания deck, до любых операций с WebGL, чтобы гарантировать правильное состояние при первом рендере
  const stateStore = initWebglStateStores(map);
  deck.glStateStore = stateStore;
  deck.glStateStore.useDeckWebglState();

  const deckAntiaiasingMode =
    (deck.props._antialiasing as AntiAliasingMode) || "none";
  const program = createProgram(deckAntiaiasingMode);
  const vao = createVao(program);
  const renderTarget = createRenderTarget(map);
  deck.props._framebuffer = renderTarget._lumaFramebuffer;
  deck.props._2glRenderTarget = renderTarget;
  deck.props._2glProgram = program;
  deck.props._2glVao = vao;

  if (deckAntiaiasingMode === "msaa") {
    const msaaFrameBuffer = createFramebufferMSAA(map);
    (deck.props as CustomRenderInternalProps)._2glMsaaFrameBuffer =
      msaaFrameBuffer;
    deck.props._framebuffer = msaaFrameBuffer;
  }

  map.on("move", () => onMapMove(deck, map));
  (map as any)._impl.on(
    "framestart",
    () =>
      ((deck.props as CustomRenderInternalProps)._2gisData._2gisFramestart =
        true),
  );
  map.on("resize", () => onMapResize(map, deck));

  // Вернуть исходное состояние WebGL, чтобы 2gis рендерился корректно, а deck.gl не влиял на него после инициализации
  deck.glStateStore.useMapglWebglState();

  return deck as Deck;
}

/**
 * @hidden
 * @internal
 */
export function onMapResize(map: Map, deck: Deck) {
  const mapSize = map.getSize();
  const targetTextureWidth = Math.ceil(mapSize[0] * window.devicePixelRatio);
  const targetTextureHeight = Math.ceil(mapSize[1] * window.devicePixelRatio);
  const gl = map.getWebGLContext() as WebGL2RenderingContext;
  const props = deck.props as CustomRenderInternalProps;
  const {
    _2glRenderTarget: renderTarget,
    _2glMsaaFrameBuffer: msaaFrameBuffer,
  } = props;

  if (!renderTarget) {
    return;
  }

  // Skip costly resource recreation when size is unchanged.
  if (
    (renderTarget as any)._lumaFramebuffer?.width === targetTextureWidth &&
    (renderTarget as any)._lumaFramebuffer?.height === targetTextureHeight &&
    (!msaaFrameBuffer ||
      (msaaFrameBuffer.width === targetTextureWidth &&
        msaaFrameBuffer.height === targetTextureHeight))
  ) {
    return;
  }

  // Ensure no stale framebuffer stays bound while resources are being recreated.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  renderTarget.setSize([targetTextureWidth, targetTextureHeight]);
  renderTarget.bind(gl);
  renderTarget.unbind(gl);
  (renderTarget as any)._lumaFramebuffer = wrapFramebuffer(
    (renderTarget as any)._frameBuffer,
    targetTextureWidth,
    targetTextureHeight,
  );
  (deck.props as any)._framebuffer = renderTarget._lumaFramebuffer;

  if (msaaFrameBuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer.handle);
    const colorRb = gl.getFramebufferAttachmentParameter(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,
    ) as WebGLRenderbuffer | null;
    const depthRb = gl.getFramebufferAttachmentParameter(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,
    ) as WebGLRenderbuffer | null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (colorRb) {
      gl.deleteRenderbuffer(colorRb);
    }
    if (depthRb) {
      gl.deleteRenderbuffer(depthRb);
    }
    gl.deleteFramebuffer(msaaFrameBuffer.handle);

    // Recreate MSAA framebuffer with new size
    const newMsaaFrameBuffer = createFramebufferMSAA(map);
    props._2glMsaaFrameBuffer = newMsaaFrameBuffer;
    (deck.props as any)._framebuffer = newMsaaFrameBuffer;
  }

  (deck.props as CustomRenderInternalProps)._2gisData._2gisCurrentViewport =
    undefined;
}

/**
 * Initializes deck.gl properties for working with the MapGL map.
 * @param map The map instance.
 * @param deckProps CustomRenderProps initialization options.
 */
function initDeck2gisProps(map: Map, deckProps?: CustomRenderProps): DeckProps {
  const gl = map.getWebGLContext();
  const deck2gisProps: any = {
    parameters: {
      depthWriteEnabled: true,
      depthCompare: "less-equal",
      blend: true,
      blendColorSrcFactor: "src-alpha",
      blendColorDstFactor: "one-minus-src-alpha",
      blendAlphaSrcFactor: "one",
      blendAlphaDstFactor: "one-minus-src-alpha",
      blendColorOperation: "add",
      blendAlphaOperation: "add",
    },
    ...deckProps,
    _2gisData: {
      _2gisCustomLayers: new Set(),
      _2gisMap: map,
      _2gisGL: gl,
    },
    _antialiasing: deckProps?.antialiasing || "none",
    _customRender: (reason: string) => {
      map.triggerRerender();
    },
    views: [new MapView({ id: "2gis" })],
  };

  // deck is using the WebGLContext created by 2gis
  // block deck from setting the canvas size
  Object.assign(deck2gisProps, {
    gl,
    width: null,
    height: null,
    touchAction: "unset",
    viewState: getViewState(map),
  });
  return deck2gisProps;
}

/**
 * @hidden
 * @internal
 */
export function addLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
  (deck.props as CustomRenderInternalProps)._2gisData._2gisCustomLayers.add(
    layer,
  );
  updateLayers(deck);
}

/**
 * @hidden
 * @internal
 */
export function removeLayer(deck: Deck, layer: Deck2gisLayer<any>): void {
  (deck.props as CustomRenderInternalProps)._2gisData._2gisCustomLayers.delete(
    layer,
  );
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
 * Draws the layer using the deck instance.
 * @param target The framebuffer wrapper to render into. Passed explicitly so that
 *               after resize the caller always provides the up-to-date FBO,
 *               instead of relying on deck.props._framebuffer which may be stale.
 * @internal
 */
export function drawLayer(
  deck: Deck,
  map: Map,
  layer: Deck2gisLayer<any>,
  target?: any,
): boolean {
  let currentViewport = (deck.props as CustomRenderInternalProps)._2gisData
    ._2gisCurrentViewport;
  if (!currentViewport) {
    currentViewport = getViewport(map);
    (deck.props as CustomRenderInternalProps)._2gisData._2gisCurrentViewport =
      currentViewport;
  }

  if (!isIncludeLayer(deck, layer)) {
    return false;
  }
  deck._drawLayers("2gis-repaint", {
    target,
    viewports: [currentViewport],
    layerFilter: ({ layer: deckLayer }) => layer.id === deckLayer.id,
    clearCanvas: false,
  });
  return true;
}

/**
 * Checks if the layer is included in the deck instance.
 * @hidden
 * @internal
 */
function isIncludeLayer(deck: Deck, layer: Deck2gisLayer<any>): boolean {
  if (!(deck as any).layerManager) {
    return false;
  }
  if (
    !(deck as any).layerManager.layers.some(
      (deckLayer: any) => layer.id === deckLayer.id,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * @hidden
 * @internal
 */
function updateLayers(deck: Deck): void {
  if (deck["animationLoop"]) {
    (deck as any).glStateStore.useDeckWebglState();
    const layers: Layer<any>[] = [];
    let layerIndex = 0;
    (
      deck.props as CustomRenderInternalProps
    )._2gisData._2gisCustomLayers.forEach((deckLayer: any) => {
      const LayerType = deckLayer.props.type;
      const layer = new LayerType(deckLayer.props, { _offset: layerIndex++ });
      layers.push(layer);
    });
    deck.setProps({ layers });

    (deck as any).glStateStore.useMapglWebglState();
  }
}

/**
 * Returns the current viewport of the map.
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
  if (deck["animationLoop"]) {
    deck.setProps({
      viewState: getViewState(map),
    });
    deck.needsRedraw({ clearRedrawFlags: true });
  }
}
