#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.sql>"
  echo ""
  echo "Available backups:"
  ls -lh /opt/shagun-crm/backups/shagun_erp_*.sql 2>/dev/null || echo "  No backups found."
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

echo "Restoring from: $BACKUP_FILE"
echo "WARNING: This will OVERWRITE the current database!"
read -p "Continue? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# Drop and recreate DB
docker compose exec -T postgres psql -U shagun -d postgres -c "DROP DATABASE IF EXISTS shagun_erp;"
docker compose exec -T postgres psql -U shagun -d postgres -c "CREATE DATABASE shagun_erp OWNER shagun;"

# Restore
docker compose exec -T postgres psql -U shagun -d shagun_erp < "$BACKUP_FILE"

echo "Restore complete!"
