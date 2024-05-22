const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (_, argv) => {
    let type = 'development';

    if (argv.production) {
        type = 'production';
    } else if (argv.demo) {
        type = 'demo';
    } else if (argv.test) {
        type = 'test';
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
                {
                    test: /\.[vf]f?sh$/,
                    use: [
                        {
                            loader: path.resolve('./tools/shadersLoader.js'),
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

    const test = {
        ...base,
        entry: './test/index.ts',
        output: {
            filename: 'test.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: '/',
        },
        plugins: [
            new CleanWebpackPlugin(),
            new CopyPlugin([
                {
                    from: 'test/index.html',
                    to: 'test.html',
                },
            ]),
        ],
    };

    if (type === 'production') {
        return [library];
    }

    if (type === 'demo') {
        return [library, demo];
    }

    if (type === 'test') {
        return [test];
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
