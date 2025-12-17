#!/usr/bin/env bash
set -euo pipefail

docker compose -f "$(dirname "$0")/docker-compose.k6.yml" up -d

echo "Grafana: http://localhost:3000 (admin/admin)"
echo "InfluxDB: http://localhost:8086 (db=k6)"
