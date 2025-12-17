#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
API_PREFIX="${API_PREFIX:-/api/v1}"

# Example:
# export K6_USERS='[{"email":"admin@example.com","password":"1"}]'

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

docker run --rm \
  --network host \
  -v "$ROOT_DIR":"$ROOT_DIR" \
  -w "$ROOT_DIR" \
  -e BASE_URL="$BASE_URL" \
  -e API_PREFIX="$API_PREFIX" \
  -e K6_USERS="${K6_USERS:-}" \
  -e MAIL_VUS="${MAIL_VUS:-5}" \
  -e CHAT_VUS="${CHAT_VUS:-5}" \
  -e NOTI_VUS="${NOTI_VUS:-3}" \
  -e EMAIL_WRITE_RATIO="${EMAIL_WRITE_RATIO:-0}" \
  -e NOTIFICATION_PUSH_TEST_RATIO="${NOTIFICATION_PUSH_TEST_RATIO:-0.1}" \
  -e ENABLE_EMAIL_SEND="${ENABLE_EMAIL_SEND:-false}" \
  grafana/k6:0.49.0 run \
  --out influxdb=http://localhost:8086/k6 \
  "$ROOT_DIR/scripts/k6/mail_chat_notification.k6.js"
