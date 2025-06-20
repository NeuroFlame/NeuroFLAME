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

### **3. Initialize Configuration**
Initialize the configuration files:
```bash
cd configs
./initialize_configs.sh
cd ..
```

### **4. Start the Database**
Start the database container using Docker Compose:
```bash
cd _devCentralDatabase
docker compose up -d
cd ..
```

### **5. Build Components**
From the repository root, build the components individually:

```bash
cd edgeFederatedClient && npm run build && cd ..
cd desktopApp/reactApp && npm run build && cd ../..
cd desktopApp/electronApp && npm run build && cd ../..
```

Seed the database:
```bash
cd centralApi && npm run seed && cd ..
```

### **6. Start the Services**
Open multiple terminal windows and run the following commands in each:

**Central API:**
```bash
cd centralApi && npm run start-configured
```

**Central Federated Client:**
```bash
cd centralFederatedClient && npm run start-configured
```

**File Server:**
```bash
cd fileServer && npm run start-configured
```

**Desktop App (React):**
```bash
cd desktopApp/reactApp && npm run start
```

**Desktop App (Electron):**
```bash
cd desktopApp/electronApp && npm run start-configured
```