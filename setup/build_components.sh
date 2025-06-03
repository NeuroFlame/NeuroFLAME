#!/bin/bash

cd edgeFederatedClient && CI=false npm run build && cd ..
cd desktopApp/reactApp && CI=false npm run build && cd ../..
cd desktopApp/electronApp && CI=false npm run build && cd ../..
