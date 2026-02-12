## Desktop Application Build Instructions

Follow these exact steps, starting from the root of the repository, to correctly install dependencies and build the desktop application components:

### Guided one-command flow
```bash
npm run release
```

Optional flags:
```bash
# Also publish npm packages
npm run release -- --publish-npm

# Also publish Electron artifacts to GitHub Releases
npm run release -- --deploy-gh

# Fully non-interactive run
npm run release -- --publish-npm --deploy-gh --yes
```

### 1. Desktop App (React App)
```bash
cd desktopApp/reactApp
npm install
npm run build
```

### 2. Edge Federated Client
```bash
cd edgeFederatedClient
npm install
npm run build
```

### 3. Desktop App (Electron App)
```bash
cd desktopApp/electronApp
npm install
npm run build
```

### 4. Create Distributable
```bash
cd desktopApp/electronApp
npm run dist
```

### 5. Locate the Distributable File
The distributable file is located at:
```
desktopApp/electronApp/dist
```

