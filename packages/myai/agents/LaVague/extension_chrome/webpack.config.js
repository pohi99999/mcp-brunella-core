import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import Dotenv from 'dotenv-webpack';
import TerserPlugin from 'terser-webpack-plugin';
import path from 'path';
const outputPath = 'dist';

export default (env, { mode }) => {
    const isProduction = mode === 'production';

    return {
        entry: {
            main: [path.resolve(path.resolve(), 'src', 'main.ts')],
            background: path.resolve(path.resolve(), 'src', 'background.ts'),
            content: path.resolve(path.resolve(), 'src', 'content.ts'),
        },
        output: {
            path: path.join(path.resolve(), outputPath),
            filename: '[name].js',
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                '@': path.resolve(path.resolve(), 'src/'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.(ts|tsx)?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.?(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
                            plugins: [
                                [
                                    'babel-plugin-styled-components',
                                    {
                                        minify: isProduction,
                                        transpileTemplateLiterals: isProduction,
                                    },
                                ],
                            ],
                        },
                    },
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: ['style-loader', 'css-loader', 'sass-loader'],
                },
                {
                    test: /\.(jpg|jpeg|png|gif|woff|woff2|eot|ttf|svg)$/i,
                    use: 'url-loader?limit=1024',
                },
            ],
        },
        plugins: [
            new CopyPlugin({
                patterns: [{ from: '.', to: '.', context: 'public' }],
            }),
            new MiniCssExtractPlugin({
                filename: '[name].css',
            }),
            new Dotenv(),
        ],
        optimization: {
            minimize: isProduction,
            mergeDuplicateChunks: true,
            removeEmptyChunks: true,
            sideEffects: false,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        keep_classnames: true,
                        keep_fnames: true,
                    },
                }),
            ],
        },
        devtool: isProduction ? 'source-map' : 'inline-source-map',
    };
};
