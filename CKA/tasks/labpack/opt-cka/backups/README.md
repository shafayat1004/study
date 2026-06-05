# Lab backups (VM-lab tasks)

These files back the VM-lab recovery drills. They are environment-specific, so the placeholders
here document what each task expects you to stage on the VM before practicing.

- `etcd-snapshot.db` (CA-13) - an etcd snapshot that contains `configmap/restore-proof` in
  `kube-system`. Create it on the control plane:

  ```bash
  kubectl -n kube-system create configmap restore-proof --from-literal=ok=yes
  sudo ETCDCTL_API=3 etcdctl snapshot save /opt/cka/backups/etcd-snapshot.db \
    --endpoints=https://127.0.0.1:2379 \
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \
    --cert=/etc/kubernetes/pki/etcd/server.crt \
    --key=/etc/kubernetes/pki/etcd/server.key
  ```

- `cni/` (TR-13) - a copy of the worker's working CNI config from `/etc/cni/net.d` so it can be
  restored after the drill removes it. On the worker:

  ```bash
  sudo mkdir -p /opt/cka/backups/cni
  sudo cp /etc/cni/net.d/* /opt/cka/backups/cni/
  ```
