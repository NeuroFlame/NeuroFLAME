#!/bin/bash

# Control script for NeuroFLAME dev services.
#
# Usage:
#   ./dev-ctl.sh start         Start all services in the background
#   ./dev-ctl.sh status        Show running services and overall health
#   ./dev-ctl.sh stop          Kill all running services
#   ./dev-ctl.sh restart       Kill all running services, then start them
#   ./dev-ctl.sh logs          Follow logs for all services (Ctrl+C to stop)
#   ./dev-ctl.sh logs <svc>    Follow logs for one service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/_devLogs"
PID_DIR="$LOG_DIR"

# --- Resolve ports from each service's own config (fallback to its documented default) ---

read_env_var() {
  # read_env_var <file> <key> — last matching, uncommented assignment wins
  local file="$1" key="$2" line value
  [ -f "$file" ] || return 0
  line=$(grep -E "^${key}=" "$file" | tail -1)
  [ -z "$line" ] && return 0
  value="${line#*=}"
  value="${value%$'\r'}"                     # strip trailing CR (CRLF files)
  value="${value%\"}"; value="${value#\"}"   # strip surrounding double quotes
  value="${value%\'}"; value="${value#\'}"   # strip surrounding single quotes
  echo "$value"
}

CENTRAL_API_PORT="$(read_env_var "$SCRIPT_DIR/centralApi/.env" APOLLO_PORT)"
CENTRAL_API_PORT="${CENTRAL_API_PORT:-3001}"
FILE_SERVER_PORT="$(read_env_var "$SCRIPT_DIR/fileServer/.env" FILE_SERVER_PORT)"
FILE_SERVER_PORT="${FILE_SERVER_PORT:-3002}"
# react-scripts has no dedicated .env in this repo; 3000 is its own documented default.
REACT_APP_PORT="$(read_env_var "$SCRIPT_DIR/desktopApp/reactApp/.env" PORT)"
REACT_APP_PORT="${REACT_APP_PORT:-3000}"

# centralApi's DATABASE_URI is the authoritative source for where Mongo should be —
# parsed only for the plain "mongodb://" scheme; mongodb+srv:// resolves its host/port
# via DNS, so there's nothing simple to pre-check there and MONGO_HOST is left empty.
MONGO_HOST=""
MONGO_PORT=""
MONGO_URI="$(read_env_var "$SCRIPT_DIR/centralApi/.env" DATABASE_URI)"
case "$MONGO_URI" in
  mongodb://*)
    mongo_hostpart="${MONGO_URI#mongodb://}"
    mongo_hostpart="${mongo_hostpart#*@}"    # drop user:pass@ (no-op if absent)
    mongo_hostpart="${mongo_hostpart%%/*}"   # drop /database
    mongo_hostpart="${mongo_hostpart%%\?*}"  # drop ?options
    mongo_hostpart="${mongo_hostpart%%,*}"   # first host only, in a replica-set list
    MONGO_HOST="${mongo_hostpart%%:*}"
    if [ "$mongo_hostpart" != "$MONGO_HOST" ]; then
      MONGO_PORT="${mongo_hostpart##*:}"
    else
      MONGO_PORT="27017"
    fi
    ;;
esac

usage() {
  echo "Usage: $(basename "$0") <command>"
  echo ""
  echo "  start      Start all services in the background"
  echo "  status     Show running services and overall health"
  echo "  stop       Kill all running services"
  echo "  restart    Kill all running services, then start them"
  echo "  logs       Follow logs for all services (Ctrl+C to stop)"
  echo "  logs <svc> Follow logs for one service:"
  echo "             centralApi | centralFederatedClient (cfc) | fileServer | reactApp"
  exit 1
}

[ $# -eq 0 ] && usage

MODE=""
case "$1" in
  start)   MODE=start ;;
  status)  MODE=list ;;
  stop)    MODE=kill ;;
  restart) MODE=force ;;
  logs)    MODE=logs ;;
  *) echo "Unknown command: $1"; usage ;;
esac

# --- Detect service state (skipped for logs) ---

if [ "$MODE" != "logs" ]; then

# A PID file is authoritative: it records what dev-ctl.sh itself started.
# is_managed_pid <pidfile> <name> — echoes the PID if the file names a live process, else prunes a stale file.
is_managed_pid() {
  local pidfile="$1" pid
  [ -f "$pidfile" ] || return 0
  pid=$(cat "$pidfile" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "$pid"
  else
    rm -f "$pidfile"
  fi
}

CENTRAL_API_PID=$(is_managed_pid "$PID_DIR/centralApi.pid")
FILE_SERVER_PID=$(is_managed_pid "$PID_DIR/fileServer.pid")
REACT_APP_PID=$(is_managed_pid "$PID_DIR/reactApp.pid")
CFC_PID=$(is_managed_pid "$PID_DIR/centralFederatedClient.pid")
CFC_PIDS=()
[ -n "$CFC_PID" ] && CFC_PIDS+=("$CFC_PID")

# Live port occupancy, checked separately from the PID files above — used to warn about
# (never to kill) processes on our ports that dev-ctl.sh did not itself start.
# bash 3.2 (macOS's stock /bin/bash) has no associative arrays, hence the explicit trio below.
SERVICE_PORTS=("$REACT_APP_PORT" "$CENTRAL_API_PORT" "$FILE_SERVER_PORT")
UNMANAGED_PORT_USERS=()
check_unmanaged_port() {
  local port="$1" managed="$2" occupant
  occupant=$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)
  # Nothing dev-ctl.sh started is on this port, yet something is listening on it.
  if [ -n "$occupant" ] && [ -z "$managed" ]; then
    UNMANAGED_PORT_USERS+=("$port:$occupant")
  fi
  return 0
}
check_unmanaged_port "$REACT_APP_PORT" "$REACT_APP_PID"
check_unmanaged_port "$CENTRAL_API_PORT" "$CENTRAL_API_PID"
check_unmanaged_port "$FILE_SERVER_PORT" "$FILE_SERVER_PID"

CFC_DIR="$SCRIPT_DIR/centralFederatedClient"
UNMANAGED_CFC_PIDS=()
if [ -z "$CFC_PID" ]; then
  for pid in $(pgrep -x "node" 2>/dev/null || true); do
    cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | head -1 | sed 's/^n//')
    if [ "$cwd" = "$CFC_DIR" ]; then
      UNMANAGED_CFC_PIDS+=("$pid")
    fi
  done
fi

# Everything dev-ctl.sh actually started, i.e. safe for `stop`/`restart` to kill.
MANAGED=()
[ -n "$CENTRAL_API_PID" ] && MANAGED+=("centralApi:$CENTRAL_API_PID")
[ -n "$FILE_SERVER_PID" ] && MANAGED+=("fileServer:$FILE_SERVER_PID")
[ -n "$REACT_APP_PID" ]   && MANAGED+=("reactApp:$REACT_APP_PID")
[ -n "$CFC_PID" ]         && MANAGED+=("centralFederatedClient:$CFC_PID")

COMPUTATION_CONTAINERS=()
RESERVATION_CONTAINERS=()
if docker info &>/dev/null; then
  while IFS= read -r id; do
    [ -n "$id" ] && COMPUTATION_CONTAINERS+=("$id")
  done < <(docker ps -aq --filter label=org.neuroflame.computation 2>/dev/null)
  while IFS= read -r id; do
    [ -n "$id" ] && RESERVATION_CONTAINERS+=("$id")
  done < <(docker ps -aq --filter label=org.neuroflame.port-reservation 2>/dev/null)
fi

HAS_MANAGED=false
[ ${#MANAGED[@]} -gt 0 ]                 && HAS_MANAGED=true
[ ${#COMPUTATION_CONTAINERS[@]} -gt 0 ]  && HAS_MANAGED=true
[ ${#RESERVATION_CONTAINERS[@]} -gt 0 ]  && HAS_MANAGED=true

HAS_UNMANAGED=false
[ ${#UNMANAGED_PORT_USERS[@]} -gt 0 ] && HAS_UNMANAGED=true
[ ${#UNMANAGED_CFC_PIDS[@]} -gt 0 ]   && HAS_UNMANAGED=true

fi # end service detection

# --- Helpers ---

print_conflicts() {
  for entry in "${MANAGED[@]}"; do
    name="${entry%%:*}"; pid="${entry##*:}"
    echo "  $name: PID $pid (started by dev-ctl.sh)"
  done
  for id in "${COMPUTATION_CONTAINERS[@]}"; do
    echo "  computation container: $id (started by dev-ctl.sh runs)"
  done
  for id in "${RESERVATION_CONTAINERS[@]}"; do
    echo "  port-reservation container: $id (started by dev-ctl.sh runs)"
  done
  for entry in "${UNMANAGED_PORT_USERS[@]}"; do
    port="${entry%%:*}"; pid="${entry##*:}"
    echo "  port $port: PID $pid (NOT started by dev-ctl.sh — will not be killed automatically)"
  done
  for pid in "${UNMANAGED_CFC_PIDS[@]}"; do
    echo "  centralFederatedClient: PID $pid (NOT started by dev-ctl.sh — will not be killed automatically)"
  done
}

# pid_tree <pid> — echoes <pid> and all of its live descendants, any depth.
# Needed because a backgrounded "bash -c 'cd X && node Y'" and "npm start" can
# each leave the port-holding process running as a *child* of the PID we recorded.
pid_tree() {
  local pid="$1" child
  echo "$pid"
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    pid_tree "$child"
  done
}

# kill_managed <label> <pid> — TERM the whole tree rooted at <pid>, SIGKILL stragglers.
kill_managed() {
  local label="$1" root="$2" pids pid
  if ! kill -0 "$root" 2>/dev/null; then
    echo "  $label: PID $root already gone"
    rm -f "$PID_DIR/$label.pid"
    return 0
  fi
  pids=$(pid_tree "$root")
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
  echo "  Killed $label (PID $root)"
  rm -f "$PID_DIR/$label.pid"

  sleep 2
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "    PID $pid still alive — sending SIGKILL..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

do_kill() {
  if [ ${#COMPUTATION_CONTAINERS[@]} -gt 0 ]; then
    echo "Killing computation container(s)..."
    for id in "${COMPUTATION_CONTAINERS[@]}"; do
      docker rm -f "$id" 2>/dev/null && echo "  Removed $id" || echo "  $id already gone"
    done
  fi
  if [ ${#RESERVATION_CONTAINERS[@]} -gt 0 ]; then
    echo "Killing port-reservation container(s)..."
    for id in "${RESERVATION_CONTAINERS[@]}"; do
      docker rm -f "$id" 2>/dev/null && echo "  Removed $id" || echo "  $id already gone"
    done
  fi
  if [ ${#MANAGED[@]} -gt 0 ]; then
    echo "Stopping services started by dev-ctl.sh..."
    for entry in "${MANAGED[@]}"; do
      name="${entry%%:*}"; pid="${entry##*:}"
      kill_managed "$name" "$pid"
    done
  fi
  if [ "$HAS_UNMANAGED" = true ]; then
    echo "Note: some processes on our ports were not started by dev-ctl.sh and were left running:"
    for entry in "${UNMANAGED_PORT_USERS[@]}"; do
      port="${entry%%:*}"; pid="${entry##*:}"
      echo "  port $port: PID $pid"
    done
    for pid in "${UNMANAGED_CFC_PIDS[@]}"; do
      echo "  centralFederatedClient: PID $pid"
    done
  fi
  return 0
}


# spawn <label> <workdir> <command...> — background <command>, recording the PID that
# actually ends up running it (not a "bash -c" wrapper) via exec inside a subshell.
spawn() {
  local label="$1" workdir="$2"; shift 2
  ( cd "$workdir" && exec "$@" ) >> "$LOG_DIR/$label.log" 2>&1 &
  disown $!
  echo $! > "$PID_DIR/$label.pid"
}

# mongo_reachable <host> <port> — plain TCP probe, no mongo client/driver needed.
mongo_reachable() {
  local host="$1" port="$2"
  if [ -z "$host" ] || [ -z "$port" ]; then
    return 1
  fi
  if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then
    return 0
  else
    return 1
  fi
}

do_start() {
  mkdir -p "$LOG_DIR"

  # centralApi (and transitively centralFederatedClient) will just crash-loop without
  # Mongo, so fail fast here instead of spawning anything.
  if [ -n "$MONGO_HOST" ]; then
    if ! mongo_reachable "$MONGO_HOST" "$MONGO_PORT"; then
      echo "Error: MongoDB is not reachable at $MONGO_HOST:$MONGO_PORT (from centralApi/.env DATABASE_URI)."
      echo "centralApi depends on it, so starting anyway would just crash-loop centralApi and centralFederatedClient."
      echo ""
      echo "Start it, per docs/developer-guide.md:"
      echo "  cd _devCentralDatabase && docker compose up -d && cd .."
      exit 1
    fi
  fi

  echo "Starting services (logs in _devLogs/)..."

  spawn centralApi "$SCRIPT_DIR/centralApi" node dev-start.js
  echo "  centralApi              → _devLogs/centralApi.log"

  # CFC subscribes to centralApi on startup, so centralApi must be ready first.
  # (fix/smart-retry makes CFC resilient to this race, but that is a separate PR.)
  printf "  Waiting for centralApi"
  api_up=false
  for i in $(seq 1 30); do
    if curl -sf -o /dev/null "http://localhost:$CENTRAL_API_PORT/version"; then
      api_up=true
      break
    fi
    sleep 1
    printf "."
  done
  echo ""
  if [ "$api_up" != true ]; then
    echo "  Warning: centralApi did not respond healthy on /version within 30s — continuing anyway." \
      "Check _devLogs/centralApi.log."
  fi

  spawn centralFederatedClient "$SCRIPT_DIR/centralFederatedClient" node dev-start.js
  echo "  centralFederatedClient  → _devLogs/centralFederatedClient.log"

  spawn fileServer "$SCRIPT_DIR/fileServer" node dev-start.js
  echo "  fileServer              → _devLogs/fileServer.log"

  spawn reactApp "$SCRIPT_DIR/desktopApp/reactApp" npm start
  echo "  reactApp/webpack        → _devLogs/reactApp.log"

  echo ""
  echo "Use './dev-ctl.sh logs' to follow all logs."
}

# --- Execute ---

case "$MODE" in
  list)
    svc_line() {
      local name="$1" pid="$2"
      if [ -n "$pid" ]; then
        printf "  %-40s up (PID %s)\n" "$name" "$pid"
      else
        printf "  %-40s DOWN\n" "$name"
      fi
    }
    echo "Services:"
    svc_line "centralApi          (port $CENTRAL_API_PORT)" "$CENTRAL_API_PID"
    svc_line "fileServer          (port $FILE_SERVER_PORT)" "$FILE_SERVER_PID"
    if [ ${#CFC_PIDS[@]} -gt 0 ]; then
      printf "  %-40s up (PIDs %s)\n" "centralFederatedClient" "${CFC_PIDS[*]}"
    else
      printf "  %-40s DOWN\n" "centralFederatedClient"
    fi
    svc_line "reactApp/webpack    (port $REACT_APP_PORT)" "$REACT_APP_PID"
    if [ "$HAS_UNMANAGED" = true ]; then
      echo ""
      echo "Note: found process(es) not started by dev-ctl.sh:"
      print_conflicts | grep 'NOT started'
    fi
    if [ ${#COMPUTATION_CONTAINERS[@]} -gt 0 ] || [ ${#RESERVATION_CONTAINERS[@]} -gt 0 ]; then
      echo ""
      echo "Containers:"
      for id in "${COMPUTATION_CONTAINERS[@]}"; do
        state=$(docker inspect --format='{{.State.Status}}' "$id" 2>/dev/null || echo "unknown")
        echo "  computation:       $id ($state)"
      done
      for id in "${RESERVATION_CONTAINERS[@]}"; do
        state=$(docker inspect --format='{{.State.Status}}' "$id" 2>/dev/null || echo "unknown")
        echo "  port-reservation:  $id ($state)"
      done
    fi
    echo ""
    all_up=true
    [ -z "$CENTRAL_API_PID" ]  && all_up=false
    [ -z "$FILE_SERVER_PID" ]  && all_up=false
    [ ${#CFC_PIDS[@]} -eq 0 ]  && all_up=false
    [ -z "$REACT_APP_PID" ]    && all_up=false
    if [ "$all_up" = true ]; then
      echo "All services running."
    else
      echo "Status: incomplete — one or more services are down."
    fi
    ;;

  kill)
    if [ "$HAS_MANAGED" = false ]; then
      echo "Nothing to kill."
    else
      do_kill
      echo "Done."
    fi
    if [ "$HAS_UNMANAGED" = true ]; then
      echo ""
      echo "Left alone (not started by dev-ctl.sh):"
      print_conflicts | grep 'NOT started'
    fi
    ;;

  start)
    if [ "$HAS_MANAGED" = true ] || [ "$HAS_UNMANAGED" = true ]; then
      echo "Error: existing processes found that would conflict with a fresh start:"
      print_conflicts
      echo ""
      if [ "$HAS_MANAGED" = true ]; then
        echo "Run './dev-ctl.sh restart' to kill dev-ctl.sh's own processes and start fresh."
      fi
      if [ "$HAS_UNMANAGED" = true ]; then
        echo "The processes above were NOT started by dev-ctl.sh, so 'restart' will not touch them — free them yourself first."
      fi
      exit 1
    fi
    do_start
    ;;

  force)
    if [ "$HAS_MANAGED" = true ]; then
      do_kill
    fi
    # Recompute fresh: do_kill only ever clears what dev-ctl.sh itself started,
    # so anything still here is an unmanaged process blocking our ports.
    REMAINING=()
    for port in "${SERVICE_PORTS[@]}"; do
      pid=$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)
      [ -n "$pid" ] && REMAINING+=("$port:$pid")
    done
    REMAINING_CFC=()
    for pid in $(pgrep -x "node" 2>/dev/null || true); do
      cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | head -1 | sed 's/^n//')
      [ "$cwd" = "$CFC_DIR" ] && REMAINING_CFC+=("$pid")
    done
    if [ ${#REMAINING[@]} -gt 0 ] || [ ${#REMAINING_CFC[@]} -gt 0 ]; then
      echo "Error: could not clear all services — these were not started by dev-ctl.sh, so it will not kill them:"
      for entry in "${REMAINING[@]}"; do
        port="${entry%%:*}"; pid="${entry##*:}"
        echo "  Port $port: PID $pid still running"
      done
      for pid in "${REMAINING_CFC[@]}"; do
        echo "  centralFederatedClient: PID $pid still running"
      done
      exit 1
    fi
    [ "$HAS_MANAGED" = true ] && echo "All services clear."
    do_start
    ;;

  logs)
    if [ ! -d "$LOG_DIR" ]; then
      echo "No logs yet — run './dev-ctl.sh start' first."
      exit 1
    fi
    SVC="${2:-}"
    case "$SVC" in
      "")
        tail -f "$LOG_DIR/centralApi.log" \
                "$LOG_DIR/centralFederatedClient.log" \
                "$LOG_DIR/fileServer.log" \
                "$LOG_DIR/reactApp.log"
        ;;
      centralApi)             tail -f "$LOG_DIR/centralApi.log" ;;
      centralFederatedClient|cfc) tail -f "$LOG_DIR/centralFederatedClient.log" ;;
      fileServer)             tail -f "$LOG_DIR/fileServer.log" ;;
      reactApp)               tail -f "$LOG_DIR/reactApp.log" ;;
      *)
        echo "Unknown service: $SVC"
        echo "Known: centralApi | centralFederatedClient (cfc) | fileServer | reactApp"
        exit 1
        ;;
    esac
    ;;
esac
