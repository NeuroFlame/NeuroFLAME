const fs = require('fs').promises;
const { build, Platform, Arch } = require('electron-builder');
const config = require('../electron-builder.config.cjs');

const { NODE_ENV, DEPLOY } = process.env;

const buildConfig = {};

if (NODE_ENV === 'production' && DEPLOY) {
  console.log('Preparing to deploy...');
  buildConfig.publish = { provider: 'github' };
} else {
  // buildConfig.dir = true;
  // buildConfig.win = ['zip'];
  // buildConfig.mac = ['zip'];
  // buildConfig.linux = ['zip'];
}

// ✅ Properly create a Map for targets
const targets = new Map([
  [Platform.MAC, new Map([[Arch.universal, ['dmg']]])],
  [Platform.WINDOWS, new Map([[Arch.x64, ['nsis']]])],
  [Platform.LINUX, new Map([[Arch.x64, ['AppImage']]])],
]);

// ✅ Merge config and build options
const finalConfig = Object.assign({}, buildConfig, {
  config,
  targets,
  publish: DEPLOY ? 'always' : 'never',
});

// 🚀 Run the build
build(finalConfig).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
