export interface DeckCustomLayer {
    type: 'custom';
    id: string;
    render: (gl: WebGLRenderingContext) => void;
    props: any;
}

export interface MapViewState {
    repeat: boolean;
    padding: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    longitude: number;
    latitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
    fovy: number;
}
