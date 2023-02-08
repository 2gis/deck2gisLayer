import { DeckProps } from '@deck.gl/core/typed';
export interface DeckCustomLayer {
    type: 'custom';
    id: string;
    render: (gl: WebGLRenderingContext) => void;
    props: any;
}
/**
 * CustomRenderProps is type extends from DeckProps:
 * https://deck.gl/docs/api-reference/core/deck#properties
 */
export type CustomRenderProps = Partial<DeckProps> & CustomRenderInternalProps;
