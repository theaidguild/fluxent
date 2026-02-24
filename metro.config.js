// metro.config.js
// Enables modern Node package.json "exports" field resolution required by
// @modelcontextprotocol/sdk and other packages that use conditional exports.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
