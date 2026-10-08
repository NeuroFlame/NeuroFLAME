# **Developer Guide**

## **Prerequisites**
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) 24 LTS (the tested patch version is in `.nvmrc`)
- [Docker](https://www.docker.com/)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)

Refer to:
- 📖 [Overview of System Components](./overview-system-components.md)
- 📖 [Architecture and Design](./architecture-and-design.md)

---

## **Developer Quick Start**
Follow these steps to set up and run the development environment.

### **1. Clone the Repository**
```bash
git clone https://github.com/NeuroFlame/NeuroFLAME.git
cd NeuroFLAME
```

### **2. Install Dependencies**
If you use nvm, run `nvm install` and `nvm use` from the repository root to select
the version in `.nvmrc`. Otherwise, install Node 24 LTS using your existing
installation method.

From the repository root, install all seven workspaces:

```bash
npm install
```

Use `npm ci` for a clean, reproducible install from the root lockfile (as CI does).
Repository installs use the root `package-lock.json`; npm may place shared dependencies
in root `node_modules`. Add a dependency to a service with
`npm install <package> --workspace <service-directory>`.

The vault Dockerfiles copy the vault package into a standalone directory and still
use `vaultFederatedClient/package-lock.json`. Keep that lockfile synchronized when
changing vault dependencies. Other existing service lockfiles are not used by
repository workspace installs.

npm 11 requires dependency install scripts to be approved. The root and standalone
vault manifests record approvals in `allowScripts` for the locked versions. When
updating a dependency that needs an install script, review it with
`npm install-scripts ls` and record its approval with
`npm install-scripts approve <package>` before verifying a fresh install.

### **3. Initialize Configuration**
Initialize .env files and set proper values in .env files:
```bash
cd centralApi && cp .env.template .env && cd ..
cd centralFederatedClient && cp .env.template .env && cd ..
cd fileServer && cp .env.template .env && cd ..
cd vaultFederatedClient && cp .env.template .env && cd ..
```

Or equivalently (skips existing files; omit the `[ -f .env ] ||` check to overwrite for a clean reset):
```bash
for component in centralApi centralFederatedClient fileServer vaultFederatedClient; do (cd $component && ([ -f .env ] || cp .env.template .env)) || { echo "ERROR: could not create .env in $component"; exit 1; }; done
```

Initialize the configuration files:
```bash
./configs/initialize_configs.sh
```

### **4. Start and Seed the Database**
Start the database container using Docker Compose, then seed it:
```bash
cd _devCentralDatabase
docker compose up -d
cd ..
cd centralApi && npm run seed && cd ..
```

### **5. Build Components**
From the repository root, build the components individually:

```bash
cd edgeFederatedClient && npm run build && cd ..
cd desktopApp/reactApp && npm run build && cd ../..
cd desktopApp/electronApp && npm run build && cd ../..
```

Or equivalently as a single command:
```bash
for component in edgeFederatedClient desktopApp/reactApp desktopApp/electronApp; do (cd $component && npm run build) || { echo "ERROR: npm run build failed in $component"; exit 1; }; done
```

Also compile `centralFederatedClient` (uses `npm run compile`, not `npm run build`):
```bash
cd centralFederatedClient && npm run compile && cd ..
```

### **6. Start the Services**
Open a terminal for each service and run:

```bash
cd centralApi && node dev-start.js
cd centralFederatedClient && node dev-start.js
cd fileServer && node dev-start.js
cd desktopApp/reactApp && npm run start
```

> **Note:** Use `node dev-start.js` (not `npm run start`) for backend services — it loads `.env` automatically. The reactApp does not use `.env` so is started via `npm run start`.

### **7. Launch the Desktop App**

```bash
cd desktopApp/electronApp && npm run start-configured
```

Log in as `user1@email.com` / `password1`. You can now explore the UI and browse the seeded consortia and computations.

To run an actual federated computation locally, see 📖 [Local Multi-Site Development Guide](./local-dev-multisite.md).

### Multiple desktop clients against production

Keep the React development server running as above. In separate terminals, launch
from `desktopApp/electronApp`:

```bash
npm run start-production
```

```bash
npm run start-production-2
```

These connect to `https://trendscenterdev.org` and use local edge ports `3003`
and `3004`. `start-production-3` uses `3005`. Each numbered client has a separate
config, browser login session, logs, and dataset/run settings under
`<Electron userData>/profiles/production-client-N/`. The first launch creates its
config; subsequent launches and the in-app Restart preserve that profile and
its settings. Window titles identify the client number. Opening an already
running profile focuses its existing window.

Sign in with a different account in each client, choose each client's dataset
directory, and mark both ready before starting a run. Close old desktop instances
using these same ports before launching the new profiles. Existing default and
local development configurations are not migrated or overwritten.

For additional profiles, run `npm start -- --production-client=4` (numbers 1–99
are accepted). A custom `--config=/absolute/path/config.json` may also be supplied;
use a different config file and local edge port for each profile.
