const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require('path');

module.exports = {
    entry: './app/scripts/app.js',
    devtool: 'inline-source-map',
    module: {        
        rules: [
            // {
            //     test: /\.tsx?$/,
            //     use: 'ts-loader',
            //     exclude: /node_modules/
            // }, 
            {
                test: /\.(png|svg|jpg|gif|ico|svg)$/,
                use: {
                    loader: "file-loader",
                    options: {
                        name: '[name].[ext]',
                        outputPath: './img'
                    }
                }
            },
            {
                test: /\.scss$/,
                use: [
                  "style-loader",
                  MiniCssExtractPlugin.loader,
                  "css-loader",
                  "sass-loader"
                ]
              }
        ]
    },
    devServer: {
        contentBase: './dist',
        port: 5000,
    },
    resolve: {
        modules: ['node_modules'],
        extensions: [ '.js' ]
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new CleanWebpackPlugin(['dist']),
        new CopyWebpackPlugin([
            { from: './app/img/*', to: './img', flatten: true },
            { from: './app/agent/*', to: './agent', flatten: true }
          ]),
        new MiniCssExtractPlugin({
            filename: "./styles/[name].[contenthash].css"
          }),
        new HtmlWebpackPlugin({
            hash: true,    
            template: './app/index.html',
            filename: './index.html'
        })
    ]
};