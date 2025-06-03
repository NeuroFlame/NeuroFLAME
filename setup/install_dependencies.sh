#!/bin/bash

cd edgeFederatedClient && npm install && cd ..
cd centralApi && npm install && cd ..
cd centralFederatedClient && npm install && cd ..
cd fileServer && npm install && cd ..
cd desktopApp/reactApp && npm install && cd ../..
cd desktopApp/electronApp && npm install && cd ../..