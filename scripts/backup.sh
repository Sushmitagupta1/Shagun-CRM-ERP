#!/bin/bash
set -e

BACKUP_DIR="/opt/shagun-crm/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/shagun_erp_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Backing up database..."
docker compose exec -T postgres pg_dump -U shagun -d shagun_erp --no-owner --no-privileges > "$BACKUP_FILE"

echo "Backup saved: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Keep only last 10 backups
cd "$BACKUP_DIR"
ls -t shagun_erp_*.sql 2>/dev/null | tail -n +11 | xargs -r rm --
echo "Old backups cleaned (keeping last 10)."
