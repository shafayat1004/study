# Phase 2 - Auto-launching Killercoda scenarios

Phase 1 launch buttons open generic Killercoda playgrounds and you seed the task by hand with
`labpack/seed.sh`. Phase 2 turns each task into a real Killercoda scenario that boots, installs the
add-ons, seeds the broken state, and verifies the fix automatically.

## 1. Generate the scenarios

```bash
cd CKA/tasks
uv run python build_killercoda.py      # or: python3 build_killercoda.py
```

This reads `tasks.json` (and references `labpack/`) and writes one scenario per task under
`tasks/killercoda/<id>/` (`index.json`, `intro.md`, `step1.md`, `setup.sh`, `verify.sh`,
`finish.md`). The generator is the only thing to maintain - task content stays single-sourced in
`tasks.json`.

## 2. Make the labpack available to scenarios

Each generated `setup.sh` expects the labpack at `/tmp/labpack` on the Killercoda host (it runs
`install-addons.sh` for API-lab tasks and copies `opt-cka/` assets). Either:

- commit `labpack/` next to the scenarios and add it to each `index.json` `assets` list, or
- fetch it in `setup.sh` from your public repo with `git clone`/`curl`.

## 3. Wire the GitHub repo to a Killercoda creator account

1. Create a free Killercoda creator account at killercoda.com and open the Creators dashboard.
2. Add this GitHub repository as a content source (Killercoda reads scenarios from a Git repo).
3. Killercoda installs a deploy key / webhook so pushes re-import scenarios automatically.
4. Point the import path at the generated `tasks/killercoda/` directory.

Each scenario then gets a stable URL like
`https://killercoda.com/<account>/scenario/<id>`.

## 4. Swap the launch URLs

Replace the generic playground URLs in `assets/tasks.js` (`LAUNCH_URLS`) with a per-task URL builder,
for example:

```js
const SCENARIO_BASE = "https://killercoda.com/<account>/scenario/";
function launchUrlFor(task) {
  return SCENARIO_BASE + task.id;     // one scenario per task id
}
```

and use `launchUrlFor(task)` when building each card's launch button.

## Notes

- Free Killercoda sessions are time-boxed (about 1 hour); scenarios should be solvable well within
  that and within the task's own time limit.
- Backend images: API-lab tasks use `kubernetes-kubeadm-1node`; node/control-plane (VM-lab) tasks
  use `kubernetes-kubeadm-2nodes`. Both track Kubernetes v1.35.
- `verify.sh` compares the task's verify command output to its expected output, so the Check button
  is deterministic.
