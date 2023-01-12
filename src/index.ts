import { Deck2gisLayer } from './deckgl2gisLayer';
import { initDeck2gisProps } from './utils';

if (typeof window !== 'undefined') {
    if ('mapgl' in window) {
        (mapgl as any).Deck2gisLayer = Deck2gisLayer;
    } else {
        // Если так вышло, что плагин инициализирован раньше mapgl, поместим его во временную переменную
        // Из нее уже сам mapgl все положит в себя.
        if (!(window as any).__mapglPlugins) {
            (window as any).__mapglPlugins = {};
        }

        (window as any).__mapglPlugins.Deck2gisLayer = Deck2gisLayer;
    }
}

export { Deck2gisLayer, initDeck2gisProps };
