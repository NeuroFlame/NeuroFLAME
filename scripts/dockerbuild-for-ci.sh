set -e


# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Compute the absolute path to initialize_configs.sh
INIT_SCRIPT="$SCRIPT_DIR/../configs/initialize_configs.sh"

# Run the script with 'ci' argument
"$INIT_SCRIPT" ci

docker build -f dockerfiles/Dockerfile-ci -t neuroflame/ci .
docker build -f dockerfiles/Dockerfile-api -t neuroflame/api .
docker build -f dockerfiles/Dockerfile-centralFederatedClient -t neuroflame/centralfederatedclient .
docker build -f dockerfiles/Dockerfile-fileServer -t neuroflame/fileserver .
docker build -f dockerfiles/Dockerfile-reactApp -t neuroflame/react .
docker build -f dockerfiles/Dockerfile-ui -t neuroflame/ui .
