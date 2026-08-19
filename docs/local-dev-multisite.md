# Local Multi-Site Development Guide

This guide walks through running a federated computation end-to-end on your local machine using three simulated sites. It assumes you have already completed the [Developer Guide](./developer-guide.md) setup.

---

## Overview

All seeded computations require multiple federated sites. To run one locally, you need:
- Three Electron windows, each logged in as a distinct user
- A computation image pulled to Docker
- Test data from the computation's repository, with a distinct dataset directory per site

---

## Step 1: Clone the Computation Repository

The test data is not part of the NeuroFLAME repository. It is included in each computation's own repository. For the seeded **Single Round Ridge Regression** computation:

```bash
git clone https://github.com/NeuroFlame/nfc-single-round-ridge-regression-freesurfer.git
```

This gives you test data at:
```
nfc-single-round-ridge-regression-freesurfer/test_data/
  site1/   ← used by app1 / user1
  site2/   ← used by app2 / user2
  site3/   ← used by app3 / user3
```

Note the absolute path to this directory — you will need it in Step 3.

## Step 2: Pull the Computation Image

```bash
docker pull coinstacteam/nfc-single-round-ridge-regression-freesurfer
```

## Step 3: Launch Three Electron Windows

Open three terminals and complete the setup in each before starting a run.

**Terminal 1 — site 1 (consortium leader)**
```bash
cd desktopApp/electronApp && npm run start-configured
```
Log in as `user1@email.com` / `password1`, then in the app:
1. Set **data directory** to the absolute path for site 1, e.g. `/Users/you/git/nfc-single-round-ridge-regression-freesurfer/test_data/site1`
2. Toggle **Active**
3. Toggle **Ready**

**Terminal 2 — site 2**
```bash
cd desktopApp/electronApp && npm run start-configured-2
```
Log in as `user2@email.com` / `password2`, then repeat steps 1–3 using `.../test_data/site2` as the data directory.

**Terminal 3 — site 3**
```bash
cd desktopApp/electronApp && npm run start-configured-3
```
Log in as `user3@email.com` / `password3`, then repeat steps 1–3 using `.../test_data/site3` as the data directory.

> **Notes:**
> - Each site's data directory must be a **distinct absolute path** — do not use `~`
> - The data directory setting persists across restarts; you only need to set it once per consortium per machine
> - Log in to all windows **before** starting a run — each window's edge client subscribes to run events on login
> - Checking the **Keep me logged in** at login is recommended during development, as it reduces the need to relogin across iterations.

## Step 4: Start the Run

Once all three windows show **Ready**, user1 (the consortium leader) can click **Start Run**.

Monitor progress in the run details view. Logs are written to `_devLogs/` in the repository root (after running `./configs/initialize_configs.sh`).
