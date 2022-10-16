const { mkdirSync, copyFileSync } = require('fs');

mkdirSync('dist', {
    recursive: true,
});

copyFileSync('demo/index.html', 'dist/index.html');
