#!/usr/bin/env bash
set -euo pipefail
REPO=/opt/healrise
ENV_FILE=$REPO/strapi/.env
BACKUP_DIR=/backups/healrise
KEEP=30
RESTORE_DB=healrise_restore_test
DEST=root@144.91.115.4:/backups/healrise-offsite/server-eins/
KEY=/root/.ssh/healrise_offsite_ed25519
LOG=/var/log/healrise-backup.log
STATUS=$BACKUP_DIR/.healrise-backup-status
mkdir -p "$BACKUP_DIR" /var/log
{
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] healrise backup start"
  cd "$REPO"
  set -a
  . "$ENV_FILE"
  set +a
  export BACKUP_DIR BACKUP_KEEP="$KEEP" BACKUP_RUN=1
  scripts/db-backup.sh
  latest=$(ls -t "$BACKUP_DIR"/healrise-*.dump | head -1)
  test -n "$latest"
  PGPASSWORD="$DATABASE_PASSWORD" dropdb -h "${DATABASE_HOST:-127.0.0.1}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USERNAME:-healrise}" --if-exists "$RESTORE_DB"
  PGPASSWORD="$DATABASE_PASSWORD" createdb -h "${DATABASE_HOST:-127.0.0.1}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USERNAME:-healrise}" "$RESTORE_DB"
  RESTORE_TARGET_DB="$RESTORE_DB" RESTORE_RUN=1 scripts/db-restore-drill.sh "$latest"
  tables=$(PGPASSWORD="$DATABASE_PASSWORD" psql -h "${DATABASE_HOST:-127.0.0.1}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USERNAME:-healrise}" -d "$RESTORE_DB" -At -c "select count(*) from information_schema.tables where table_schema='public';")
  PGPASSWORD="$DATABASE_PASSWORD" dropdb -h "${DATABASE_HOST:-127.0.0.1}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USERNAME:-healrise}" --if-exists "$RESTORE_DB"
  ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes root@144.91.115.4 "mkdir -p /backups/healrise-offsite/server-eins && chmod 700 /backups/healrise-offsite/server-eins"
  rsync -az --chmod=F600,D700 -e "ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes" \
    --include="healrise-*.dump" --include=".healrise-backup-status" --exclude="*" "$BACKUP_DIR/" "$DEST"
  ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes root@144.91.115.4 \
    "find /backups/healrise-offsite/server-eins -maxdepth 1 -type f -name healrise-*.dump -mtime +30 -delete"
  remote_size=$(ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes root@144.91.115.4 "stat -c %s /backups/healrise-offsite/server-eins/$(basename "$latest")")
  local_size=$(stat -c %s "$latest")
  test "$remote_size" = "$local_size"
  cat > "$STATUS" <<STATUS_EOF
timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
file=$(basename "$latest")
bytes=$local_size
restore=PASS
tables=$tables
offsite=OK
remote=server-zwei:/backups/healrise-offsite/server-eins
retention_days=$KEEP
STATUS_EOF
  rsync -az --chmod=F600,D700 -e "ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes" "$STATUS" "$DEST.healrise-backup-status"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] healrise backup OK $(basename "$latest") tables=$tables bytes=$local_size"
} >> "$LOG" 2>&1
