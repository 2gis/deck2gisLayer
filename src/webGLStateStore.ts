import createStateStack from "gl-state";
import type { Map } from "@2gis/mapgl/types";

export function initWebglStateStores(map: Map) {
  const useDeckStorei = (gl: WebGL2RenderingContext & any) => {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    // MapGL может вызывать gl.enable/gl.disable через оригинальные (не Spy-обёрнутые)
    // ссылки, а deck.gl/luma.gl через Spy — кэш luma.gl рассинхронизируется.
    // Когда pipeline зовёт webglDevice.popState() (внутри withDeviceAndGLParameters),
    // popState восстанавливает кэшированное значение через Spy, который считает его "новым"
    // и применяет к реальному GL, перезаписывая наше состояние.
    // Форсим синхронизацию luma Spy-кэша: обновляем gl.state.cache напрямую,
    // после чего spy-вызовы (gl.enable/gl.disable через spy) увидят правильное состояние.
    // gl.state.cache заполняется luma при инициализации WebGLStateTracker.
    if (gl.state?.cache) {
      gl.state.cache[gl.CULL_FACE] = false;
      gl.state.cache[gl.DEPTH_TEST] = false;
      gl.state.cache[gl.DEPTH_WRITEMASK] = false;
    }
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
  };

  const gl = map.getWebGLContext();
  const mapglState = createStateStack(gl);
  const deckGlState = createStateStack(gl);

  const useDeckWebglState = () => {
    mapglState.push();
    deckGlState.pop();
    useDeckStorei(gl);
  };

  const useMapglWebglState = () => {
    // Unbind all texture units before snapshotting deck's GL state.
    // gl-state captures TEXTURE_BINDING_2D for every unit. Deck.gl leaves
    // its internal textures bound after rendering and may delete them
    // between frames (tile eviction, layer updates, resize). If those
    // handles are captured here, deckGlState.pop() on the next frame will
    // try to restore deleted objects →
    // INVALID_OPERATION: bindTexture: attempt to use a deleted object.
    const maxUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number;
    for (let i = 0; i < maxUnits; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }
    gl.activeTexture(gl.TEXTURE0);

    deckGlState.push();
    mapglState.pop();
    useDeckStorei(gl);
  };

  mapglState.push();
  useDeckStorei(gl);
  deckGlState.push();
  return { useDeckWebglState, useMapglWebglState, mapglState, deckGlState };
}

export function initWebglStateStoresold(map: Map) {
  const gl = map.getWebGLContext();

  const useDeckStorei = (gl: any) => {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.disable(gl.CULL_FACE);
  };

  const mapglState = createStateStack(gl);
  const deckGlState = createStateStack(gl);

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
  resetWebGLState(gl);
  useDeckStorei(gl);
  deckGlState.push();
  return { useDeckWebglState, useMapglWebglState, mapglState, deckGlState };
}

export function resetWebGLState(gl: any) {
  // ========== Shader Program ==========
  gl.useProgram(null);

  // ========== Buffer Bindings ==========
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.bindBuffer(gl.COPY_READ_BUFFER, null);
  gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
  gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
  gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);

  // ========== VAO ==========
  gl.bindVertexArray(null);

  // ========== Texture Bindings ==========
  const maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
  for (let i = 0; i < maxTextures; i++) {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindTexture(gl.TEXTURE_3D, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }
  gl.activeTexture(gl.TEXTURE0);

  // ========== Framebuffer / Renderbuffer ==========
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  // ========== Viewport & Scissor ==========
  const width = gl.canvas.width;
  const height = gl.canvas.height;
  gl.viewport(0, 0, width, height);
  gl.scissor(0, 0, width, height);

  // ========== Clear Values ==========
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1.0);
  gl.clearStencil(0);

  // ========== Enable / Disable ==========
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.DITHER);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  gl.disable(gl.SAMPLE_COVERAGE);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.STENCIL_TEST);
  gl.disable(gl.RASTERIZER_DISCARD);

  // ========== Blending ==========
  gl.blendColor(0, 0, 0, 0);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ZERO);

  // ========== Depth ==========
  gl.depthFunc(gl.LESS);
  gl.depthMask(true);
  gl.depthRange(0.0, 1.0);

  // ========== Stencil ==========
  gl.stencilFunc(gl.ALWAYS, 0, 0xffffffff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  gl.stencilMask(0xffffffff);

  // ========== Face Culling ==========
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);

  // ========== Color Mask ==========
  gl.colorMask(true, true, true, true);

  // ========== Line Width ==========
  gl.lineWidth(1.0);
}
