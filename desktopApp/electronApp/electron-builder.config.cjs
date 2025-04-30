const packageJson = require('./package.json');
debugger
module.exports = {
  appId: 'neuroflame',
  productName: 'NeuroFLAME',
  directories: {
    buildResources: 'assets',
    output: 'dist',
  },
  extraResources: [
    {
      from: '../reactApp/build',
      to: 'app/build',
      filter: ['**/*'],
    },
  ],
  mac: {
    icon: 'img/icons/icon-osx.icns',
    target: 'dmg',
    category: 'public.app-category.education',
    hardenedRuntime: true,
    notarize: {
      teamId: `${process.env.APPLE_TEAM_ID}`,
    },
  },
  dmg: {
    sign: false,
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'img/icons/icon-windows.ico',
  },
  nsis: {
    oneClick: true,
    runAfterFinish: true,
    installerIcon: 'img/icons/icon-windows.ico',
    uninstallerIcon: 'img/icons/icon-windows.ico',
    deleteAppDataOnUninstall: true,
    license: 'LICENSE',
  },
  linux: {
        target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
    ],
    category: 'Science',
    artifactName: 'NeuroFlame-${version}-linux.${ext}',
    icon: 'img/icons/icon-linux.png',
  },
};
