#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

YES=false
SKIP_VERSION=false
PUBLISH_NPM=false
DEPLOY_GH=false
ALLOW_DIRTY=false

usage() {
  cat <<'EOF'
Usage: npm run release -- [options]

Options:
  --yes            Skip interactive confirmations.
  --skip-version   Skip `changeset version`.
  --publish-npm    Run `changeset publish`.
  --deploy-gh      Publish Electron artifacts to GitHub release.
  --allow-dirty    Skip tracked-file clean check.
  --help           Show this help message.

Examples:
  npm run release
  npm run release -- --publish-npm
  npm run release -- --publish-npm --deploy-gh --yes
EOF
}

confirm() {
  local prompt="$1"
  if [ "$YES" = true ]; then
    return 0
  fi
  read -r -p "$prompt [y/N]: " response
  case "$response" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) return 1 ;;
  esac
}

check_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
}

has_unreleased_changesets() {
  local file
  shopt -s nullglob
  for file in "$ROOT_DIR"/.changeset/*.md; do
    if [ "$(basename "$file")" != "README.md" ]; then
      return 0
    fi
  done
  return 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --yes) YES=true ;;
    --skip-version) SKIP_VERSION=true ;;
    --publish-npm) PUBLISH_NPM=true ;;
    --deploy-gh) DEPLOY_GH=true ;;
    --allow-dirty) ALLOW_DIRTY=true ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

check_cmd npm
check_cmd npx
check_cmd git

if [ "$ALLOW_DIRTY" != true ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Tracked files are not clean. Commit/stash changes or rerun with --allow-dirty."
  exit 1
fi

echo "== NeuroFLAME Release Helper =="
echo "Repo: $ROOT_DIR"
echo
echo "Planned steps:"
echo "1) create changeset if needed, then changeset version (unless skipped)"
echo "2) commit + push version changes"
echo "3) changeset publish (optional)"
echo "4) build React app + edge client + electron app"
echo "5) electron dist (and optional GitHub release publish)"
echo

if [ "$SKIP_VERSION" != true ]; then
  if confirm "Run version bump with changesets now?"; then
    if has_unreleased_changesets; then
      npx changeset version
    else
      echo "No unreleased changesets found."
      if confirm "Create a new changeset now?"; then
        npx changeset
        if has_unreleased_changesets; then
          npx changeset version
        else
          echo "No changeset was created. Skipping version bump."
        fi
      else
        echo "Skipped changeset creation and version bump."
      fi
    fi
  else
    echo "Skipped version bump."
  fi
else
  echo "Skipping version bump (--skip-version)."
fi

if [ "$YES" != true ]; then
  echo
  echo "Next step: commit and push version changes before publishing."
  read -r -p "Press Enter after commit+push, or Ctrl+C to cancel."
fi

if [ "$PUBLISH_NPM" = true ]; then
  if confirm "Publish npm packages via changesets?"; then
    npx changeset publish
  else
    echo "Skipped npm publish."
  fi
else
  echo "Skipping npm publish (enable with --publish-npm)."
fi

echo
echo "Building desktop release prerequisites..."
(cd desktopApp/reactApp && npm install && npm run build)
(cd edgeFederatedClient && npm install && npm run build)
(cd desktopApp/electronApp && npm install && npm run build)

echo
if [ "$DEPLOY_GH" = true ]; then
  echo "Creating Electron dist and publishing GitHub release artifacts..."
  (cd desktopApp/electronApp && NODE_ENV=production DEPLOY=true npm run dist)
else
  echo "Creating Electron dist without GitHub publish..."
  (cd desktopApp/electronApp && npm run dist)
fi

echo
echo "Release flow complete."
echo "Desktop artifacts: desktopApp/electronApp/dist"
