#!/bin/bash
# ============================================================
# MongoDB Backup Script for ai-host
# Usage: ./deploy/backup_db.sh
#        Or via cron: 0 3 * * * /root/ai-host/deploy/backup_db.sh
# ============================================================

set -e

# Configuration
BACKUP_DIR="/root/ai-host-backups"
CONTAINER_NAME="ai-host-mongo"
DB_NAME="test"  # Your MongoDB database name (from MONGO_URI)
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_NAME="ai-host-db-${DATE}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🗄️  Starting MongoDB backup...${NC}"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}❌ MongoDB container '${CONTAINER_NAME}' is not running!${NC}"
    exit 1
fi

# Create backup using mongodump inside container
echo "📦 Creating backup: ${BACKUP_NAME}"
docker exec "$CONTAINER_NAME" mongodump --db="$DB_NAME" --archive=/tmp/backup.archive --gzip

# Copy backup from container to host
docker cp "${CONTAINER_NAME}:/tmp/backup.archive" "${BACKUP_DIR}/${BACKUP_NAME}.archive.gz"

# Clean up temp file in container
docker exec "$CONTAINER_NAME" rm -f /tmp/backup.archive

# Verify backup was created
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}.archive.gz" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.archive.gz" | cut -f1)
    echo -e "${GREEN}✅ Backup created: ${BACKUP_DIR}/${BACKUP_NAME}.archive.gz (${BACKUP_SIZE})${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Delete old backups (older than RETENTION_DAYS)
echo "🧹 Cleaning old backups (older than ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "ai-host-db-*.archive.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# List current backups
echo ""
echo "📋 Current backups:"
ls -lh "$BACKUP_DIR"/*.archive.gz 2>/dev/null || echo "  (none)"

echo ""
echo -e "${GREEN}🎉 Backup completed!${NC}"
