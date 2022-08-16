import { getDeckInstance, addLayer, removeLayer, updateLayer, drawLayer } from './utils';

import type { Deck, Layer } from '@deck.gl/core';
import { DeckCustomLayer } from './types';
import type { Map } from '@2gis/mapgl/types';

export type LayerProps<LayerT extends Layer<any>> = Partial<LayerT['props']> & {
    id: string;
    deck?: Deck;
};

export class Deck2gisLayer<LayerT extends Layer<any>> implements DeckCustomLayer {
    id: string;
    type: 'custom';
    renderingMode: '2d' | '3d';
    map: Map | null;
    deck: Deck | null;
    props: LayerProps<LayerT>;

    /* eslint-disable no-this-before-super */
    constructor(props: LayerProps<LayerT>) {
        if (!props.id) {
            throw new Error('Layer must have an unique id');
        }

        this.id = props.id;
        this.type = 'custom';
        this.renderingMode = props.renderingMode || '3d';
        this.map = null;
        this.deck = null;
        this.props = props;
    }

    /* Mapbox custom layer methods */

    onAdd = (map: Map, gl: WebGLRenderingContext) => {
        this.map = map;
        this.deck = getDeckInstance({ map, gl, deck: this.props.deck });
        addLayer(this.deck, this);
    };

    onRemove = () => {
        if (this.deck) {
            removeLayer(this.deck, this);
        }
    };

    setProps(props: LayerProps<LayerT>) {
        // id cannot be changed
        Object.assign(this.props, props, { id: this.id });
        // safe guard in case setProps is called before onAdd
        if (this.deck) {
            updateLayer(this.deck, this);
        }
    }

    render = () => {
        if (this.deck && this.map) {
            (this.deck as any).userData.currentViewport = undefined;
            drawLayer(this.deck!, this.map!, this);
        }
    };
}
