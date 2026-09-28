# **Developer Guide**

## **Prerequisites**
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (latest LTS version recommended)
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
From the repository root, run these commands:

```bash
cd edgeFederatedClient && npm install && cd ..
cd centralApi && npm install && cd ..
cd centralFederatedClient && npm install && cd ..
cd fileServer && npm install && cd ..
cd desktopApp/reactApp && npm install && cd ../..
cd desktopApp/electronApp && npm install && cd ../..
```

Or equivalently as a single command (fails fast on any error):
```bash
for component in edgeFederatedClient centralApi centralFederatedClient fileServer desktopApp/reactApp desktopApp/electronApp; do (cd $component && npm install) || { echo "ERROR: npm install failed in $component"; exit 1; }; done
```

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
The easiest way to control all backend services is via `dev-ctl.sh`, for instance the below starts everything in separate terminal tabs:

```bash
./dev-ctl.sh start
```

`dev-ctl.sh` without arguments gives usage. It provides start, status, stop, and restart actions, and oversees terminals, processes, and computation containers.  

**Manual alternative** (if you prefer to manage terminals/processes/containers yourself):

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
