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

REACT_APP_PID=$(lsof -iTCP:3000 -sTCP:LISTEN -n -P -t 2>/dev/null || true)
CENTRAL_API_PID=$(lsof -iTCP:3001 -sTCP:LISTEN -n -P -t 2>/dev/null || true)
FILE_SERVER_PID=$(lsof -iTCP:3002 -sTCP:LISTEN -n -P -t 2>/dev/null || true)

SERVICE_PORTS=(3000 3001 3002)
PORT_CONFLICTS=()
[ -n "$REACT_APP_PID" ]   && PORT_CONFLICTS+=("3000:$REACT_APP_PID")
[ -n "$CENTRAL_API_PID" ] && PORT_CONFLICTS+=("3001:$CENTRAL_API_PID")
[ -n "$FILE_SERVER_PID" ] && PORT_CONFLICTS+=("3002:$FILE_SERVER_PID")

CFC_DIR="$SCRIPT_DIR/centralFederatedClient"
CFC_PIDS=()
for pid in $(pgrep -x "node" 2>/dev/null || true); do
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | head -1 | sed 's/^n//')
  if [ "$cwd" = "$CFC_DIR" ]; then
    CFC_PIDS+=("$pid")
  fi
done

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

HAS_CONFLICTS=false
[ ${#PORT_CONFLICTS[@]} -gt 0 ]          && HAS_CONFLICTS=true
[ ${#CFC_PIDS[@]} -gt 0 ]                && HAS_CONFLICTS=true
[ ${#COMPUTATION_CONTAINERS[@]} -gt 0 ]  && HAS_CONFLICTS=true
[ ${#RESERVATION_CONTAINERS[@]} -gt 0 ]  && HAS_CONFLICTS=true

fi # end service detection

# --- Helpers ---

print_conflicts() {
  for entry in "${PORT_CONFLICTS[@]}"; do
    port="${entry%%:*}"; pid="${entry##*:}"
    echo "  service port $port: PID $pid"
  done
  for pid in "${CFC_PIDS[@]}"; do
    echo "  centralFederatedClient: PID $pid"
  done
  for id in "${COMPUTATION_CONTAINERS[@]}"; do
    echo "  computation container: $id"
  done
  for id in "${RESERVATION_CONTAINERS[@]}"; do
    echo "  port-reservation container: $id"
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
  if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
    echo "Killing processes on service ports..."
    for entry in "${PORT_CONFLICTS[@]}"; do
      port="${entry%%:*}"; pid="${entry##*:}"
      kill "$pid" 2>/dev/null && echo "  Killed PID $pid (port $port)" || echo "  PID $pid already gone"
    done
  fi
  if [ ${#CFC_PIDS[@]} -gt 0 ]; then
    echo "Killing centralFederatedClient process(es)..."
    for pid in "${CFC_PIDS[@]}"; do
      kill "$pid" 2>/dev/null && echo "  Killed PID $pid (centralFederatedClient)" || echo "  PID $pid already gone"
    done
  fi

  # dev-start.js spawns child processes; SIGTERM takes time to propagate.
  # Wait, then SIGKILL anything still holding a port or running as CFC.
  sleep 2
  for port in "${SERVICE_PORTS[@]}"; do
    strag=$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)
    if [ -n "$strag" ]; then
      echo "  Port $port still occupied (PID $strag) — sending SIGKILL..."
      kill -9 "$strag" 2>/dev/null || true
    fi
  done
  for strag in $(pgrep -x "node" 2>/dev/null || true); do
    strag_cwd=$(lsof -a -p "$strag" -d cwd -Fn 2>/dev/null | grep '^n' | head -1 | sed 's/^n//')
    if [ "$strag_cwd" = "$CFC_DIR" ]; then
      echo "  CFC process PID $strag still running — sending SIGKILL..."
      kill -9 "$strag" 2>/dev/null || true
    fi
  done
}

do_start() {
  mkdir -p "$LOG_DIR"

  echo "Starting services (logs in _devLogs/)..."

  nohup bash -c "cd '$SCRIPT_DIR/centralApi' && node dev-start.js" \
    >> "$LOG_DIR/centralApi.log" 2>&1 &
  disown $!
  echo "  centralApi              → _devLogs/centralApi.log"

  # CFC subscribes to centralApi on startup, so centralApi must be ready first.
  # (fix/smart-retry makes CFC resilient to this race, but that is a separate PR.)
  printf "  Waiting for centralApi"
  for i in $(seq 1 30); do
    lsof -iTCP:3001 -sTCP:LISTEN -n -P -t &>/dev/null && break
    sleep 1
    printf "."
  done
  echo ""

  nohup bash -c "cd '$SCRIPT_DIR/centralFederatedClient' && node dev-start.js" \
    >> "$LOG_DIR/centralFederatedClient.log" 2>&1 &
  disown $!
  echo "  centralFederatedClient  → _devLogs/centralFederatedClient.log"

  nohup bash -c "cd '$SCRIPT_DIR/fileServer' && node dev-start.js" \
    >> "$LOG_DIR/fileServer.log" 2>&1 &
  disown $!
  echo "  fileServer              → _devLogs/fileServer.log"

  nohup bash -c "cd '$SCRIPT_DIR/desktopApp/reactApp' && npm start" \
    >> "$LOG_DIR/reactApp.log" 2>&1 &
  disown $!
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
    svc_line "centralApi          (port 3001)" "$CENTRAL_API_PID"
    svc_line "fileServer          (port 3002)" "$FILE_SERVER_PID"
    if [ ${#CFC_PIDS[@]} -gt 0 ]; then
      printf "  %-40s up (PIDs %s)\n" "centralFederatedClient" "${CFC_PIDS[*]}"
    else
      printf "  %-40s DOWN\n" "centralFederatedClient"
    fi
    svc_line "reactApp/webpack    (port 3000)" "$REACT_APP_PID"
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
    if [ "$HAS_CONFLICTS" = false ]; then
      echo "Nothing to kill."
    else
      do_kill
      echo "Done."
    fi
    ;;

  start)
    if [ "$HAS_CONFLICTS" = true ]; then
      echo "Error: existing processes found that would conflict with a fresh start:"
      print_conflicts
      echo ""
      echo "Run './dev-ctl.sh restart' to kill them and start fresh."
      exit 1
    fi
    do_start
    ;;

  force)
    if [ "$HAS_CONFLICTS" = true ]; then
      do_kill
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
        echo "Error: could not clear all services:"
        for entry in "${REMAINING[@]}"; do
          port="${entry%%:*}"; pid="${entry##*:}"
          echo "  Port $port: PID $pid still running"
        done
        for pid in "${REMAINING_CFC[@]}"; do
          echo "  centralFederatedClient: PID $pid still running"
        done
        exit 1
      fi
      echo "All services clear."
    fi
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
