#!/usr/bin/env bash
# NeuroFLAME CLI readiness check — against the real production deployment.
#
# Runs with zero setup — logs in fresh as a dedicated test account, so
# there's nothing to know or configure beforehand. Verifies: the CLI is
# installed, login actually works, centralApi resolves to the real
# production server (not a dev/local override left over from somewhere)
# and is reachable, an edge client can actually be started here (a real
# `neuroflame edge start`, not just a passive check), and there's a usable
# container runtime for actually running computations. Share this with
# anyone setting up a new machine — nothing here is environment-specific.
#
# Always logs back out and stops whatever edge daemon it started at the
# end — even if a check fails or the script is interrupted — and prints a
# short report first. It only stops the daemon if *this invocation*
# actually started it: the CLI-managed daemon is a single, machine-wide
# process, so stopping one this script merely reconnected to would yank
# it out from under anything else relying on it.
#
# TEST_USERNAME/TEST_PASSWORD below are a dedicated test account on the
# production server, not anyone's real credentials — safe to bake in for
# a script whose whole point is running unattended. Override with
# NEUROFLAME_USERNAME/NEUROFLAME_PASSWORD (or positional args) only if
# you deliberately want to run this as a different account.
#
# Usage:
#   ./check-readiness.sh
#   NEUROFLAME_USERNAME=... NEUROFLAME_PASSWORD=... ./check-readiness.sh
#   NEUROFLAME_SKIP_EDGE_START=1 ./check-readiness.sh   # control-plane-only machine

set -uo pipefail

# Must match cliAppClient/src/config.ts's DEFAULT_HTTP_URL — this is what
# "production" means for this check. Override only if you're deliberately
# pointing this whole check at a different deployment.
PRODUCTION_HTTP_URL="${NEUROFLAME_EXPECTED_HTTP_URL:-https://trendscenterdev.org/graphql}"
TEST_USERNAME="user1"
TEST_PASSWORD="password1"
LOGIN_USERNAME="${1:-${NEUROFLAME_USERNAME:-$TEST_USERNAME}}"
LOGIN_PASSWORD="${2:-${NEUROFLAME_PASSWORD:-$TEST_PASSWORD}}"

PASS="✔"
FAIL="✘"
WARN="⚠"
failures=0
LOGGED_IN=0
EDGE_STARTED=0

# Always runs, success or failure — prints a short report, then logs out
# and stops the daemon (only if this invocation actually started it).
cleanup() {
  local exit_code=$?
  echo
  echo "=== Report ==="
  echo "Account tested: $LOGIN_USERNAME"
  echo "Target:         $PRODUCTION_HTTP_URL"
  if [ "$failures" -eq 0 ]; then
    echo "$PASS All checks passed."
  else
    echo "$FAIL $failures check(s) failed — see above."
  fi
  echo
  echo "--- Cleaning up ---"
  if [ "$EDGE_STARTED" = "1" ]; then
    neuroflame edge stop || true
  fi
  if [ "$LOGGED_IN" = "1" ]; then
    neuroflame logout || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

echo "=== NeuroFLAME CLI readiness check ==="
echo

# --- 1. Is the CLI even installed? -------------------------------------
if ! command -v neuroflame >/dev/null 2>&1; then
  echo "$FAIL neuroflame CLI not found on PATH"
  echo "    See cliAppClient/README.md 'Install' (npm run init from a checkout)."
  exit 1
fi
echo "$PASS neuroflame CLI installed ($(command -v neuroflame))"

# --- 2. Log in fresh as the test account --------------------------------
echo
echo "--- Logging in as $LOGIN_USERNAME ---"
if neuroflame login --username "$LOGIN_USERNAME" --password "$LOGIN_PASSWORD"; then
  LOGGED_IN=1
else
  echo "$FAIL Login failed for $LOGIN_USERNAME" >&2
  failures=$((failures + 1))
fi
echo

# --- 3. Ask the CLI itself what it thinks is going on -------------------
STATUS_JSON=$(neuroflame status --json 2>/dev/null)
if [ -z "$STATUS_JSON" ]; then
  echo "$FAIL neuroflame status failed to run"
  exit 1
fi

# Parsed with node (already required to run the CLI at all) rather than
# grep/sed, since the JSON is pretty-printed across multiple lines. Fields
# are tab-separated so a URL containing spaces (shouldn't happen, but) or
# an empty username doesn't shift the later fields.
PARSED=$(echo "$STATUS_JSON" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"))
  console.log([
    data.session ? "1" : "0",
    data.centralApi.reachable ? "1" : "0",
    data.centralApi.httpUrl,
    data.edgeClient.reachable ? "1" : "0",
  ].join("\t"))
')
IFS=$'\t' read -r SESSION_ACTIVE CENTRAL_OK CENTRAL_URL EDGE_OK <<< "$PARSED"

if [ "$CENTRAL_URL" = "$PRODUCTION_HTTP_URL" ]; then
  echo "$PASS Pointed at production ($CENTRAL_URL)"
else
  echo "$FAIL NOT pointed at production — resolved to $CENTRAL_URL, expected $PRODUCTION_HTTP_URL"
  echo "    Check NEUROFLAME_HTTP_URL and ~/.config/neuroflame-cli/config.json" \
       "(neuroflame status shows where the value came from)."
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

# --- 4. Can an edge client actually start here? -------------------------
# This is an active check, not a passive one: it really runs `neuroflame
# edge start` (idempotent — reconnects instead of double-spawning if one's
# already running, same as running it by hand), which leaves a real
# background daemon running on this machine afterward. Skip it with
# NEUROFLAME_SKIP_EDGE_START=1 for a machine that's deliberately
# control-plane-only.
if [ "${NEUROFLAME_SKIP_EDGE_START:-}" = "1" ]; then
  echo "$WARN Skipped edge start check (NEUROFLAME_SKIP_EDGE_START=1)"
elif [ "$LOGGED_IN" != "1" ]; then
  echo "$WARN Skipped edge start check — not logged in (see above)"
else
  DAEMON_ALREADY_RUNNING=$(neuroflame status --json | node -e '
    console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).edgeDaemon.running ? "1" : "0")
  ')
  if EDGE_START_OUTPUT=$(neuroflame edge start 2>&1); then
    echo "$PASS Edge client started (or already running)"
    if [ "$DAEMON_ALREADY_RUNNING" != "1" ]; then
      EDGE_STARTED=1
    fi
  else
    echo "$FAIL neuroflame edge start failed:"
    echo "$EDGE_START_OUTPUT" | sed 's/^/    /'
    failures=$((failures + 1))
  fi
fi

# --- 5. Is there anything to actually run computations with? -----------
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

# --- 6. System specs — informational, not pass/fail --------------------
# There's no universal "correct" amount of RAM/disk/bandwidth for running
# a computation — that depends on the specific computation and dataset —
# so this only reports, it never adds to $failures.
echo
echo "--- System specs ---"
if [ "$(uname -s)" = "Darwin" ]; then
  CPU_BRAND=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "unknown")
  CPU_CORES=$(sysctl -n hw.physicalcpu 2>/dev/null || echo "?")
  CPU_THREADS=$(sysctl -n hw.logicalcpu 2>/dev/null || echo "?")
  RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
  echo "CPU:  $CPU_BRAND ($CPU_CORES cores, $CPU_THREADS threads)"
elif [ -r /proc/cpuinfo ]; then
  CPU_BRAND=$(grep -m1 "model name" /proc/cpuinfo | sed 's/.*: //')
  CPU_CORES=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo)
  RAM_BYTES=$(($(grep MemTotal /proc/meminfo | awk '{print $2}') * 1024))
  echo "CPU:  ${CPU_BRAND:-unknown} ($CPU_CORES cores)"
else
  echo "CPU:  $WARN could not determine (unsupported platform)"
  RAM_BYTES=0
fi

if [ "${RAM_BYTES:-0}" -gt 0 ] 2>/dev/null; then
  echo "RAM:  $((RAM_BYTES / 1024 / 1024 / 1024)) GB"
else
  echo "RAM:  $WARN could not determine"
fi

DISK_LINE=$(df -h / | tail -1)
DISK_AVAIL=$(echo "$DISK_LINE" | awk '{print $4}')
DISK_TOTAL=$(echo "$DISK_LINE" | awk '{print $2}')
echo "Disk: $DISK_AVAIL free of $DISK_TOTAL on /"

bytes_per_sec_to_mbps() {
  echo "$1" | awk '{printf "%.1f", $1 * 8 / 1000000}'
}

if [ "${NEUROFLAME_SKIP_SPEEDTEST:-}" = "1" ]; then
  echo "Net:  $WARN skipped (NEUROFLAME_SKIP_SPEEDTEST=1)"
elif command -v curl >/dev/null 2>&1; then
  # Real, if rough, one-sample measurements against Cloudflare's
  # speed-test endpoint (well-known, reliable, no signup/API key needed),
  # timed by curl itself rather than a separate stopwatch.
  echo "Running Internet Speedtest"
  DOWN_BYTES_PER_SEC=$(curl -o /dev/null -s -w '%{speed_download}' \
    --max-time 20 "https://speed.cloudflare.com/__down?bytes=10000000" 2>/dev/null)
  if [ -n "$DOWN_BYTES_PER_SEC" ] && [ "${DOWN_BYTES_PER_SEC%.*}" -gt 0 ] 2>/dev/null; then
    echo "Net:  ~$(bytes_per_sec_to_mbps "$DOWN_BYTES_PER_SEC") Mbps down (10MB sample, one data point — not a full speed test)"
  else
    echo "Net:  $WARN download sample failed — check connectivity"
  fi

  UPLOAD_SAMPLE=$(mktemp)
  head -c 5000000 /dev/zero > "$UPLOAD_SAMPLE" 2>/dev/null
  UP_BYTES_PER_SEC=$(curl -o /dev/null -s -w '%{speed_upload}' \
    --max-time 20 -X POST --data-binary "@$UPLOAD_SAMPLE" "https://speed.cloudflare.com/__up" 2>/dev/null)
  rm -f "$UPLOAD_SAMPLE"
  if [ -n "$UP_BYTES_PER_SEC" ] && [ "${UP_BYTES_PER_SEC%.*}" -gt 0 ] 2>/dev/null; then
    echo "      ~$(bytes_per_sec_to_mbps "$UP_BYTES_PER_SEC") Mbps up (5MB sample, one data point — not a full speed test)"
  else
    echo "      $WARN upload sample failed — check connectivity"
  fi
else
  echo "Net:  $WARN skipped (curl not found)"
fi

if [ "$failures" -eq 0 ]; then
  exit 0
else
  exit 1
fi
