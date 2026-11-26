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

### Production service updates

The central production host checks GitHub's latest published stable release every
five minutes using `neuroflame-release-deploy.timer`. A push to `main`, draft
release, prerelease, or npm publication does not deploy production. Publish the
GitHub release only after npm packages and all desktop assets are available.

`scripts/deploy-published-release.py` fetches the release tag, verifies that its
commit belongs to `main`, and advances production to that exact commit. It uses
`npm ci` for the central API, central federated client, and file server, builds
them, then invokes the host's existing `scripts/restart-prod-services.sh` for an
ordered restart and readiness checks. Successful deployment records the tag and
commit in `~/.local/state/neuroflame-release/deployed.json`. Failures leave that
marker unchanged and are retried on the next check. Restarts interrupt active
runs, so publish releases between runs.

The updater refuses tracked local changes, non-forward updates, and older release
versions. It preserves untracked configuration and data. The timer uses the
verified Node 24 runtime installed under `/opt/neuroflame/node`; the three service
units use that runtime on their next restart too.

The installed controller is `/usr/local/lib/neuroflame/deploy-published-release.py`;
its service and timer definitions are checked in under `scripts/`. Keep that
installed copy in sync when changing the controller. Check status on production:

```bash
systemctl status neuroflame-release-deploy.timer
journalctl -u neuroflame-release-deploy.service --since today
cat ~/.local/state/neuroflame-release/deployed.json
```

After a release is published, trigger an immediate check with
`sudo systemctl start neuroflame-release-deploy.service`. Pause automatic updates
with `sudo systemctl stop neuroflame-release-deploy.timer`.
