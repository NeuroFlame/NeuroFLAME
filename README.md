# **NeuroFlame**

**NeuroFlame is a platform for collaborative neuroimaging research that keeps sensitive patient data secure. By using federated learning, researchers can train models and perform analyses across multiple institutions while keeping data securely on-site. This approach allows institutions to benefit from shared insights without exposing private datasets.**

## **Why NeuroFlame?**

Collaborative neuroimaging research requires institutions to work together, but privacy concerns and technical barriers make data sharing difficult. NeuroFlame simplifies this by using secure federated learning, allowing institutions to generate shared insights **without exposing private datasets**.

To make this process seamless, NeuroFlame provides an **easy-to-use desktop application** that allows researchers to:

- **Create and join consortia** for multi-institutional studies.
- **Configure studies with selected computation modules.**
- **Start federated runs with a single action**—execution is fully managed by the platform, handling all underlying infrastructure automatically.
- **Leverage a growing library of computation modules**—including boilerplate and reference implementations to make it easy for researchers to develop and contribute their own algorithms.

## **Core Components**

- **Desktop App** – A streamlined UI for configuring studies, managing consortia, and setting up federated computations.
- **Central API Server** – Manages authentication, coordination, and secure communication.
- **Federated Clients** – Deploy and execute computation module containers on local machines while ensuring data remains secure.
- **Computation Module Images** – Run customized research algorithms securely within each institution.

## **Documentation**

- **[User Guide](./docs/user-guide.md)** – How to configure studies, execute runs, and interpret results.
- **[Computation Author Guide](./docs/computation-author-guide.md)** – How to create and integrate custom computation modules.
- **[Hosting and Deployment Guide](./docs/hosting-and-deployment-guide.md)** – How to set up and maintain a NeuroFlame deployment.
- **[Developer Guide](./docs/developer-guide.md)** – How to contribute to and extend the platform.
- **[Architecture and Design](./docs/architecture-and-design.md)** – Technical deep dive into system architecture.

