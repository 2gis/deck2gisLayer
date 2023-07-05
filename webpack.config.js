const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const path = require('path');

module.exports = (_, argv) => {
    let type = 'development';

    if (argv.production) {
        type = 'production';
    } else if (argv.demo) {
        type = 'demo';
    }

    const base = {
        mode: 'production',
        module: {
            rules: [
                {
                    test: /\.(ts|js)$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: type === 'development',
                            },
                        },
                    ],
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
    };

    const library = {
        ...base,
        entry: './src/index.ts',
        output: {
            filename: 'deck2gislayer.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: '/',
            libraryTarget: 'umd',
            // webpack для umd использует window, которого может не быть в nodejs окружении.
            // вероятно поправили в 5 webpack, тогда можно будет удалить globalObject
            // https://github.com/webpack/webpack/pull/8625
            globalObject: "typeof self !== 'undefined' ? self : this",
        },
    };

    const demo = {
        ...base,
        entry: './demo/index.ts',
        output: {
            filename: 'demo.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: '/',
        },
    };

    if (type === 'production') {
        return [library];
    }

    if (type === 'demo') {
        return [library, demo];
    }

    const devConfig = {
        mode: 'development',
        devtool: 'eval-source-map',
        plugins: [new ForkTsCheckerWebpackPlugin()],
        devServer: {
            contentBase: path.resolve(__dirname, 'dist'),
            host: 'localhost',
            port: 3030,
            stats: {
                modules: false,
                hash: false,
                version: false,
                assets: false,
                entrypoints: false,
                builtAt: false,
                // https://github.com/TypeStrong/ts-loader#transpileonly-boolean-defaultfalse
                warningsFilter: /export .* was not found in /,
            },
            disableHostCheck: true,
            clientLogLevel: 'error',
            // Чтобы скрипт можно было тянуть с другого домена, например, в visual-comparator
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        },
    };

    return [
        { ...library, ...devConfig },
        { ...demo, ...devConfig },
    ];
};
