#!/bin/bash
set -e

# Get the absolute path of the directory this script resides in
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export HOST_PROJECT_DIR="$SCRIPT_DIR"
echo "Using HOST_PROJECT_DIR: $HOST_PROJECT_DIR"

# Run docker compose using the env var
docker compose up --exit-code-from ui
