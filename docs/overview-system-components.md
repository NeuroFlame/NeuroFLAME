### **Overview of System Components**
The system consists of several independent components:

- **Central API**: Connects to the central database and manages requests.
- **Central Federated Client**: Listens to the Central API, handles provisioning, and manages run execution.
- **File Server**: Distributes provisioned run kits.
- **Desktop App**: Electron-based UI that launches the Edge Federated Client.
- **Edge Federated Client**: Orchestrates computation, listens for central events, and reports errors/status.
- **Vault Federated Client**: A variation of the Edge Federated Client that does not expose an API.

---

### **Configuration and Environment Setup**
- Components rely on clearly defined **configuration files**.
- The **Electron App** uses a default configuration stored in `app_data` unless explicitly launched with a custom configuration file.
- Use `npm run start-configured` for development instead of `npm run start`.
- A script initializes configurations by copying defaults and replacing placeholders.

---

### **Component Interactions**
- **Desktop App ↔ Edge Federated Client**: Uses Apollo GraphQL for structured communication.
- **Desktop App ↔ Central API**: Handles UI-driven interactions.
- **Edge Federated Client ↔ Central API**:  
  - Listens for events via GraphQL subscriptions.  
  - Reports run errors, completion status, and updates to the Central API.
- **Vault Federated Clients**: Do not expose an API but behave similarly to Edge Clients.
- **Central Federated Client**:  
  - Listens for events via GraphQL subscriptions.  
  - Handles provisioning.  
  - Reports errors, completion status, and updates to the Central API.
  - Runs the central node in computation runs
- **File Server**: Acts as a pass-through for distributing run kits.

---

### **GraphQL and API Design**
- Uses **Apollo GraphQL** with limited, well-defined interfaces to minimize complexity.
- Ensures **strong type safety** through TypeScript-generated type definitions.
- Focuses on **non-leaky abstractions** to improve long-term maintainability.

---

### **Run Process**
1. **Provisioning**:  
   - A new run is provisioned using minimal JSON metadata sent to the Central Federated Client.
   - A container executes the provisioning script.
   - The resulting **run kit** is distributed via the File Server.

2. **Execution**:  
   - Edge nodes and the central node receive an event to download run kits and launch computations.
   - The system monitors execution, logs statuses, and reports errors.

---

### **NVIDIA Flare Integration**
- **Provisioning** generates unique keys and assigns ports.
- Each computation runs as an **isolated instance**, but **port multiplexing** requires refinement.
- Potential need for **reverse proxies** to optimize multi-run scenarios.

---

### **Future Improvements**
- **Remove default configurations** for central components to enforce explicit configuration.
- **Refine event reporting** to simplify status updates.
- **Improve documentation** for onboarding and context.
- **Break up large files** (e.g., resolvers) for easier navigation.