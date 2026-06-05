#!/usr/bin/env python3
"""Generate Killercoda scenarios from tasks.json (Phase 2).

Reads tasks.json (single source of truth) and the labpack, and emits one
Killercoda scenario directory per task under ``tasks/killercoda/<id>/``.

Each scenario contains:
  - index.json   Killercoda manifest (title, steps, backend image, assets)
  - intro.md     context + objective
  - step1.md     the task prompt (hints, verify command, expected output)
  - setup.sh     background script: install add-ons (API tasks), stage labpack,
                 then create the broken/starting state from the task's setup
  - verify.sh    pass check derived from the task's verifyCmd / expectedOutput
  - finish.md    the solution walkthrough

Run:
    uv run python build_killercoda.py            # or: python3 build_killercoda.py

This is a generator only; commit the emitted tree (or wire the repo to a
Killercoda creator account) to publish auto-launching scenarios. See
PHASE2-KILLERCODA.md for the GitHub + Killercoda wiring steps.
"""
from __future__ import annotations

import json
import pathlib
import stat

HERE = pathlib.Path(__file__).resolve().parent
TASKS_FILE = HERE / "tasks.json"
OUT_DIR = HERE / "killercoda"

IMAGE_BY_LABMODE = {
    "api": "kubernetes-kubeadm-1node",
    "vm": "kubernetes-kubeadm-2nodes",
}


def write(path: pathlib.Path, text: str, *, executable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    if executable:
        path.chmod(path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


def intro_md(task: dict) -> str:
    return (
        f"# {task['id']} - {task['title']}\n\n"
        f"**Lab mode:** {task['labMode'].upper()}  |  "
        f"**Difficulty:** {task['difficulty']}  |  "
        f"**Time limit:** {task['timeLimitMin']} min\n\n"
        f"{task['context']}\n\n"
        f"**Objective:** {task['objective']}\n"
    )


def step_md(task: dict) -> str:
    hints = "\n".join(f"- {h}" for h in task.get("hints", [])) or "- (none)"
    return (
        f"## Solve it\n\n"
        f"{task['objective']}\n\n"
        f"### Hints\n{hints}\n\n"
        f"### Verify\n```bash\n{task['verifyCmd']}\n```\n\n"
        f"Expected output:\n```\n{task['expectedOutput']}\n```\n\n"
        f"Click **Check** when the verify command matches the expected output.\n"
    )


def finish_md(task: dict) -> str:
    return (
        f"# Done - {task['id']}\n\n"
        f"You completed: {task['title']}.\n\n"
        f"## Reference solution\n```bash\n{task['solution']}\n```\n\n"
        f"**You practiced:** {task['learningOutcomes']}\n"
    )


def setup_sh(task: dict) -> str:
    lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "",
        f"# Killercoda setup for {task['id']} ({task['labMode']} lab)",
    ]
    if task["labMode"] == "api":
        lines += [
            "# Install the add-on bundle this task assumes (idempotent).",
            "if [ -f /tmp/labpack/install-addons.sh ]; then bash /tmp/labpack/install-addons.sh || true; fi",
        ]
    if task.get("assets"):
        lines += [
            "# Stage the labpack assets the task references under /opt/cka.",
            "if [ -d /tmp/labpack/opt-cka ]; then mkdir -p /opt/cka && cp -r /tmp/labpack/opt-cka/* /opt/cka/ || true; fi",
        ]
    lines += [
        "# Create the task's starting/broken state.",
        task["setup"],
        "",
    ]
    return "\n".join(lines)


def verify_sh(task: dict) -> str:
    # Compare the task's verify command output against the expected output.
    return (
        "#!/usr/bin/env bash\n"
        "set -uo pipefail\n\n"
        f"EXPECTED=$(cat <<'EOF'\n{task['expectedOutput']}\nEOF\n)\n"
        f"ACTUAL=$({task['verifyCmd']} 2>/dev/null || true)\n\n"
        'if [ "$ACTUAL" = "$EXPECTED" ]; then\n'
        '  echo "done"\n'
        "  exit 0\n"
        "fi\n"
        'echo "not yet - got: $ACTUAL"\n'
        "exit 1\n"
    )


def index_json(task: dict) -> str:
    manifest = {
        "title": f"{task['id']} - {task['title']}",
        "description": task["objective"],
        "difficulty": task["difficulty"],
        "time": f"{task['timeLimitMin']} minutes",
        "details": {
            "intro": {"text": "intro.md"},
            "steps": [{"title": "Solve", "text": "step1.md", "verify": "verify.sh"}],
            "finish": {"text": "finish.md"},
            "assets": {
                "host01": [
                    {"file": "setup.sh", "target": "/tmp", "chmod": "+x"},
                ]
            },
        },
        "files": [],
        "backend": {"imageid": IMAGE_BY_LABMODE.get(task["labMode"], "kubernetes-kubeadm-1node")},
        "interface": {"layout": "ide"},
        "foreground": {"text": "", "execute": "bash /tmp/setup.sh"},
    }
    return json.dumps(manifest, indent=2) + "\n"


def main() -> None:
    data = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    tasks = data["tasks"]
    count = 0
    for task in tasks:
        d = OUT_DIR / task["id"]
        write(d / "index.json", index_json(task))
        write(d / "intro.md", intro_md(task))
        write(d / "step1.md", step_md(task))
        write(d / "finish.md", finish_md(task))
        write(d / "setup.sh", setup_sh(task), executable=True)
        write(d / "verify.sh", verify_sh(task), executable=True)
        count += 1

    index = "# Killercoda scenarios (generated)\n\n" + "\n".join(
        f"- `{t['id']}/` - {t['title']} ({t['labMode']} lab)" for t in tasks
    ) + "\n"
    write(OUT_DIR / "README.md", index)
    print(f"Generated {count} scenarios into {OUT_DIR}")


if __name__ == "__main__":
    main()
