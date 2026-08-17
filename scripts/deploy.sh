#!/bin/bash
# SAFE DEPLOY - Never deletes data
# Usage: bash scripts/deploy.sh
set -e

echo "=== Auto-backup before deploy ==="
bash scripts/backup.sh

echo ""
echo "=== Rebuilding (data preserved) ==="
git pull origin master
docker compose up -d --build

echo ""
echo "=== Done ==="
docker compose ps
