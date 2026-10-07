#!/usr/bin/env bash
# First deploy or redeploy on an Ubuntu box (EC2 t3.small is plenty). Run on the box, from a clone of the repo:
#   bash deploy/deploy.sh
# Needs: deploy/.env filled in (copy deploy/.env.example), and DNS: an A record for MAMA_DOMAIN pointing at this box.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
[ -f deploy/.env ] || { echo "deploy/.env is missing: cp deploy/.env.example deploy/.env and fill it"; exit 1; }
grep -q '^MAMA_DOMAIN=' deploy/.env || { echo "MAMA_DOMAIN is missing from deploy/.env"; exit 1; }
docker compose -f deploy/docker-compose.yml up -d --build
sleep 5
domain=$(grep '^MAMA_DOMAIN=' deploy/.env | cut -d= -f2)
echo "health: $(curl -s --max-time 10 "https://$domain/health" || echo 'not yet (certificate may still be issuing; try again in a minute)')"
echo "Set the extension's API address to https://$domain in the popup (Where she runs)."
