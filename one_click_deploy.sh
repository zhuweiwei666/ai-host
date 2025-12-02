#!/bin/bash

# Configuration
REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   AI Host One-Click Deploy to $REMOTE_HOST"
echo "============================================="

# 1. Check for local requirements
if ! command -v rsync &> /dev/null; then
    echo "Error: rsync is not installed locally."
    exit 1
fi

# 2. Sync Files
echo "[1/3] Syncing files to remote server..."
echo "      Excluding node_modules, .git, dist, uploads..."

rsync -avz \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'frontend/dist' \
    --exclude 'frontend/node_modules' \
    --exclude 'backend/node_modules' \
    --exclude 'backend/uploads' \
    --exclude 'ai-wallet-backend/node_modules' \
    ./ "$REMOTE_HOST:$REMOTE_DIR"

if [ $? -ne 0 ]; then
    echo "Error: File sync failed. Check your SSH connection."
    exit 1
fi

# 3. Remote Setup & Deploy
echo "[2/3] Configuring remote server and starting containers..."

ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e

    # Update system
    echo "Updating system packages..."
    apt-get update -qq

    # Install Docker if not exists
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
    else
        echo "Docker is already installed."
    fi

    # Navigate to directory
    cd "$REMOTE_DIR"

    # Create uploads directory if it doesn't exist
    mkdir -p backend/uploads

    # Adjust .env files for Docker Network (replace localhost with mongo service name)
    # This ensures that if the user has local config, it works in Docker
    if [ -f backend/.env ]; then
        sed -i 's/localhost/mongo/g' backend/.env
        sed -i 's/127.0.0.1/mongo/g' backend/.env
    fi
    if [ -f ai-wallet-backend/.env ]; then
        sed -i 's/localhost/mongo/g' ai-wallet-backend/.env
        sed -i 's/127.0.0.1/mongo/g' ai-wallet-backend/.env
    fi

    # Start Services
    echo "Building and starting containers..."
    docker compose down --remove-orphans || true
    docker compose up -d --build

    # Prune unused images to save space
    docker image prune -f

    echo "Services status:"
    docker compose ps
EOF

echo "============================================="
echo "   Deployment Complete!"
echo "============================================="

