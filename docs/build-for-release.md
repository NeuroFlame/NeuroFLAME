## Desktop Application Build Instructions

Follow these exact steps, starting from the root of the repository, to correctly install dependencies and build the desktop application components:

### Guided one-command flow
```bash
npm run release
```

Optional flags:
```bash
# Skip npm publish (publish is default)
npm run release -- --skip-publish

# Also publish Electron artifacts to GitHub Releases
npm run release -- --deploy-gh

# Fully non-interactive run
npm run release -- --publish-npm --deploy-gh --yes
```

### 1. Install Workspace Dependencies
```bash
npm install
```

### 2. Build Desktop Components
```bash
npm run build --workspace desktopApp/reactApp
npm run build --workspace edgeFederatedClient
npm run build --workspace desktopApp/electronApp
```

### 3. Create Distributable
```bash
npm run dist --workspace desktopApp/electronApp
```

### 4. Locate the Distributable File
The distributable file is located at:
```
desktopApp/electronApp/dist
```

### Automatic update artifacts

Production builds check the repository's latest GitHub Release at startup and
every six hours. Updates download in the background, then NeuroFLAME prompts the
user to restart. Choosing **Later** installs the downloaded update on the next
normal quit.

GitHub Releases must contain the platform package and its generated update
metadata:

- Linux: the AppImage and `latest-linux.yml`
- Windows: the NSIS installer and `latest.yml`
- macOS: the DMG, ZIP, and `latest-mac.yml`

Linux auto-update works only when NeuroFLAME is launched from the AppImage and
both the AppImage and its containing directory are writable by that user.
Development, unpacked, system package, and read-only AppImage launches skip the
automatic check; users can still install the latest release manually.
