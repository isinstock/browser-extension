const webpack = require('webpack')
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const srcDir = path.join(__dirname, '..', 'src')
const ProgressBarPlugin = require('progress-bar-webpack-plugin')
const HtmlWebpackPlugin = require("html-webpack-plugin")
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin

let compat = 'preact-compat';
try {
  compat = dirname(
    require.resolve('preact/compat/package.json', { paths: [cwd] })
  );
} catch (e) {
  try {
    compat = dirname(
      require.resolve('preact-compat/package.json', { paths: [cwd] })
    );
  } catch (e) {}
}

module.exports = {
  entry: {
    popup: path.join(srcDir, 'popup.ts'),
    background: path.join(srcDir, 'background.ts'),
    'content_scripts/content_script': path.join(srcDir, 'content_scripts/content_script.tsx'),
    'content_scripts/retailers/best-buy': path.join(srcDir, 'content_scripts/retailers/best-buy.tsx'),
    'content_scripts/retailers/target': path.join(srcDir, 'content_scripts/retailers/target.tsx'),
  },
  output: {
    path: path.join(__dirname, '../dist/js'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        enforce: "pre",
        resolve: { mainFields: ['module', 'jsnext:main', 'browser', 'main'] },
        test: /\.m?[jt]sx?$/,
        exclude: /node_modules/,
        type: 'javascript/auto',
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-react", "@babel/preset-env"],
              plugins: [
                ["@babel/plugin-transform-runtime"],
                [
                  "@babel/plugin-transform-react-jsx",
                  {
                    pragma: "h",
                    pragmaFrag: "Fragment",
                  },
                ],
              ],
            },
          },
          {
            loader: 'ts-loader',
          }
        ]
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      // preact-compat aliases for supporting React dependencies:
      react: compat,
      'react-dom': compat,
      'preact-compat': compat,
    },
  },
  plugins: [
    new ProgressBarPlugin({
      format:
        '\u001b[97m\u001b[44m Build \u001b[49m\u001b[39m [:bar] \u001b[32m\u001b[1m:percent\u001b[22m\u001b[39m (:elapseds) \u001b[2m:msg\u001b[22m',
      renderThrottle: 100,
      summary: false,
      clear: true,
    }),
    new CopyPlugin({
      patterns: [{from: '.', to: '../', context: 'public'}],
      options: {},
    }),
    new BundleAnalyzerPlugin({
      analyzerHost: "0.0.0.0", // To make it work in the container
    }),
  ],
}
