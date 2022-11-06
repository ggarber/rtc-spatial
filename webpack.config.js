const {
  NODE_ENV = 'production',
} = process.env;

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    libraryTarget: 'umd',
  },
  mode: NODE_ENV,
};

