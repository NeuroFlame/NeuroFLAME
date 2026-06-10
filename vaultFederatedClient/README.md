# NeuroFLAME Vault Federated Client

The vault federated client runs on a data provider machine and keeps one or more hosted datasets online for NeuroFLAME runs. It connects to the central API, reports dataset availability through heartbeat messages, and launches computation containers when central starts a run for one of its hosted vaults.

## Install

Install the package globally on the vault host:

```bash
sudo npm install -g @neuroflame/vault
```

The global command is:

```bash
neuroflame-vault
```

## Create A Vault Token

In the NeuroFLAME desktop app, use the admin vault page to create a vault user. Copy the returned token and use it as `VAULT_ACCESS_TOKEN`.

That token identifies this vault service to central. After the service starts and sends a heartbeat, central creates the vault server record and shows its reported datasets in the admin vault page.

## Environment

The client is configured by environment variables.

Required:

```bash
VAULT_HTTP_URL=https://your-central-api.example.com/graphql
VAULT_WS_URL=wss://your-central-api.example.com/graphql
VAULT_ACCESS_TOKEN=your-vault-token
VAULT_BASE_DIR=/var/lib/neuroflame/vault/work
VAULT_DATASET_DIR=/path/to/your/datasets
```

Optional:

```bash
VAULT_LOG_PATH=/var/log/neuroflame/vault
VAULT_CONTAINER_SERVICE=docker
```

`VAULT_DATASET_DIR` should contain one directory per dataset. Each child directory is reported to central as an available dataset key.

## Data Discovery

Vault dataset discovery is directory based. On each heartbeat, the vault client scans the immediate child directories under `VAULT_DATASET_DIR`.

For example:

```text
/data/neuroflame-vault/
  freesurfer-site1/
  vbm-data/
```

With `VAULT_DATASET_DIR=/data/neuroflame-vault`, central receives two available dataset keys:

```text
freesurfer-site1
vbm-data
```

The scan is not recursive. Files directly inside `VAULT_DATASET_DIR` are ignored, and nested folders are treated as part of their parent dataset. Admins create hosted vault entries from these reported dataset keys in the NeuroFLAME admin vault page.

## Commands

Validate required environment:

```bash
neuroflame-vault validate
```

Print the effective environment, with the access token masked:

```bash
neuroflame-vault env
```

Start the vault service:

```bash
neuroflame-vault start
```

Write a systemd service template into the current directory:

```bash
neuroflame-vault systemd-template
```

Overwrite an existing local template:

```bash
neuroflame-vault systemd-template --force
```

## systemd

Generate a local template:

```bash
neuroflame-vault systemd-template
```

Edit `./neuroflame-vault.service` and replace the inline `Environment=` examples with real values.

Install and start the service:

```bash
sudo cp ./neuroflame-vault.service /etc/systemd/system/neuroflame-vault.service
sudo systemctl daemon-reload
sudo systemctl enable neuroflame-vault
sudo systemctl start neuroflame-vault
```

View logs:

```bash
journalctl -u neuroflame-vault -f
```

## Dataset Lifecycle

1. Admin creates a vault user in the desktop app and copies the token.
2. Operator installs `@neuroflame/vault` on the vault host.
3. Operator configures the systemd template with the central URLs, token, work directory, and dataset directory.
4. Vault service starts and sends heartbeat with available dataset directories.
5. Admin creates hosted vault entries from the reported datasets.
6. Consortium leaders add those hosted vaults to consortia.

## Local Development

For local repo development:

```bash
npm install
npm run compile
VAULT_HTTP_URL=http://localhost:4000/graphql \
VAULT_WS_URL=ws://localhost:4000/graphql \
VAULT_ACCESS_TOKEN=your-vault-token \
VAULT_BASE_DIR=/tmp/neuroflame-vault/work \
VAULT_DATASET_DIR=/tmp/neuroflame-vault/datasets \
npm start
```
