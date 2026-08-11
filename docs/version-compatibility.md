# NeuroFLAME version compatibility

NeuroFLAME checks two separate contracts.

The Electron desktop and central API use their application release versions.
Their semantic-version major and minor components must match; patch releases
remain compatible. The central API exposes its version at `GET /version`. An
explicit mismatch prevents the embedded edge client from starting. A newer API
directs the user to the latest NeuroFLAME desktop release, while an older API
must be updated by the server administrator. A network outage does not produce
a separate version error screen.

MCP management tools are served by the central API and configured by the
desktop UI. Serialization of deidentified Results-page derivatives requires an
Electron release embedding edge-federated-client 1.8.0 or newer.

Computation images use the exact computation API version stored in OCI image
metadata. Before provisioning, the central client pulls the configured image,
validates its metadata, and resolves a registry digest. The central API stores
that snapshot and sends the same digest to every participant. Docker clients
inspect the digest's labels again; Singularity and Apptainer caches are built
from and keyed by that digest. Images without the required metadata or with a
different computation API or NVFlare version are rejected before run data is
downloaded or mounted.

The development-only central launcher instead selects an already-built local
Docker tag without pulling it. It validates the same metadata and pins the run
to the content-addressed Docker image ID. Edge and vault Docker clients verify
that exact ID and its labels before execution. This requires the local clients
to share a Docker daemon; local image IDs are intentionally unsupported by the
Singularity and Apptainer paths. Production startup defaults to registry
resolution, and `COMPUTATION_IMAGE_MODE=registry node dev-start.js` can be used
to exercise production resolution during development.
