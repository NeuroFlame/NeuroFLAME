set -e

docker build -f dockerfiles/Dockerfile-ci -t neuroflame/ci .
docker build -f dockerfiles/Dockerfile-api -t neuroflame/api .
docker build -f dockerfiles/Dockerfile-centralFederatedClient -t neuroflame/centralfederatedclient .
docker build -f dockerfiles/Dockerfile-fileServer -t neuroflame/fileserver .
docker build -f dockerfiles/Dockerfile-reactApp -t neuroflame/react .
docker build -f dockerfiles/Dockerfile-ui -t neuroflame/ui .
