# **Developer Guide**

## **Prerequisites**
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (22.15.0 or newer; current LTS recommended)
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
