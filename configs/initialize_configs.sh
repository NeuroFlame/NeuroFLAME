#!/bin/bash
set -e

# Get the directory the script resides in
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(realpath "$SCRIPT_DIR/..")"

# Use "ci" defaults if 'ci' is passed as the first argument
if [ "$1" == "ci" ]; then
  DEFAULTS_DIR="$SCRIPT_DIR/defaults/ci"
else
  DEFAULTS_DIR="$SCRIPT_DIR/defaults"
fi

# Ensure the defaults directory exists
if [ ! -d "$DEFAULTS_DIR" ]; then
    echo "Error: defaults directory does not exist at $DEFAULTS_DIR"
    exit 1
fi

# Copy all JSON files from defaults to the script directory
cp "$DEFAULTS_DIR"/*.json "$SCRIPT_DIR/"

# Replace {{REPO_DIR}} in each copied file
for file in "$SCRIPT_DIR/"*.json; do
    awk -v repo_dir="$REPO_DIR" '{gsub(/\{\{REPO_DIR\}\}/, repo_dir)}1' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
done

echo "Configuration files have been initialized from: $DEFAULTS_DIR"
