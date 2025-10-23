const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file
const envResult = dotenv.config({
  path: path.resolve(process.cwd(), ".env.development.local"),
});

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['@turnkey/ethers', '@turnkey/http', '@turnkey/api-key-stamper']
      }
    },
    argv
  );

  // Add Node.js polyfills for browser
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
    vm: false,
    // These might not be needed but adding for completeness
    assert: require.resolve('assert/'),
    url: require.resolve('url/'),
    http: false,
    https: false,
    os: false,
    path: require.resolve('path-browserify'),
  };

  // Provide global polyfills and environment variables
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        ...process.env,
        ...(envResult.parsed || {}),
      }),
    })
  );

  return config;
};

