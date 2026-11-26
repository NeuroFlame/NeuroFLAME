#!/usr/bin/env python3
"""Deploy published stable releases, preserving the server's local configuration."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request


def version(tag):
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", tag)
    if not match:
        raise ValueError("Release tag must be vMAJOR.MINOR.PATCH")
    return tuple(map(int, match.groups()))


def release_tag(release):
    if release.get("draft") is not False or release.get("prerelease") is not False:
        raise ValueError("Only published stable releases can deploy")
    if not release.get("published_at"):
        raise ValueError("Release has not been published")
    tag = release["tag_name"]
    version(tag)
    return tag


def run(repo, *args):
    subprocess.run(args, cwd=repo, check=True)


def git(repo, *args):
    return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()


def deploy(repo, tag, state, restart_script):
    previous = json.loads(state.read_text()) if state.exists() else {}
    if previous.get("tag") and version(tag) <= version(previous["tag"]):
        print("No newer published release", flush=True)
        return
    if git(repo, "status", "--porcelain", "--untracked-files=no"):
        raise RuntimeError("Tracked production changes must be resolved before deployment")

    run(repo, "git", "fetch", "origin", "main", f"refs/tags/{tag}:refs/tags/{tag}")
    commit = git(repo, "rev-parse", f"refs/tags/{tag}^{{commit}}")
    # Require release ancestry on main and a forward-only update. Never reset or
    # clean the server: untracked environment files and run directories survive.
    run(repo, "git", "merge-base", "--is-ancestor", commit, "origin/main")
    run(repo, "git", "merge-base", "--is-ancestor", "HEAD", commit)
    run(repo, "git", "merge", "--ff-only", "--no-edit", commit)
    run(repo, "npm", "ci", "--workspace", "centralApi", "--workspace",
        "centralFederatedClient", "--workspace", "fileServer", "--include-workspace-root=false")
    run(repo, "npm", "run", "check-app-api-version")
    run(repo, "npm", "run", "build", "--workspace", "centralApi")
    run(repo, "npm", "run", "compile", "--workspace", "centralFederatedClient")
    run(repo, "npm", "run", "compile", "--workspace", "fileServer")
    # Keep detailed service diagnostics on this host, outside GitHub Actions.
    run(repo, "bash", str(restart_script))
    temporary = state.with_suffix(".tmp")
    temporary.write_text(json.dumps({"tag": tag, "commit": commit}) + "\n")
    temporary.replace(state)
    print(f"Deployed {tag} ({commit})", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--state-dir", type=Path, required=True)
    parser.add_argument("--restart-script", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="Show release without deploying")
    args = parser.parse_args()
    os.umask(0o077)
    args.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (args.state_dir / "deploy.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Deployment already running", flush=True)
            return
        request = urllib.request.Request(
            "https://api.github.com/repos/NeuroFlame/NeuroFLAME/releases/latest",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "NeuroFLAME-deploy"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            tag = release_tag(json.load(response))
        if args.check:
            print(f"Latest published stable release: {tag}")
            return
        deploy(args.repo.resolve(), tag, args.state_dir / "deployed.json", args.restart_script.resolve())


if __name__ == "__main__":
    main()
