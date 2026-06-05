#!/usr/bin/env bash
# Install the add-on bundle every API-lab task assumes:
#   - Metrics Server   (kubectl top, HPA)         -> WS-07, TR-10
#   - Ingress (nginx)  (Ingress objects)          -> SN-09
#   - default StorageClass                         -> ST-03, ST-04, ST-05
#   - Gateway API CRDs + a controller              -> SN-10
#
# Idempotent: safe to re-run. Tested against kind/minikube on Kubernetes v1.35.
set -euo pipefail

GATEWAY_API_VERSION="v1.2.1"
INGRESS_NGINX_VERSION="controller-v1.12.0"
NGINX_GATEWAY_VERSION="v1.6.1"

echo "==> Metrics Server"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
# Local clusters use self-signed kubelet certs; allow the metrics scrape.
kubectl -n kube-system patch deploy metrics-server --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' 2>/dev/null || true
kubectl -n kube-system rollout status deploy/metrics-server --timeout=120s || true

echo "==> Ingress controller (ingress-nginx)"
kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/kind/deploy.yaml"
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=180s || true

echo "==> Default StorageClass"
DEFAULT_SC="$(kubectl get sc -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')"
if [ -z "${DEFAULT_SC}" ]; then
  FIRST_SC="$(kubectl get sc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [ -n "${FIRST_SC}" ]; then
    kubectl patch sc "${FIRST_SC}" -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
    echo "    marked ${FIRST_SC} as default"
  else
    echo "    no StorageClass present; install one (kind/minikube ship 'standard' by default)"
  fi
else
  echo "    default StorageClass: ${DEFAULT_SC}"
fi
# ST-03 references a class named 'standard'; alias it if the default has another name.
if ! kubectl get sc standard >/dev/null 2>&1; then
  SRC="$(kubectl get sc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [ -n "${SRC}" ]; then
    kubectl get sc "${SRC}" -o yaml \
      | sed 's/^  name: .*/  name: standard/' \
      | sed '/resourceVersion:/d;/uid:/d;/creationTimestamp:/d;/is-default-class/d' \
      | kubectl apply -f - || true
  fi
fi

echo "==> Gateway API CRDs + controller (NGINX Gateway Fabric)"
kubectl apply -f "https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml"
kubectl apply -f "https://raw.githubusercontent.com/nginxinc/nginx-gateway-fabric/${NGINX_GATEWAY_VERSION}/deploy/crds.yaml" || true
kubectl apply -f "https://raw.githubusercontent.com/nginxinc/nginx-gateway-fabric/${NGINX_GATEWAY_VERSION}/deploy/default/deploy.yaml" || true
kubectl -n nginx-gateway rollout status deploy/nginx-gateway --timeout=180s || true

echo "==> Done. Add-on bundle installed."
