import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "deploy", Path(__file__).with_name("deploy-published-release.py")
)
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class PublishedReleaseTests(unittest.TestCase):
    def test_only_published_stable_version_tags_are_accepted(self):
        release = {"tag_name": "v1.1.1", "draft": False, "prerelease": False,
                   "published_at": "2026-10-08T00:00:00Z"}
        self.assertEqual(deployment.release_tag(release), "v1.1.1")
        for overrides in [{"draft": True}, {"prerelease": True}, {"published_at": None},
                          {"tag_name": "main"}, {"tag_name": "--upload-pack=other"}]:
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                deployment.release_tag({**release, **overrides})

    def test_real_git_deployment_uses_release_not_newer_main_and_preserves_local_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            origin = root / "origin"
            repo = root / "production"
            origin.mkdir()

            def git_at(path, *args):
                return subprocess.check_output(["git", *args], cwd=path,
                                               stderr=subprocess.DEVNULL, text=True).strip()

            git_at(origin, "init", "-b", "main")
            git_at(origin, "config", "user.email", "test@example.invalid")
            git_at(origin, "config", "user.name", "Release test")
            source = origin / "source"
            source.write_text("old")
            git_at(origin, "add", "source")
            git_at(origin, "commit", "-m", "old")
            git_at(root, "clone", str(origin), str(repo))
            source.write_text("released")
            git_at(origin, "commit", "-am", "released")
            git_at(origin, "tag", "v1.1.1")
            released = git_at(origin, "rev-parse", "HEAD")
            source.write_text("unreleased")
            git_at(origin, "commit", "-am", "unreleased")
            local = repo / ".env"
            local.write_text("synthetic-local-config")
            commands = root / "commands"
            bin_dir = root / "bin"
            bin_dir.mkdir()
            npm = bin_dir / "npm"
            npm.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_COMMANDS"\n')
            npm.chmod(0o700)
            restart = root / "restart.sh"
            restart.write_text('#!/bin/sh\nprintf "restart\\n" >> "$TEST_COMMANDS"\n')
            state = root / "deployed.json"
            with patch.dict(os.environ, {"PATH": f"{bin_dir}:{os.environ['PATH']}",
                                         "TEST_COMMANDS": str(commands)}):
                deployment.deploy(repo, "v1.1.1", state, restart)
                self.assertEqual(git_at(repo, "rev-parse", "HEAD"), released)
                self.assertEqual((repo / "source").read_text(), "released")
                self.assertEqual(local.read_text(), "synthetic-local-config")
                self.assertEqual(json.loads(state.read_text())["commit"], released)
                executed = commands.read_text()
                self.assertTrue(executed.startswith("ci --workspace centralApi"))
                self.assertTrue(executed.endswith("restart\n"))
                deployment.deploy(repo, "v1.1.1", state, restart)
                deployment.deploy(repo, "v1.1.0", state, restart)
                self.assertEqual(commands.read_text(), executed)
                (repo / "source").write_text("local-edit")
                with self.assertRaises(RuntimeError):
                    deployment.deploy(repo, "v1.1.2", state, restart)
                self.assertEqual((repo / "source").read_text(), "local-edit")


if __name__ == "__main__":
    unittest.main()
