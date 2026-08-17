#!/bin/bash
# DANGER: This script DELETES ALL DATA!
# Only use if you explicitly want a fresh database.
# Always run backup.sh first!
set -e

echo "=========================================="
echo "  WARNING: THIS WILL DELETE ALL DATA!"
echo "=========================================="
read -p "Type 'DELETE ALL DATA' to confirm: " confirm
if [ "$confirm" != "DELETE ALL DATA" ]; then
  echo "Aborted. Your data is safe."
  exit 1
fi

echo "Creating final backup..."
bash scripts/backup.sh

echo "Deleting database volume..."
docker compose down -v

echo "Starting fresh..."
docker compose up -d --build

echo "Done. Fresh database created."
