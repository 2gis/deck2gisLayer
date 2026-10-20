import { WebMercatorViewport } from "@deck.gl/core";
import type { Map } from "@2gis/mapgl/types";

/**
 * @hidden
 * @internal
 */
export class MapglMercatorViewport extends WebMercatorViewport {
  constructor(mapOrProps: Map | Record<string, any>) {
    // deck.gl internals may recreate viewports via `new viewport.constructor(viewState)`,
    // passing a plain options object instead of a Map instance.
    if (typeof (mapOrProps as any).getSize === "function") {
      const map = mapOrProps as Map;
      const [width, height] = map.getSize();
      super(
        Object.assign(
          {
            id: "2gis",
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
    } else {
      super({ id: "2gis", ...mapOrProps });
    }
  }

  get projectionMode() {
    return 4;
  }
}

/**
 * @hidden
 * @internal
 */
export function getViewState(map: Map): any & {
  padding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
} {
  const [lng, lat] = map.getCenter();
  const viewState: any & {
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
  const cameraFovRad =
    (map as any)._impl.core?.state?.cameraConfig?.fov ??
    (map as any)._impl.state?.cameraConfig?.fov ??
    (fovy * Math.PI) / 180;
  const height = map.getSize()[1];
  // 2GIS clamps the effective screen height used for the camera fov to a
  // minimum of 1000px: tan(fov/2)_eff = tan(fov/2) * height / max(height, 1000).
  // deck.gl makes the requested fovy wider through the same minimum-1000px
  // screen height rule, so requesting the exact same *effective* fov here
  // makes deck's uncentered perspective match the 2GIS camera.
  return (
    2 *
    Math.atan((Math.tan(cameraFovRad / 2) * height) / Math.max(height, 1000)) *
    (180 / Math.PI)
  );
}
