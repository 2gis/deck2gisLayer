# deck2gisLayer
Deck.gl layers implementations into 2gis map

## Usage

Install with NPM

```shell
npm install @2gis/deck2gis-layer
```

### Use # deck2gisLayer

Import the deck2gisLayer plugin to your project and use it:

```typescript
import { Deck2gisLayer, initDeck2gisProps } from '@2gis/deck2gis-layer';
// Init mapgl
const map = new mapgl.Map('container', {
    center: [55.31878, 25.23584],
    zoom: 13,
    key: 'Your API access key',
});
// Init deck.gl
const deck = new Deck(initDeck2gisProps(map));

// create Deck2gisLayer
const layer = new Deck2gisLayer<HexagonLayer<any>>({
    id: 'deckgl-HexagonLayer',
    deck,
    type: HexagonLayer,
    data,
    antialiasing: true,
    parameters: { depthTest: true },
    radius: 480,
    getPosition: (d: any) => [d.point.lon, d.point.lat],
});

// add deck layer into map
 map.addLayer(deckLayer);
```

## Contributing

Deck2gisLayer uses github-flow to accept & merge fixes and improvements. Basic process is:
- Fork the repo.
- Create a branch.
- Add or fix some code.
- **Run testing suite with `npm run docker:test` and make sure nothing is broken**
- Add some tests for your new code or fix broken tests.
- Commit & push.
- Create a new pull request to original repo.

Pull requests with failing tests will not be accepted.
Also, if you modify packages or add them to `package.json`, make sure you use `npm` and update `package-lock.json`.

## Tests

### Run tests
```shell
npm run docker:test
```

### Update screenshots
```shell
npm run docker:screenshot:update
```

## Release

### npm 

1. Update the package version by running `npm version patch|minor|major`. This command returns a new package version. Let assume it's 1.2.3
1. Push changes to github and merge them to the «master» branch
1. Go to https://github.com/2gis/deck2gisLayer/releases/new
1. Click the «Choose tag» button and create a new tag according to the version in package.json, for example v1.2.3
1. Make sure the release target is the «master» branch
1. Paste the release tag into the «Release title» field, for example v1.2.3
1. Add a release description
1. Click the «Publish release» button 
1. Go to https://github.com/2gis/deck2gisLayer/actions and wait for completing the release workflow

### Demo

1. Just execute `npm run deploy-gh-pages` on your local machine from a commit you want to deploy as a demo.