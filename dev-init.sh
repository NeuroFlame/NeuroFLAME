#!/bin/bash

set -e  # Exit on any error

# Function to load .env file if it exists
# Only sets variables that aren't already in the shell (allows override)
load_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        echo "Loading environment variables from $env_file"
        # Read .env file line by line
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments and empty lines
            [[ "$line" =~ ^[[:space:]]*# ]] && continue
            [[ -z "${line// }" ]] && continue
            
            # Extract key and value
            if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]// /}"
                local value="${BASH_REMATCH[2]}"
                
                # Remove surrounding quotes if present
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\'}"
                value="${value%\'}"
                
                # Only export if not already set (allows shell override)
                if [ -z "${!key}" ]; then
                    export "$key=$value"
                fi
            fi
        done < "$env_file"
    else
        echo "Warning: .env file not found at $env_file (some commands may fail if env vars are missing)"
    fi
}

# Load .env files for services that need them
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
load_env_file "$SCRIPT_DIR/centralApi/.env"
load_env_file "$SCRIPT_DIR/centralFederatedClient/.env"
load_env_file "$SCRIPT_DIR/fileServer/.env"

# Install dependencies
for dir in centralApi edgeFederatedClient centralFederatedClient fileServer desktopApp/reactApp desktopApp/electronApp; do
  echo "Installing dependencies in $dir"
  (cd "$dir" && npm install)
done

# Initialize configs
echo "Initializing configs"
(cd configs && ./initialize_configs.sh)

# Start Docker containers for the dev DB
echo "Starting devCentralDatabase containers"
(cd _devCentralDatabase && docker compose up -d)

# Build projects
for dir in edgeFederatedClient desktopApp/reactApp desktopApp/electronApp; do
  echo "Building project in $dir"
  (cd "$dir" && npm run build)
done

# Seed centralApi
echo "Seeding centralApi"
(cd centralApi && npm run seed)

echo "All tasks completed!"

