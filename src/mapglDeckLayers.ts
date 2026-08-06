import {
  addLayer,
  removeLayer,
  updateLayer,
  drawLayer,
  initDeck,
  onMapResize,
} from "./helper";
import type { Deck, Layer } from "@deck.gl/core";
import {
  CustomRenderInternalProps,
  CustomRenderProps,
  DeckCustomLayer,
} from "./types";
import type { Map } from "@2gis/mapgl/types";
import { blitMsaaFrameBuffer } from "./renderer";

/**
 * Any Layer class from deck.gl.
 */
export type DeckLayer = any;

/**
 * Deck2gisLayer required props.
 */
export interface Deck2gisLayerProps {
  id: string;
  renderingMode?: "2d" | "3d";
  deck: Deck;
  type: DeckLayer;
  antialiasing?: boolean;
}

/**
 * LayerProps is type extends from Layer:
 * https://deck.gl/docs/api-reference/core/layer
 */
export type LayerProps<LayerT extends Layer> = Deck2gisLayerProps &
  Partial<LayerT["props"]>;

/**
 * A class that provides rendering any deck.gl layer inside the MapGl canvas / WebGL context.
 */
export class Deck2gisLayer<LayerT extends Layer> implements DeckCustomLayer {
  id: string;
  type: "custom";
  renderingMode: "2d" | "3d";
  props: LayerProps<LayerT> | undefined;
  gl?: WebGLRenderingContext | WebGL2RenderingContext;
  antialiasing: boolean;
  isDestroyed: boolean;

  /**
   * Initializes deck.gl instance for working with the MapGL map.
   * @param map The map instance.
   * @param Deck The Deck.gl class
   * @param deckProps CustomRenderProps initialization options.
   */
  static initDeck = (map: Map, Deck: any, deckProps?: CustomRenderProps) =>
    initDeck(map, Deck, deckProps);

  /* eslint-disable no-this-before-super */
  /**
   * Example:
   * ```js
   * const deckLayer = new mapgl.Deck2gisLayer(map, Deck, {
   *     id: 'deckLayer',
   *     deck,
   *     type: HexagonLayer,
   *     data,
   *     getPosition: (d) => [d.point.lon, d.point.lat]
   * });
   *
   * map.addLayer(deckLayer);
   * ```
   * @param map The map instance.
   * @param options Deck2gisLayer initialization options.
   */
  constructor(props: LayerProps<LayerT>) {
    if (!props.id) {
      throw new Error("Layer must have a unique id");
    }
    this.isDestroyed = false;
    this.id = props.id;
    this.type = "custom";
    this.renderingMode = props.renderingMode || "3d";
    this.props = props;
    this.gl = (
      this.props.deck.props as CustomRenderInternalProps
    )._2gisData._2gisMap.getWebGLContext();
    this.antialiasing = Boolean(props.antialiasing);
  }

  /**
   * @hidden
   * @internal
   * MapGL calls this method after adding a layer to a map.
   */
  public onAdd = () => {
    if (this.props?.deck && !this.isDestroyed) {
      addLayer(this.props.deck, this as any);
    }
  };
  /**
   * @hidden
   * @internal
   * MapGL calls this method after removing a layer from a map.
   */
  public onRemove = () => {
    if (this.props && this.props.deck) {
      removeLayer(this.props.deck, this as any);
    }
  };

  /**
   * Sets layer properties and updates the layer.
   * @param props deck.gl layer properties.
   */
  public setProps(props: Partial<LayerProps<LayerT>>) {
    if (!this.isDestroyed && this.props) {
      // id cannot be changed
      Object.assign(this.props, props, { id: this.id });
      this.antialiasing = Boolean(props.antialiasing);
      // safe guard in case setProps is called before onAdd
      if (this.props.deck) {
        updateLayer(this.props.deck, this as any);
      }
    }
  }

  /**
   * Destroys the layer and frees all related resources.
   */
  public destroy = () => {
    this.gl = undefined;
    this.isDestroyed = true;
    this.props = undefined;
  };

  /**
   * @hidden
   * @internal
   * MapGL calls this method on each map frame rendering.
   */
  public render = () => {
    if (!this.props || !(this.props?.deck as any)?.props) {
      return;
    }

    let renderTarget = (this.props.deck as any).props._2glRenderTarget;
    let msaaFrameBuffer = (this.props.deck as any).props._2glMsaaFrameBuffer;
    const program = (this.props.deck as any).props._2glProgram;
    const vao = (this.props.deck as any).props._2glVao;

    if (
      this.isDestroyed ||
      !this.props.deck ||
      !(this.props.deck as any)?.layerManager ||
      !(this.props.deck.props as CustomRenderInternalProps)._2gisData
        ._2gisMap ||
      !renderTarget ||
      !program ||
      !vao ||
      !this.gl ||
      !this.props ||
      !(this.props.deck.props as CustomRenderInternalProps)._2glRenderTarget
    ) {
      return;
    }

    (this.props.deck as any).glStateStore.useDeckWebglState();

    const gl = this.gl;

    // ColumnGeometry (deck.gl) создаёт indices (Uint16Array) для extruded-режима.
    // fillModel.setGeometry(geometry) привязывает их как indexBuffer,
    // но fillModel.setIndexBuffer(null) может не очистить привязку.
    // С triangle-strip + активный индексный буфер WebGL рисует через
    // drawElementsInstanced вместо drawArrays — индексы не соответствуют
    // порядку вершин triangle-strip, что приводит к артефактам отрисовки
    // (часть граней гексагонов пропадает). Принудительно сбрасываем.
    try {
      const layers = (this.props.deck as any).layerManager?.layers;
      if (layers) {
        for (const composite of layers) {
          const subs = composite.internalState?.subLayers;
          if (!subs) continue;
          for (const sub of subs) {
            // Only reset fillModel's index buffer (ColumnGeometry bug).
            // PathLayer's model uses indices legitimately for line joins.
            const model = sub.state?.fillModel;
            if (model?.vertexArray?.indexBuffer) {
              model.vertexArray.indexBuffer = null;
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }

    const mapSize = (
      this.props.deck.props as CustomRenderInternalProps
    )._2gisData._2gisMap.getSize();
    const clearColor = (this.props as any)?.parameters?.clearColor || [0, 0, 0];
    const { _2gisData } = this.props.deck.props as CustomRenderInternalProps;

    if (_2gisData._2gisFramestart) {
      msaaFrameBuffer
        ? gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer.handle)
        : renderTarget.bind(gl);
      this.clearColorDepth(gl, clearColor);

      _2gisData._2gisCurrentViewport = undefined;
      _2gisData._2gisFramestart = false;

      if (
        this.props.deck.width !== mapSize[0] ||
        this.props.deck.height !== mapSize[1]
      ) {
        (this.props.deck as any).animationLoop._resizeViewport();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        onMapResize(
          (this.props.deck.props as CustomRenderInternalProps)._2gisData
            ._2gisMap,
          this.props.deck,
        );
        renderTarget = (this.props.deck as any).props._2glRenderTarget;
        msaaFrameBuffer = (this.props.deck as any).props._2glMsaaFrameBuffer;
      }
    } else {
      msaaFrameBuffer
        ? gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFrameBuffer.handle)
        : renderTarget.bind(gl);
      this.clearColorDepth(gl, clearColor);
    }

    renderTarget.unbind(gl);

    // Pass the current framebuffer explicitly so deck._drawLayers always
    // renders into the up-to-date FBO (not a stale deck.props._framebuffer).
    const currentTarget = msaaFrameBuffer || renderTarget._lumaFramebuffer;

    const isDrawed = drawLayer(
      this.props.deck,
      (this.props.deck.props as CustomRenderInternalProps)._2gisData._2gisMap,
      this as any,
      currentTarget,
    );

    if (!isDrawed) {
      (this.props.deck as any).glStateStore.useMapglWebglState();
      return;
    }

    if (msaaFrameBuffer) {
      blitMsaaFrameBuffer(
        this.gl as WebGL2RenderingContext,
        this.props.deck.props as CustomRenderInternalProps,
      );
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const texture = renderTarget.getTexture();
    texture.enable(gl, 0);
    program.enable(gl);
    this.programmBinder();

    // Explicitly set the viewport to the current canvas size.
    // After drawLayer, device.popState() restores the viewport captured by
    // deckGlState on the PREVIOUS frame. On resize, that viewport is stale
    // (old dimensions), so the fullscreen quad would be blitted at the wrong size.
    gl.viewport(
      0,
      0,
      Math.ceil(mapSize[0] * window.devicePixelRatio),
      Math.ceil(mapSize[1] * window.devicePixelRatio),
    );

    const prevState = this.beforeDrawToMapWebGLState(gl);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.restoreDrawToMapWebGLState(gl, prevState);

    (this.props.deck as any).glStateStore.useMapglWebglState();
  };

  private beforeDrawToMapWebGLState(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
  ) {
    const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    const prevBlend = gl.isEnabled(gl.BLEND);
    const prevBlendFuncSep =
      gl.getParameter(gl.BLEND_SRC_RGB) +
      "," +
      gl.getParameter(gl.BLEND_DST_RGB) +
      "," +
      gl.getParameter(gl.BLEND_SRC_ALPHA) +
      "," +
      gl.getParameter(gl.BLEND_DST_ALPHA);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    return { prevDepthMask, prevBlend, prevBlendFuncSep };
  }

  private restoreDrawToMapWebGLState(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    prevState: {
      prevDepthMask: boolean;
      prevBlend: boolean;
      prevBlendFuncSep: string;
    },
  ) {
    gl.depthMask(prevState.prevDepthMask);
    if (!prevState.prevBlend) {
      gl.disable(gl.BLEND);
    }
    gl.blendFuncSeparate(
      ...(prevState.prevBlendFuncSep.split(",").map(Number) as [
        number,
        number,
        number,
        number,
      ]),
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private programmBinder() {
    const program = (this.props?.deck as any)?.props?._2glProgram;
    const vao = (this.props?.deck as any)?.props?._2glVao;
    if (
      !this.props?.deck ||
      !(this.props.deck.props as CustomRenderInternalProps)._2gisData
        ._2gisMap ||
      !program ||
      !vao ||
      !this.gl
    ) {
      return;
    }

    const mapSize = (
      this.props.deck.props as CustomRenderInternalProps
    )._2gisData._2gisMap.getSize();
    const gl = this.gl;
    if (this.currentAntialiasingMode() === "fxaa") {
      program.bind(gl, {
        iResolution: [
          mapSize[0] * window.devicePixelRatio,
          mapSize[1] * window.devicePixelRatio,
        ],
        u_sr2d_texture: 0,
        enabled: 1,
      });
    } else {
      program.bind(gl, {
        u_sr2d_texture: 0,
      });
    }

    vao.bind({
      gl,
      extensions: {
        OES_vertex_array_object: gl.getExtension("OES_vertex_array_object"),
      },
    });
  }

  private currentAntialiasingMode() {
    return (this.props?.deck.props as CustomRenderProps).antialiasing;
  }

  private clearColor(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    clearColor: [number, number, number],
  ) {
    gl.colorMask(true, true, true, true);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private clearColorDepth(
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    clearColor: [number, number, number],
  ) {
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
}
