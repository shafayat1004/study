# CKA hands-on task bank

A 50-task, timed, verifiable practice bank that complements the [CKA Study Guide](../index.html).
Open [`tasks/index.html`](index.html) in a browser to filter, search, time, and copy each task.

The tasks are defined once in [`tasks.json`](tasks.json) and rendered by the hub page. The same
data is structured so it can later be generated into auto-launching Killercoda scenarios.

## Two lab modes

Every task is tagged with a `labMode`:

- **API lab** (`api`) - most tasks. A multi-node local cluster with `kubectl`, plus an add-on
  bundle (Metrics Server, an Ingress controller, a default StorageClass, and a Gateway API
  implementation). HPA, Ingress, Gateway, and dynamic-provisioning tasks fail without these add-ons.
- **VM lab** (`vm`) - node and control-plane tasks (kubeadm join/upgrade, static Pods, etcd
  snapshot/restore, kubelet/CNI/control-plane repair). These need real Ubuntu hosts with `systemd`.

Design target: **Kubernetes v1.35** (the current CKA exam environment).

## How to practice

### Option 1 - Browser, zero install (Killercoda)

Use a free in-browser playground. It boots a real `kubeadm` cluster, so it works for both lab modes.

- API-lab tasks: open the Kubernetes playground and run the task `setup`, then solve and `verify`.
- VM-lab tasks: open the kubeadm multi-node playground for node/control-plane work.

The hub page's per-task **Launch** button opens the right playground for the task's lab mode.
Free Killercoda sessions are time-boxed (about 1 hour), so treat them as scratch environments.

### Option 2 - Local API lab (kind or minikube)

```bash
# kind, multi-node (recommended for scheduling/NodePort realism)
kind create cluster --config labpack/kind-cluster.yaml

# or minikube, single command
minikube start --nodes 3

# install the add-ons every API-lab task assumes
bash labpack/install-addons.sh

# stage the per-task asset pack the tasks reference under /opt/cka
sudo cp -r labpack/opt-cka /opt/cka
```

### Option 3 - Local VM lab (multipass + kubeadm)

For VM-lab tasks you need real nodes. A minimal pair:

```bash
multipass launch 22.04 --name cp1 --cpus 2 --memory 2G --disk 10G
multipass launch 22.04 --name wk2 --cpus 2 --memory 2G --disk 10G
# bootstrap with kubeadm (containerd, cgroup driver, kubeadm init, CNI, worker join),
# then snapshot immediately so destructive drills (etcd restore, static Pod, control-plane) reset fast:
multipass snapshot cp1 --name fresh
multipass snapshot wk2 --name fresh
```

> Note on Google Colab: managed Colab runtimes are ephemeral and restrict SSH/remote control, so
> they are not a host for these labs. At most, Colab can be a notebook frontend over a local runtime
> you already control - with the caveat that notebook code can read/write/delete your local files.

## Seeding a task's starting state

Each task in `tasks.json` carries a `setup` script that creates its broken/starting state, and a
`solution` walkthrough. To seed one task into the current cluster:

```bash
bash labpack/seed.sh CA-02      # runs the setup for task CA-02
```

Then solve the task and run its **verify** command. The expected output is shown on each card.

## Task flow

1. Read the full prompt.
2. Set the correct context and namespace first.
3. Solve with the fastest safe path.
4. Run the verification command and compare against the expected output.
5. Only reveal hints or the solution if you are stuck or over the time limit.

## Files

- `tasks.json` - single source of truth (50 tasks; schema below).
- `index.html`, `assets/tasks.css`, `assets/tasks.js` - the browsable hub page.
- `labpack/` - cluster add-on installer, kind config, sample assets, and `seed.sh`.

### Task schema

| Field | Meaning |
|---|---|
| `id` | Stable task id (e.g. `CA-01`). |
| `domain` | `clusterarch` / `workloads` / `networking` / `storage` / `troubleshooting`. |
| `phase` | Progression tier: `foundation`, `configuration`, `control-routing`, `cluster-admin`, `failure-drills`. |
| `difficulty` | `easy` / `medium` / `hard`. |
| `timeLimitMin` | Suggested time budget (drives the per-task timer). |
| `labMode` | `api` or `vm`. |
| `context`, `objective`, `hints[]` | Prompt and minimal nudges. |
| `verifyCmd`, `expectedOutput` | Deterministic pass check. |
| `setup`, `solution` | Authored broken-state script and fix walkthrough. |
| `assets[]` | Labpack paths under `/opt/cka` the task relies on. |
| `learningOutcomes` | What the task builds. |
