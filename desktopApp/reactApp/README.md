# NeuroFLAME React App

Vite-based renderer UI for the NeuroFLAME desktop app.

## Scripts

### `npm start`

Starts the Vite dev server at [http://localhost:3000](http://localhost:3000). Electron loads this URL in development.

Local development binds to loopback. The Docker image explicitly passes `--host 0.0.0.0` for container networking. In both cases, Vite only serves files within this renderer directory, excluding the rest of the workspace and its private run files.

### `npm run build`

Checks TypeScript, then creates a production build in the `build` folder (relative asset paths for Electron `file://`). Type errors fail the build.

### `npm test`

Checks the development server's file-access boundary over HTTP, including the Docker host override.

### `npm run preview`

Serves the production build locally on port 3000.
