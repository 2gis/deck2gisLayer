import { WebMercatorViewport } from '@deck.gl/core';

export default class MapglViewport {
    static displayName = 'WebMercatorViewport';
    viewport: WebMercatorViewport;

    constructor(viewport: WebMercatorViewport) {
        this.viewport = viewport;
    }

    getDistanceScales(coordinateOrigin?: number[]) {
        return this.viewport.getDistanceScales(coordinateOrigin)
    }

    get longitude(): number {
        return this.viewport.longitude
    }
    get latitude(): number {
        return this.viewport.latitude
    }
    get pitch(): number {
        return this.viewport.pitch
    }
    get bearing(): number {
        return this.viewport.bearing
    }
    get altitude(): number {
        return this.viewport.altitude
    }
    get fovy(): number {
        return this.viewport.fovy
    }
    get orthographic(): number {
        return this.viewport.orthographic
    }

    get metersPerPixel(): number {
        return this.viewport.metersPerPixel
    }

    get projectionMode(): number {
        return this.viewport.projectionMode
    }

    get id(): string {
        return this.viewport.id
    }
    get x(): number {
        return this.viewport.x
    }
    get y(): number {
        return this.viewport.y
    }
    get width(): number {
        return this.viewport.width
    }
    get height(): number {
        return this.viewport.height
    }
    get isGeospatial(): boolean {
        return this.viewport.isGeospatial
    }
    get zoom(): number {
        return this.viewport.zoom
    }
    get focalDistance(): number {
        return this.viewport.focalDistance
    }
    get position(): number[] {
        return this.viewport.position
    }
    get modelMatrix(): number[] | null {
        return this.viewport.modelMatrix
    }

  /** Derived parameters */

  // `!` post-fix expression operator asserts that its operand is non-null and non-undefined in contexts
  // where the type checker is unable to conclude that fact.

  get distanceScales(): any {
    return this.viewport.distanceScales
}
  get scale(): number {
    return this.viewport.scale
}
  get center(): number[] {
    return this.viewport.center
}
  get cameraPosition(): number[] {
    return this.viewport.cameraPosition
}
  get projectionMatrix(): number[] {
    return this.viewport.projectionMatrix
}
  get viewMatrix(): number[] {
    return this.viewport.viewMatrix
}
  get viewMatrixUncentered(): number[] {
    return this.viewport.viewMatrixUncentered
}
  get viewMatrixInverse(): number[] {
    return this.viewport.viewMatrixInverse
}
  get viewProjectionMatrix(): number[] {
    return this.viewport.viewProjectionMatrix
}
  get pixelProjectionMatrix(): number[] {
    return this.viewport.pixelProjectionMatrix
}
  get pixelUnprojectionMatrix(): number[] {
    return this.viewport.pixelUnprojectionMatrix
}
  get resolution(): number[] {
    return this.viewport.resolution
}



    // Two viewports are equal if width and height are identical, and if
    // their view and projection matrices are (approximately) equal.
    equals(viewport: any): boolean {
        return this.viewport.equals(viewport)
    }

    /**
     * Projects xyz (possibly latitude and longitude) to pixel coordinates in window
     * using viewport projection parameters
     * - [longitude, latitude] to [x, y]
     * - [longitude, latitude, Z] => [x, y, z]
     * Note: By default, returns top-left coordinates for canvas/SVG type render
     *
     * @param {Array} lngLatZ - [lng, lat] or [lng, lat, Z]
     * @param {Object} opts - options
     * @param {Object} opts.topLeft=true - Whether projected coords are top left
     * @return {Array} - [x, y] or [x, y, z] in top left coords
     */
    project(xyz: number[], { topLeft = true }: { topLeft?: boolean } = {}): number[] {
        return this.viewport.project(xyz, { topLeft })
    }

    /**
     * Unproject pixel coordinates on screen onto world coordinates,
     * (possibly [lon, lat]) on map.
     * - [x, y] => [lng, lat]
     * - [x, y, z] => [lng, lat, Z]
     * @param {Array} xyz -
     * @param {Object} opts - options
     * @param {Object} opts.topLeft=true - Whether origin is top left
     * @return {Array|null} - [lng, lat, Z] or [X, Y, Z]
     */
    unproject(
        xyz: number[],
        { topLeft = true, targetZ }: { topLeft?: boolean; targetZ?: number } = {}
    ): number[] {
        return this.viewport.unproject(xyz, { topLeft, targetZ })
    }

    // NON_LINEAR PROJECTION HOOKS
    // Used for web meractor projection

    projectPosition(xyz: number[]): [number, number, number] {
        console.log(xyz,this.viewport.projectPosition(xyz));
        return this.viewport.projectPosition(xyz)
    }

    unprojectPosition(xyz: number[]): [number, number, number] {
        return this.viewport.unprojectPosition(xyz)
    }

    /**
     * Project [lng,lat] on sphere onto [x,y] on 512*512 Mercator Zoom 0 tile.
     * Performs the nonlinear part of the web mercator projection.
     * Remaining projection is done with 4x4 matrices which also handles
     * perspective.
     * @param {Array} lngLat - [lng, lat] coordinates
     *   Specifies a point on the sphere to project onto the map.
     * @return {Array} [x,y] coordinates.
     */
    projectFlat(xyz: number[]): [number, number] {
        return this.viewport.projectFlat(xyz)
    }

    /**
     * Unproject world point [x,y] on map onto {lat, lon} on sphere
     * @param {object|Vector} xy - object with {x,y} members
     *  representing point on projected map plane
     * @return {GeoCoordinates} - object with {lat,lon} of point on sphere.
     *   Has toArray method if you need a GeoJSON Array.
     *   Per cartographic tradition, lat and lon are specified as degrees.
     */
    unprojectFlat(xyz: number[]): [number, number] {
        return this.viewport.unprojectFlat(xyz)
    }

    /**
     * Get bounds of the current viewport
     * @return {Array} - [minX, minY, maxX, maxY]
     */
    getBounds(options: { z?: number } = {}): [number, number, number, number] {
        return this.viewport.getBounds(options)
    }


    containsPixel({
        x,
        y,
        width = 1,
        height = 1
    }: {
        x: number;
        y: number;
        width?: number;
        height?: number;
    }): boolean {
        return this.viewport.containsPixel(x, y, width, height)
    }

    // Extract frustum planes in common space
    getFrustumPlanes(): {
        left: any;
        right: any;
        bottom: any;
        top: any;
        near: any;
        far: any;
    } {
        return this.viewport.getFrustumPlanes()
    }

    // EXPERIMENTAL METHODS

    /**
     * Needed by panning and linear transition
     * Pan the viewport to place a given world coordinate at screen point [x, y]
     *
     * @param {Array} coords - world coordinates
     * @param {Array} pixel - [x,y] coordinates on screen
     * @return {Object} props of the new viewport
     */
    panByPosition(coords: number[], pixel: number[]): any {
        return this.viewport.panByPosition(coords, pixel);
    }

    get subViewports(): WebMercatorViewport[] | null {
       return this.viewport.subViewports
    }


    /**
     * Add a meter delta to a base lnglat coordinate, returning a new lnglat array
     *
     * Note: Uses simple linear approximation around the viewport center
     * Error increases with size of offset (roughly 1% per 100km)
     *
     * @param {[Number,Number]|[Number,Number,Number]) lngLatZ - base coordinate
     * @param {[Number,Number]|[Number,Number,Number]) xyz - array of meter deltas
     * @return {[Number,Number]|[Number,Number,Number]) array of [lng,lat,z] deltas
     */
    addMetersToLngLat(lngLatZ: number[], xyz: number[]): number[] {
        return this.viewport.addMetersToLngLat(lngLatZ, xyz)
    }




    /**
     * Returns a new viewport that fit around the given rectangle.
     * Only supports non-perspective mode.
     */
    fitBounds(
        /** [[lon, lat], [lon, lat]] */
        bounds: [[number, number], [number, number]],
        options: {
            /** If not supplied, will use the current width of the viewport (default `1`) */
            width?: number;
            /** If not supplied, will use the current height of the viewport (default `1`) */
            height?: number;
            /** In degrees, 0.01 would be about 1000 meters */
            minExtent?: number;
            /** Max zoom level */
            maxZoom?: number;
            /** Extra padding in pixels */
            padding?: number | Required<any>;
            /** Center shift in pixels */
            offset?: number[];
        } = {}
    ) {
        return this.viewport.fitBounds(bounds, options);
    }

}