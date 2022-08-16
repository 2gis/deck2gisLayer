export interface DeckCustomLayer {
    type: 'custom';
    id: string;
    render: (gl: WebGLRenderingContext) => void;
    props: any;
}
