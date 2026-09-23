#!/usr/bin/env bash
# NeuroFLAME CLI readiness check.
#
# Verifies: the CLI is installed, you're logged in, centralApi is
# reachable, the edge client (if any) is reachable, and there's a usable
# container runtime for actually running computations. Share this with
# anyone setting up a new machine — nothing here is environment-specific.
#
# Usage: ./check-readiness.sh   (or: bash check-readiness.sh)

set -uo pipefail

PASS="✔"
FAIL="✘"
WARN="⚠"
failures=0

echo "=== NeuroFLAME CLI readiness check ==="
echo

# --- 1. Is the CLI even installed? -------------------------------------
if ! command -v neuroflame >/dev/null 2>&1; then
  echo "$FAIL neuroflame CLI not found on PATH"
  echo "    See cliAppClient/README.md 'Install' (npm run init from a checkout)."
  exit 1
fi
echo "$PASS neuroflame CLI installed ($(command -v neuroflame))"

# --- 2. Ask the CLI itself what it thinks is going on -------------------
STATUS_JSON=$(neuroflame status --json 2>/dev/null)
if [ -z "$STATUS_JSON" ]; then
  echo "$FAIL neuroflame status failed to run"
  exit 1
fi

# Parsed with node (already required to run the CLI at all) rather than
# grep/sed, since the JSON is pretty-printed across multiple lines.
PARSED=$(echo "$STATUS_JSON" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"))
  console.log([
    data.session ? "1" : "0",
    data.session ? data.session.username : "-",
    data.centralApi.reachable ? "1" : "0",
    data.edgeClient.reachable ? "1" : "0",
    data.edgeDaemon.running ? "1" : "0",
  ].join(" "))
')
read -r LOGGED_IN USERNAME CENTRAL_OK EDGE_OK DAEMON_RUNNING <<< "$PARSED"

if [ "$LOGGED_IN" = "1" ]; then
  echo "$PASS Logged in as $USERNAME"
else
  echo "$FAIL Not logged in — run: neuroflame login"
  failures=$((failures + 1))
fi

if [ "$CENTRAL_OK" = "1" ]; then
  echo "$PASS Central API reachable"
else
  echo "$FAIL Central API not reachable"
  failures=$((failures + 1))
fi

if [ "$EDGE_OK" = "1" ]; then
  echo "$PASS Edge client reachable"
else
  echo "$WARN Edge client not reachable — fine if you only need control-plane commands"
fi

if [ "$DAEMON_RUNNING" = "1" ]; then
  echo "$PASS CLI-managed edge daemon running"
else
  echo "$WARN No CLI-managed edge daemon running here (fine unless you're using" \
       "edge commands — neuroflame edge start)"
fi

# --- 3. Is there anything to actually run computations with? -----------
echo
echo "--- Container runtime ---"
if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  echo "$PASS Docker available and usable"
elif command -v singularity >/dev/null 2>&1 || command -v apptainer >/dev/null 2>&1; then
  RUNTIME=$(command -v singularity >/dev/null 2>&1 && echo singularity || echo apptainer)
  echo "$PASS $RUNTIME available"
  CONFIGURED=$(neuroflame edge get-container-service 2>/dev/null)
  if [ -n "$CONFIGURED" ] && [ "$CONFIGURED" != "singularity" ]; then
    echo "  $WARN Edge client's configured container service is '$CONFIGURED', not singularity:"
    echo "      neuroflame edge start --container-service singularity"
  fi
else
  echo "$FAIL No usable container runtime found (docker, or singularity/apptainer)"
  echo "    Computations can't actually run without one."
  failures=$((failures + 1))
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "$PASS All checks passed."
  exit 0
else
  echo "$FAIL $failures check(s) failed — see above."
  exit 1
fi
