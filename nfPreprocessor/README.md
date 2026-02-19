# nfPreprocessor

`nfPreprocessor` runs legacy COINSTAC preprocessing images locally without the old simulator/API flow.

It is designed for non-developers:

- run with no flags for guided prompts
- validates Docker availability (or Singularity/Apptainer with `--singularity`)
- creates/uses a reusable `nfPreRun.json` in the current folder
- stages files into legacy paths (`/input/local0/simulatorRun`)
- writes output into dated folders under `nfPreOutput/`
- caches singularity images in `nfPreOutput/images/` when `--singularity` is used

## Built-in preprocessor catalog

- `vbm-pre` -> `coinstacteam/vbm_pre`

Bundled compspec is stored at `specs/vbm-pre.compspec.json`.

## Usage

### Guided mode (recommended)

```bash
nfpreprocessor
```

Guided behavior:

- asks which computation to use
- auto-detects `covariates.csv` and asks to use it
- verifies referenced data files and asks for data root if needed
- creates `nfPreRun.json` (merged pre-run input)
- if `nfPreRun.json` already exists, asks to run it or create a new one
- when creating a new one, archives old file as `nfPreRun-<timestamp>.json`
- asks whether to run now or exit so you can edit `nfPreRun.json`
- stores each run in `nfPreOutput/<timestamp>/...`

### Direct mode

```bash
nfpreprocessor \
  --covariates-csv ./covariates.csv \
  --workspace ./nfPreOutput/your-run-name
```

or

```bash
nfpreprocessor \
  --pre-run ./nfPreRun.json
```

or (Singularity/Apptainer runtime):

```bash
nfpreprocessor \
  --covariates-csv ./covariates.csv \
  --singularity
```

Supported input sources:

- `--pre-run` preferred pre-run file (`nfPreRun.json`)
- `--covariates-csv` (recommended for first run generation)

Notes for CSV mode:

- CSV must have a `filename` column
- other columns become covariate fields for each subject
- file paths in `filename` are treated as relative to the CSV location

Preview merged payload without running a container:

```bash
nfpreprocessor \
  --covariates-csv ./covariates.csv \
  --dry-run
```

### `pre-run`

`pre-run` is the normal user file for this tool (`nfPreRun.json`), and includes merged settings + data sources.

## Standalone binaries (no Node install on user machine)

From this package directory:

```bash
npm run build:standalone
```

This creates platform binaries in `dist/` using `pkg`.

- distribute the matching binary for each OS/architecture
- end users need either Docker installed/running, or Singularity/Apptainer when using `--singularity`
