#!/usr/bin/env bash
# NeuroFLAME full-lifecycle smoke test.
#
# Runs with zero setup — no login, no credentials to know or pass in. It
# logs in as a dedicated test account, creates a throwaway single-client
# consortium, runs a real computation against known test data (cloned
# fresh from a public repo, so this works on any machine — no dependency
# on whatever happens to already be on disk), reports success/failure,
# then always cleans up: deletes the test consortium, logs out, and stops
# the edge daemon — even if the run itself fails or the script is
# interrupted.
#
# Usage:
#   ./run-test-computation.sh
#
# TEST_USERNAME/TEST_PASSWORD below are a dedicated test account on the
# production server, not anyone's real credentials — safe to bake in for
# a script whose whole point is running unattended. Override with
# NEUROFLAME_USERNAME/NEUROFLAME_PASSWORD (or positional args) only if
# you deliberately want to run this as a different account.

set -uo pipefail

TEST_DATA_REPO="https://github.com/NeuroFlame/nfc-single-round-ridge-regression-freesurfer.git"
# Matches this repo's test_data/server/parameters.json exactly.
PARAMETERS='{"Dependents": {"4th-Ventricle": "float", "5th-Ventricle": "float"}, "Covariates": {"sex": "str", "isControl": "bool", "age": "float"}, "Lambda": 1, "IgnoreSubjectsWithMissingData": true, "StrictTypeChecking": false}'
RUN_TIMEOUT_SECONDS=300
TEST_USERNAME="user1"
TEST_PASSWORD="password1"

USERNAME="${1:-${NEUROFLAME_USERNAME:-$TEST_USERNAME}}"
PASSWORD="${2:-${NEUROFLAME_PASSWORD:-$TEST_PASSWORD}}"

if ! command -v neuroflame >/dev/null 2>&1; then
  echo "✘ neuroflame CLI not found on PATH" >&2
  exit 1
fi

WORKDIR=$(mktemp -d)
CONSORTIUM_ID=""
LOGGED_IN=0
EDGE_STARTED=0

# Always runs, success or failure — this is what makes it safe to run
# unattended: nothing gets left behind (a test consortium, a logged-in
# session, a running daemon) even if a step earlier fails or the script
# gets interrupted.
cleanup() {
  local exit_code=$?
  echo
  echo "--- Cleaning up ---"
  if [ -n "$CONSORTIUM_ID" ]; then
    echo "Deleting test consortium $CONSORTIUM_ID..."
    neuroflame consortium delete "$CONSORTIUM_ID" || echo "  (delete failed — may need manual cleanup)"
  fi
  if [ "$LOGGED_IN" = "1" ]; then
    neuroflame logout || true
  fi
  if [ "$EDGE_STARTED" = "1" ]; then
    neuroflame edge stop || true
  fi
  rm -rf "$WORKDIR"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

echo "=== NeuroFLAME full-lifecycle test ==="

echo
echo "--- Fetching known test data ---"
if ! git clone --depth 1 --quiet "$TEST_DATA_REPO" "$WORKDIR/repo"; then
  echo "✘ Could not clone $TEST_DATA_REPO" >&2
  exit 1
fi
DATA_DIR="$WORKDIR/repo/test_data/site1"
if [ ! -f "$DATA_DIR/covariates.csv" ]; then
  echo "✘ Expected test data not found at $DATA_DIR (repo layout may have changed)" >&2
  exit 1
fi
echo "✔ Test data ready at $DATA_DIR"

echo
echo "--- Logging in as $USERNAME ---"
if ! neuroflame login --username "$USERNAME" --password "$PASSWORD"; then
  echo "✘ Login failed" >&2
  exit 1
fi
LOGGED_IN=1

echo
echo "--- Finding the matching computation ---"
COMPUTATION_ID=$(neuroflame computation list --json | node -e '
  const list = JSON.parse(require("fs").readFileSync(0, "utf8"))
  const hit = list.find((c) => /ridge-regression-freesurfer/i.test(c.imageName))
  if (!hit) process.exit(1)
  console.log(hit.id)
')
if [ -z "$COMPUTATION_ID" ]; then
  echo "✘ Could not find the ridge-regression-freesurfer computation on this server" >&2
  exit 1
fi
echo "✔ Using computation $COMPUTATION_ID"

echo
echo "--- Creating a throwaway single-client consortium ---"
CONSORTIUM_ID=$(neuroflame consortium create "Automated smoke test $(date +%s)" \
  --description "Created by run-test-computation.sh — safe to delete" |
  sed -n 's/^Created consortium: //p')
if [ -z "$CONSORTIUM_ID" ]; then
  echo "✘ Failed to create test consortium" >&2
  exit 1
fi
echo "✔ Created $CONSORTIUM_ID"

neuroflame study set-computation "$CONSORTIUM_ID" "$COMPUTATION_ID"
neuroflame study set-parameters "$CONSORTIUM_ID" "$PARAMETERS"

echo
echo "--- Starting the edge client ---"
neuroflame edge start
EDGE_STARTED=1
neuroflame edge set-mount-dir "$CONSORTIUM_ID" "$DATA_DIR"
neuroflame consortium set-ready "$CONSORTIUM_ID" true

echo
echo "--- Starting the run ---"
RUN_ID=$(neuroflame run start "$CONSORTIUM_ID" --json | node -e '
  console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).runId)
')
if [ -z "$RUN_ID" ]; then
  echo "✘ Failed to start the run" >&2
  exit 1
fi
echo "Run ID: $RUN_ID"

echo
echo "--- Waiting for it to finish (up to ${RUN_TIMEOUT_SECONDS}s) ---"
DEADLINE=$((SECONDS + RUN_TIMEOUT_SECONDS))
STATUS=""
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  STATUS=$(neuroflame run show "$RUN_ID" --json | node -e '
    console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).status)
  ')
  if [ "$STATUS" = "Complete" ] || [ "$STATUS" = "Error" ]; then
    break
  fi
  sleep 5
done

echo
echo "=== Result ==="
case "$STATUS" in
  Complete)
    echo "✔ Run $RUN_ID completed successfully."
    exit 0
    ;;
  Error)
    echo "✘ Run $RUN_ID failed."
    neuroflame run show "$RUN_ID"
    exit 1
    ;;
  *)
    echo "✘ Run $RUN_ID did not finish within ${RUN_TIMEOUT_SECONDS}s (last status: $STATUS)"
    exit 1
    ;;
esac
