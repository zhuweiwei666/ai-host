#!/bin/bash
# ============================================================
# MongoDB Restore Script for ai-host
# Usage: ./deploy/restore_db.sh <backup_file>
# Example: ./deploy/restore_db.sh /root/ai-host-backups/ai-host-db-2025-12-13_030000.archive.gz
# ============================================================

set -e

# Configuration
CONTAINER_NAME="ai-host-mongo"
DB_NAME="test"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: $0 <backup_file>${NC}"
    echo "   Example: $0 /root/ai-host-backups/ai-host-db-2025-12-13_030000.archive.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will overwrite the current database!${NC}"
echo "   Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}🗄️  Starting MongoDB restore...${NC}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}❌ MongoDB container '${CONTAINER_NAME}' is not running!${NC}"
    exit 1
fi

# Copy backup to container
echo "📦 Copying backup to container..."
docker cp "$BACKUP_FILE" "${CONTAINER_NAME}:/tmp/restore.archive.gz"

# Restore using mongorestore
echo "🔄 Restoring database..."
docker exec "$CONTAINER_NAME" mongorestore --db="$DB_NAME" --archive=/tmp/restore.archive.gz --gzip --drop

# Clean up
docker exec "$CONTAINER_NAME" rm -f /tmp/restore.archive.gz

echo ""
echo -e "${GREEN}✅ Database restored successfully from: ${BACKUP_FILE}${NC}"
echo ""
echo "⚠️  Note: You may need to restart the backend container:"
echo "   docker restart ai-host-backend"
