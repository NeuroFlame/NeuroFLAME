# NeuroFLAME version compatibility

NeuroFLAME checks two separate contracts.

The Electron desktop and central API use their application release versions.
Their semantic-version major and minor components must match; patch releases
remain compatible. The central API exposes its version at `GET /version`. An
explicit mismatch prevents the embedded edge client from starting. A newer API
directs the user to the latest NeuroFLAME desktop release, while an older API
must be updated by the server administrator. A network outage does not produce
a separate version error screen.

Computation images use the exact computation API version stored in OCI image
metadata. Before provisioning, the central client pulls the configured image,
validates its metadata, and resolves a registry digest. The central API stores
that snapshot and sends the same digest to every participant. Docker clients
inspect the digest's labels again; Singularity and Apptainer caches are built
from and keyed by that digest. Images without the required metadata or with a
different computation API or NVFlare version are rejected before run data is
downloaded or mounted.
