#!/bin/bash
# Health Check 완화 및 재배포

echo "1. ConfigMap 수정 - Health Check 비활성화"
kubectl patch configmap chat-config -n chat-system --type merge -p '{
  "data": {
    "MANAGEMENT_HEALTH_DEFAULTS_ENABLED": "false",
    "MANAGEMENT_ENDPOINT_HEALTH_SHOW_COMPONENTS": "never"
  }
}'

echo "2. Deployment Probe 설정 완화"
kubectl patch deployment chat-service -n chat-system --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/startupProbe/initialDelaySeconds",
    "value": 120
  },
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/startupProbe/periodSeconds",
    "value": 15
  },
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/startupProbe/failureThreshold",
    "value": 120
  },
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/livenessProbe/initialDelaySeconds",
    "value": 180
  },
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/readinessProbe/initialDelaySeconds",
    "value": 30
  }
]'

echo "3. Pod 재시작 대기..."
kubectl rollout status deployment chat-service -n chat-system --timeout=10m

echo "4. Pod 상태 확인"
kubectl get pods -n chat-system

echo "5. 로그 확인 (10초 대기 후)"
sleep 10
kubectl logs -n chat-system -l app=chat-service --tail=50




