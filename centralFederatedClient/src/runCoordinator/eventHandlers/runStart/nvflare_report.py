#!/usr/bin/env python3
"""
nvflare_report.py — NVFLARE admin watcher (NVFLARE 2.6.2-friendly, session-only, no TCP/TLS probing)

What it does:
- Connects to a specific admin startup kit (preferred: --startup), or derives it from --root/--consortium/--run.
- Uses new_secure_session (works on NVFLARE 2.6.x). Does NOT use tcp/tls network probing.
- Prints a deterministic fingerprint of the admin kit so you can verify which session is being watched.
- Detects "Draining" like the standalone watcher when admin is unreachable (see --drain-window).
- Also detects "Draining" directly if job/system-info text explicitly says so.
- Exits after 3 consecutive "unreachable admin" polls (exit code from --unreach-exit if provided, else 124).
"""

import argparse
import contextlib
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

# ----------------------------- util ----------------------------------

def eprint(*a, **k):
    print(*a, file=sys.stderr, **k)

def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def read_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return None

# ----------------------- argv sanitizer ------------------------------

VALUE_FLAGS = {
    "--startup", "--root", "--consortium", "--run",
    "--force-host", "--force-admin-port", "--preflight-interval",
    "--poll", "--drain-window", "--unreach-exit", "--admin-log-tail",
    "--admin-username", "--admin-password",
}

def sanitize_argv(argv: List[str]) -> List[str]:
    """Drop orphan value-flags like '--startup' when followed by another flag or EOL."""
    out: List[str] = []
    i = 0
    n = len(argv)
    while i < n:
        tok = argv[i]
        if tok in VALUE_FLAGS:
            if i + 1 < n and not argv[i + 1].startswith("-"):
                out.extend([tok, argv[i + 1]])
                i += 2
            else:
                eprint(f"[warn] Dropping orphan flag '{tok}' with no value")
                i += 1
        else:
            out.append(tok)
            i += 1
    return out

# ----------------------- workspace helpers ---------------------------

def admin_workspace_from_startup(startup_dir: str) -> str:
    base = os.path.basename(startup_dir.rstrip(os.sep))
    return os.path.dirname(startup_dir) if base == "startup" else startup_dir

def derive_startup_from_triple(root: str, consortium: str, run: str) -> Optional[str]:
    cand = os.path.join(root, "runs", consortium, run, "runKits", "centralNode", "admin", "startup")
    return cand if os.path.isdir(cand) else None

# --------------------- fingerprint helpers ---------------------------

def _sha256_of(path: str) -> Optional[str]:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 16), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

def kit_fingerprint(startup_dir: str) -> Dict[str, Any]:
    workspace = admin_workspace_from_startup(startup_dir)
    fed = os.path.join(startup_dir, "fed_admin.json")
    sig = os.path.join(startup_dir, "fed_admin.json.sig")
    try:
        files = sorted([name for name in os.listdir(startup_dir) if not name.startswith(".")])[:12]
    except Exception:
        files = []
    return {
        "startup_dir": os.path.abspath(startup_dir),
        "workspace": os.path.abspath(workspace),
        "fed_admin_sha256": _sha256_of(fed),
        "sig_sha256": _sha256_of(sig),
        "files": files,
    }

# ------------------------- NVFLARE session ---------------------------

def new_session_or_raise(username: str, startup_dir: str, debug: bool=False):
    """Create a secure NVFLARE admin session. Works on NVFLARE 2.6.2."""
    try:
        from nvflare.fuel.flare_api.flare_api import new_secure_session  # type: ignore
    except Exception as ex:
        raise RuntimeError(f"nvflare import failed: {type(ex).__name__}: {ex}") from ex
    ws = admin_workspace_from_startup(startup_dir)
    if debug:
        eprint(f"[debug] connect username={username} workspace={ws}")
    return new_secure_session(username, ws, debug=False, timeout=15.0)

# -------------------- client & job extraction ------------------------

def _connected_client_ids(sess) -> List[str]:
    """Try dict form; fall back to regex on string form (2.6.2 friendly)."""
    try:
        si = sess.get_system_info()
        try:
            d = si.to_dict()
            ci = d.get("client_info") or {}
            clients = ci.get("clients") or ci.get("client_list") or ci.get("all") or []
            ids: List[str] = []
            if isinstance(clients, list):
                for c in clients:
                    if isinstance(c, dict):
                        cid = c.get("id") or c.get("name") or c.get("client_id")
                        if cid:
                            ids.append(str(cid))
                    else:
                        ids.append(str(c))
                return ids
            elif isinstance(clients, dict):
                return [str(k) for k in clients.keys()]
        except Exception:
            pass
        s = str(si)
        ids = re.findall(r"\b[0-9a-f]{24,}\b", s)
        return ids or []
    except Exception:
        return []

def _connected_client_map(sess) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    try:
        si = sess.get_system_info()
        text = str(si)
        for m in re.finditer(r'([0-9a-f]{24,})\s*\(last_connect_time:\s*([^)]+)\)', text):
            out.append({"id": m.group(1), "last_connect_time": m.group(2).strip()})
        if out:
            return out
        return [{"id": cid, "last_connect_time": None} for cid in _connected_client_ids(sess)]
    except Exception:
        return [{"id": cid, "last_connect_time": None} for cid in _connected_client_ids(sess)]

def _deploy_status_map(meta_or_list: Any) -> Dict[str, str]:
    arr = None
    if isinstance(meta_or_list, dict):
        arr = meta_or_list.get("job_deploy_detail")
    elif isinstance(meta_or_list, list):
        arr = meta_or_list
    m: Dict[str, str] = {}
    if isinstance(arr, list):
        for item in arr:
            if isinstance(item, str) and ":" in item:
                name, status = item.split(":", 1)
                m[name.strip()] = status.strip()
    return m

def _extract_status_and_round(meta: Dict[str, Any]) -> (Optional[str], Optional[int]):
    st = None
    rnd = None
    if isinstance(meta, dict):
        st = meta.get("status") or meta.get("state") or meta.get("job_status")
        for k in ("round", "current_round", "FL_round", "server_round", "num_rounds_completed"):
            if k in meta and isinstance(meta[k], int):
                rnd = meta[k]
                break
        if rnd is None:
            # drill into common sub-objects
            for k in ("training", "runtime", "progress", "stats", "controller", "aggregator"):
                d = meta.get(k)
                if isinstance(d, dict):
                    for rk in ("current_round", "round", "server_round", "epoch", "iter"):
                        if d.get(rk) is not None:
                            rnd = d.get(rk)
                            break
                    if rnd is not None:
                        break
    return st, rnd

def _looks_draining_from_meta(meta: Dict[str, Any]) -> bool:
    if not isinstance(meta, dict):
        return False
    cands = [
        meta.get("status"),
        meta.get("job_status"),
        meta.get("server_status"),
        meta.get("overall_status"),
    ]
    txt = " ".join(str(x) for x in cands if x)
    return bool(re.search(r"\bdrain(ing|ed)?\b", txt, re.IGNORECASE))

def _looks_draining_from_si_text(si_text: str) -> bool:
    return bool(re.search(r"\bdrain(ing|ed)?\b", si_text, re.IGNORECASE))

_UNREACH_PAT = re.compile(
    r"(Failed to communicate with Admin Server|ConnectionRefusedError|timed out|Connection reset|ECONNREFUSED)",
    re.IGNORECASE,
)

# --------------------------- polling core ----------------------------

def poll_once(sess, show_clients: bool, fields: List[str]) -> Dict[str, Any]:
    line: Dict[str, Any] = {}
    job_meta = None
    try:
        jobs = sess.list_jobs(detailed=True)
        running = []
        for j in jobs or []:
            jid = j.get("job_id") or j.get("id") or j.get("jobId")
            if not jid:
                continue
            try:
                meta = sess.get_job_meta(jid)
            except Exception as ex:
                meta = {"error": str(ex)}
            status, rnd = _extract_status_and_round(meta or {})
            if (status or "").upper().startswith(("RUNNING", "STARTED", "EXECUTING", "IN_PROGRESS", "PENDING")):
                running.append((jid, status, rnd, meta))
        if running:
            jid, status, rnd, job_meta = running[0]
            line["job_id"] = jid
            line["status"] = status
            if rnd is not None:
                line["round"] = rnd
            ds = _deploy_status_map(job_meta)
            if ds:
                line["deploy_status"] = ds
        else:
            line["status"] = "IDLE"
            line["deploy_status"] = {"server": "OK"}
    except Exception:
        line.setdefault("deploy_status", {"server": "OK"})
        line.setdefault("status", "UNKNOWN")

    # Clients
    if show_clients:
        line["connected_clients"] = _connected_client_ids(sess)
        line["connected_clients_detailed"] = _connected_client_map(sess)
        if job_meta and isinstance(job_meta, dict):
            jc = job_meta.get("job_clients")
            if jc:
                line["job_clients"] = jc

    # extra dotted fields from job meta
    if job_meta and isinstance(job_meta, dict) and fields:
        for f in fields:
            cur = job_meta
            for part in f.split("."):
                if isinstance(cur, dict):
                    cur = cur.get(part)
                else:
                    cur = None
                    break
            line[f] = cur

    # Draining wins if detected explicitly in meta
    try:
        if job_meta and _looks_draining_from_meta(job_meta):
            line["status"] = "DRAINING"
    except Exception:
        pass

    return line

def admin_poll_loop_with_session(
    startup_dir: str,
    poll: float,
    pretty: bool,
    show_clients: bool,
    debug: bool=False,
    username_hint: Optional[str]=None,
    fields: Optional[List[str]] = None,
    drain_window: float = 180.0,
) -> None:
    username = username_hint or "admin@admin.com"
    sess = new_session_or_raise(username, startup_dir, debug=debug)

    # consecutive "unreachable Admin" guard
    consecutive_unreach = 0
    try:
        _argv_ns = globals().get("_PARSED_ARGS")
        unreach_exit_code = getattr(_argv_ns, "unreach_exit", None)
    except Exception:
        unreach_exit_code = None
    if unreach_exit_code is None:
        unreach_exit_code = 124

    # track last "OK" poll info (to mirror standalone draining semantics)
    last_ok_ts: Optional[float] = None
    last_job_status: Optional[str] = None
    last_clients: List[str] = []

    try:
        while True:
            ts = time.time()
            try:
                # Build line; collect SI first (for draining text detection)
                line = {
                    "t": ts,
                    "ts": now_iso(),
                    "startup_dir": os.path.abspath(startup_dir),
                    "username": username,
                }
                unreachable = False

                # System info (best effort)
                try:
                    si = sess.get_system_info()
                    try:
                        si_d = si.to_dict()
                    except Exception:
                        si_d = None
                    if debug:
                        line["system_info"] = si_d if si_d is not None else str(si)
                    if not si_d:
                        # explicit 'draining' text may appear only in SI string on 2.6.2
                        if _looks_draining_from_si_text(str(si)):
                            line["status"] = "DRAINING"
                except Exception as ex:
                    if debug:
                        line["system_info_error"] = str(ex)
                    if _UNREACH_PAT.search(str(ex)):
                        unreachable = True

                # Job/clients (best effort; may fail if unreachable)
                if not unreachable:
                    line.update(poll_once(sess, show_clients=show_clients, fields=fields or []))
                else:
                    # For unreachable we still want to show last known clients if any
                    # but we won't call NVFLARE APIs again here
                    pass

                # ------------------ Unreachable handling (standalone parity) ------------------
                if unreachable:
                    # decide DRAINING vs ADMIN_UNREACHABLE like standalone
                    have_clients = bool(last_clients)
                    was_running = (last_job_status or "").upper().startswith("RUNNING")
                    within_window = (last_ok_ts is not None) and ((ts - last_ok_ts) <= float(drain_window))
                    draining = within_window and was_running and have_clients

                    status_label = "DRAINING" if draining else "ADMIN_UNREACHABLE"
                    down_line = {
                        "t": ts,
                        "ts": now_iso(),
                        "startup_dir": os.path.abspath(startup_dir),
                        "username": username,
                        "job_id": None,
                        "status": status_label,
                        "round": None,
                        "deploy_status": {"server": "DOWN"},
                        "connected_clients": last_clients,
                    }
                    print(json.dumps(down_line, default=str), flush=True)

                    if pretty:
                        ts_hms = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
                        cid_short = ", ".join((c or "")[-4:] for c in (last_clients or []))
                        if draining:
                            lj = last_job_status or "unknown"
                            print(f"[{ts_hms}] DRAINING (~{int(ts - (last_ok_ts or ts))}s) | server: DOWN | last job: {lj} | clients: {len(last_clients)} ({cid_short})", flush=True)
                        else:
                            print(f"[{ts_hms}] ADMIN_UNREACHABLE (~{int(ts - (last_ok_ts or ts))}s) | server: DOWN | clients: {len(last_clients)} ({cid_short})", flush=True)

                    # bump consecutive unreachable and maybe exit
                    consecutive_unreach += 1
                    if consecutive_unreach >= 3:
                        eprint(f"[fatal] Admin unreachable ({consecutive_unreach} consecutive polls). Exiting {unreach_exit_code}.")
                        raise SystemExit(int(unreach_exit_code))

                    time.sleep(max(0.5, float(poll)))
                    continue  # next poll

                # ------------------ Reachable path: normal print ------------------
                # refresh last-ok state for draining logic
                last_ok_ts = ts
                last_clients = line.get("connected_clients") or []
                last_job_status = (line.get("status") or "").upper() or last_job_status

                # successful reachability resets counter
                consecutive_unreach = 0

                print(json.dumps(line, default=str), flush=True)

                if pretty:
                    ts_hms = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
                    cids = line.get("connected_clients") or []
                    cid_short = ", ".join((c or "")[-4:] for c in cids)
                    svr = (line.get("deploy_status") or {}).get("server") or "unknown"
                    status = line.get("status") or "unknown"
                    if "round" in line:
                        print(f"[{ts_hms}] {status} | server: {svr} | round: {line['round']} | clients: {len(cids)} ({cid_short})", flush=True)
                    else:
                        print(f"[{ts_hms}] {status} | server: {svr} | clients: {len(cids)} ({cid_short})", flush=True)

                time.sleep(max(0.5, float(poll)))

            except KeyboardInterrupt:
                raise
            except Exception as ex:
                eprint(f"[poll] {type(ex).__name__}: {ex}")
                time.sleep(max(1.0, float(poll)))
    finally:
        with contextlib.suppress(Exception):
            sess.close()

# -------------------------------- CLI --------------------------------

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="nvflare_report.py",
        description="Session-only NVFLARE admin watcher (no TCP/TLS probing; NVFLARE 2.6.2 friendly).",
    )
    gsel = p.add_argument_group("session selection (choose one)")
    gsel.add_argument("--startup", help="Path to .../admin/startup (preferred).")
    gsel.add_argument("--root", help="Root folder that contains 'runs/'")
    gsel.add_argument("--consortium", help="Consortium id (with --root/--run)")
    gsel.add_argument("--run", help="Run id (with --root/--consortium)")

    gopt = p.add_argument_group("output")
    gopt.add_argument("--poll", type=float, default=2.0, help="Seconds between polls (default: 2.0)")
    gopt.add_argument("--pretty", action="store_true", help="Also print a human-readable line.")
    gopt.add_argument("--show-clients", action="store_true", help="Include client ids in JSON.")
    gopt.add_argument("--debug", action="store_true", help="Include raw system_info/strings and extra logs.")
    gopt.add_argument("--fields", nargs="*", default=[], help="Extra dotted fields copied from job meta into output.")
    gopt.add_argument("--drain-window", type=float, default=180.0, help="Seconds after last OK during which unreachable is labeled DRAINING.")

    # Accept legacy flags (ignored) to keep existing launchers working
    compat = p.add_argument_group("compat (accepted but ignored)")
    compat.add_argument("--unreach-exit", type=int, help="If set, use this as exit code on consecutive unreachable timeout")
    compat.add_argument("--drain-window-legacy", type=float, help=argparse.SUPPRESS)  # placeholder for older launchers
    compat.add_argument("--resilient", action="store_true", help=argparse.SUPPRESS)
    compat.add_argument("--use-internal-admin", action="store_true", help=argparse.SUPPRESS)
    compat.add_argument("--force-host", help=argparse.SUPPRESS)
    compat.add_argument("--force-admin-port", type=int, help=argparse.SUPPRESS)
    compat.add_argument("--monitor-latest", action="store_true", help=argparse.SUPPRESS)
    compat.add_argument("--net-preflight", action="store_true", help=argparse.SUPPRESS)
    compat.add_argument("--preflight-interval", type=float, help=argparse.SUPPRESS)
    compat.add_argument("--preflight-once", action="store_true", help=argparse.SUPPRESS)
    compat.add_argument("--admin-log-tail", type=int, help=argparse.SUPPRESS)
    compat.add_argument("--insecure", action="store_true", help=argparse.SUPPRESS)

    p.add_argument("--admin-username", default=os.environ.get("NVF_ADMIN_USER") or os.environ.get("NVFLARE_ADMIN_USER"))
    p.add_argument("--admin-password", default=os.environ.get("NVF_ADMIN_PWD"))

    return p.parse_args(argv or sys.argv[1:])

def main(argv: Optional[List[str]] = None) -> int:
    raw_argv = argv if argv is not None else sys.argv[1:]
    args = parse_args(sanitize_argv(list(raw_argv)))
    globals()["_PARSED_ARGS"] = args

    startup_dir: Optional[str] = None
    if args.startup:
        startup_dir = args.startup
    elif args.root and args.consortium and args.run:
        startup_dir = derive_startup_from_triple(args.root, args.consortium, args.run)

    if not startup_dir or not os.path.isdir(startup_dir):
        eprint("ERROR: provide --startup OR the triple --root/--consortium/--run that resolves to .../admin/startup")
        return 2

    if os.path.basename(os.path.abspath(startup_dir)) != "startup":
        eprint(f"NOTE: '{startup_dir}' does not look like an admin/startup folder; using its parent as workspace.")

    who = args.admin_username or "admin@admin.com"
    print(f"[watcher:BOOT] startup_dir={startup_dir!r} user={who}")
    print("[fingerprint] " + json.dumps(kit_fingerprint(startup_dir)))
    sys.stdout.flush()

    try:
        admin_poll_loop_with_session(
            startup_dir=startup_dir,
            poll=args.poll,
            pretty=args.pretty,
            show_clients=args.show_clients,
            debug=args.debug,
            username_hint=who,
            fields=args.fields,
            drain_window=float(args.drain_window),
        )
        return 0
    except RuntimeError as ex:
        eprint(f"[fatal] {ex}")
        return 78  # EX_CONFIG
    except SystemExit as ex:
        return int(ex.code) if ex.code is not None else 124
    except KeyboardInterrupt:
        eprint("\nInterrupted. Exiting...")
        return 130

if __name__ == "__main__":
    sys.exit(main())
