const { generateDocs } = require('@2gis/js-docs-generator');
const fs = require('fs');
const path = require('path');

const version = process.env.VERSION || 'branch';
fs.mkdirSync(path.join('dist', 'docs', version), { recursive: true });

generateDocs({
    version,
    defaultReference: 'Deck2gisLayer',
    docsHost: 'https://unpkg.com/@2gis/deck2gis-layer@^2/dist/docs',
    excludePaths: [],
    globs: ['src/**/*'],
    ignoreMarkdown: true,
    legacyOutPath: 'dist/docs.json',
})
    .then((result) => {
        fs.writeFileSync(path.join('dist', 'docs', 'manifest.json'), result.manifest);
        fs.writeFileSync(path.join('dist', 'docs', version, 'en.json'), result.reference.en);
        fs.writeFileSync(path.join('dist', 'docs', version, 'ru.json'), result.reference.ru);
    })
    .catch((e) => {
        console.log(e);
        process.exit(1);
    });
