import type { Map } from "@2gis/mapgl/types";
import { RenderTarget } from "./2gl/RenderTarget";
import { Texture } from "./2gl/Texture";
import { Vao } from "./2gl/Vao";
import { ShaderProgram } from "./2gl/ShaderProgram";
import { Shader } from "./2gl/Shader";
import { Buffer } from "./2gl/Buffer";

import fill_fxaa_fsh from "./shaders/fillTextureFXAA.fsh";
import fill_fxaa_vsh from "./shaders/fillTextureFXAA.vsh";
import fill_fsh from "./shaders/fillTexture.fsh";
import fill_vsh from "./shaders/fillTexture.vsh";

import {
  AntiAliasingMode,
  CustomRenderInternalProps,
  LumaFramebuffer,
} from "./types";

/**
 * Initializes deck.gl instance for working with the MapGL map.
 * @hidden
 * @internal
 */
export function createFramebufferMSAA(map: Map): LumaFramebuffer {
  const gl = map.getWebGLContext() as WebGL2RenderingContext;
  const mapSize = map.getSize();
  const targetTextureWidth = Math.ceil(mapSize[0] * window.devicePixelRatio);
  const targetTextureHeight = Math.ceil(mapSize[1] * window.devicePixelRatio);
  const msaaFrameBuffer = gl.createFramebuffer();
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

  return wrapFramebuffer(
    msaaFrameBuffer,
    Math.ceil(map.getSize()[0] * window.devicePixelRatio),
    Math.ceil(map.getSize()[1] * window.devicePixelRatio),
  ) as any;
}

export function createRenderTarget(
  map: Map,
): RenderTarget & { _lumaFramebuffer: LumaFramebuffer } {
  const gl = map.getWebGLContext() as WebGL2RenderingContext;
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
  (renderTarget as any)._lumaFramebuffer = wrapFramebuffer(
    (renderTarget as any)._frameBuffer,
    Math.ceil(map.getSize()[0] * window.devicePixelRatio),
    Math.ceil(map.getSize()[1] * window.devicePixelRatio),
  ) as any;
  return renderTarget as RenderTarget & { _lumaFramebuffer: any };
}

/**
 * Wraps a raw WebGLFramebuffer with properties that luma.gl's WEBGLRenderPass expects
 * (.handle, .colorAttachments, .width, .height). Without this wrapper, luma.gl falls
 * back to gl.drawBuffers([gl.BACK]) while the custom FBO is bound, causing
 * INVALID_OPERATION: drawBuffers: COLOR_ATTACHMENTi_EXT or NONE.
 * @hidden
 * @internal
 */
export function wrapFramebuffer(
  framebuffer: WebGLFramebuffer,
  width: number,
  height: number,
): LumaFramebuffer {
  return {
    handle: framebuffer,
    width,
    height,
    colorAttachments: [{}],
    resize(size: [number, number]) {
      this.width = size[0];
      this.height = size[1];
    },
  };
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
    vertex: new Shader("vertex", fill_vsh),
    fragment: new Shader("fragment", fill_fsh),
    uniforms: [{ name: "u_sr2d_texture", type: "1i" }],
    attributes: [{ name: "a_vec2_position", location: 0 }],
  });
}

/**
 * @hidden
 * @internal
 */
export function createProgramFillFXAA() {
  return new ShaderProgram({
    vertex: new Shader("vertex", fill_fxaa_vsh),
    fragment: new Shader("fragment", fill_fxaa_fsh),
    uniforms: [
      { name: "iResolution", type: "2f" },
      { name: "u_sr2d_texture", type: "1i" },
      { name: "enabled", type: "1i" },
    ],
    attributes: [{ name: "a_vec2_position", location: 0 }],
  });
}

/**
 * @param {AntiAliasingMode} antialiasing antialiasing mode.
 * @hidden
 * @internal
 */
export function createProgram(antialiasingMode: AntiAliasingMode) {
  if (antialiasingMode === "fxaa") {
    return createProgramFillFXAA();
  }
  return createProgramFill();
}

export function blitMsaaFrameBuffer(
  gl: WebGL2RenderingContext,
  deckProps: CustomRenderInternalProps,
) {
  const mapSize = deckProps._2gisData._2gisMap?.getSize();
  const msaaFrameBuffer = deckProps._2glMsaaFrameBuffer;
  const renderTarget = deckProps._2glRenderTarget;

  if (
    msaaFrameBuffer &&
    mapSize &&
    gl &&
    !(gl instanceof WebGLRenderingContext)
  ) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaaFrameBuffer.handle);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, (renderTarget as any)._frameBuffer);

    gl.clearBufferfv(gl.COLOR, 0, [0.0, 0.0, 0.0, 0.0]);

    gl.blitFramebuffer(
      0,
      0,
      mapSize[0] * window.devicePixelRatio,
      mapSize[1] * window.devicePixelRatio,
      0,
      0,
      mapSize[0] * window.devicePixelRatio,
      mapSize[1] * window.devicePixelRatio,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }
}
