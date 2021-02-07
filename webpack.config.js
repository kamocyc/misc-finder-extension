const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const config = () => {
  return {
    mode: "development",
    devtool: 'inline-source-map',
    entry: {
      background: path.join(__dirname, 'src', 'background.ts'),
      options: path.join(__dirname, 'src', 'options.ts'),
      popup: path.join(__dirname, 'src', 'popup.ts'),
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: '[name].js'
    },
    module: {
      rules: [
        {
          test: /.ts$/,
          use: 'ts-loader',
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: "public", to: "." }
        ]
      })
    ]
  }
}

module.exports = config;
