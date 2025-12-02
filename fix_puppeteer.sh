#!/bin/bash

# Configuration
REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   Fixing Puppeteer Dependencies on Backend  "
echo "============================================="

# 1. Update backend/Dockerfile on the remote server
echo "[1/3] Updating backend/Dockerfile on remote server..."
ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    cd "$REMOTE_DIR/backend"

    # Define the installation command for Puppeteer dependencies
    PUPPETEER_DEPS="RUN apt-get update && apt-get install -y \\
        gconf-service \\
        libasound2 \\
        libatk1.0-0 \\
        libc6 \\
        libcairo2 \\
        libcups2 \\
        libdbus-1-3 \\
        libexpat1 \\
        libfontconfig1 \\
        libgcc1 \\
        libgconf-2-4 \\
        libgdk-pixbuf2.0-0 \\
        libglib2.0-0 \\
        libgtk-3-0 \\
        libnspr4 \\
        libnss3 \\
        libpango-1.0-0 \\
        libpangocairo-1.0-0 \\
        libstdc++6 \\
        libx11-6 \\
        libx11-xcb1 \\
        libxcb1 \\
        libxcomposite1 \\
        libxcursor1 \\
        libxdamage1 \\
        libxext6 \\
        libxfixes3 \\
        libxi6 \\
        libxrandr2 \\
        libxrender1 \\
        libxss1 \\
        libxtst6 \\
        ca-certificates \\
        fonts-liberation \\
        libappindicator1 \\
        libnss3-tools \\
        lsb-release \\
        xdg-utils \\
        wget \\
        --no-install-recommends && \\
        rm -rf /var/lib/apt/lists/*"

    # Use sed to insert the RUN command after 'RUN npm install'
    sed -i "/RUN npm install/a \$PUPPETEER_DEPS" Dockerfile
    echo "Dockerfile updated successfully."
EOF

if [ $? -ne 0 ]; then
    echo "Error: Failed to update Dockerfile. Check SSH connection or file path."
    exit 1
fi

# 2. Rebuild and restart backend container
echo "[2/3] Rebuilding and restarting backend and aiwallet containers..."
ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    cd "$REMOTE_DIR"
    docker compose up -d --build backend aiwallet
EOF

if [ $? -ne 0 ]; then
    echo "Error: Failed to rebuild/restart containers. Check Docker status on remote."
    exit 1
fi

# 3. Check logs
echo "[3/3] Checking logs for backend and aiwallet..."
ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    cd "$REMOTE_DIR"
    echo "--- Backend Logs ---"
    docker compose logs backend --tail=50
    echo ""
    echo "--- AI Wallet Logs ---"
    docker compose logs aiwallet --tail=50
    echo ""
    echo "--- Container Status ---"
    docker compose ps
EOF

echo "============================================="
echo "   Puppeteer Fix Script Complete!            "
echo "============================================="
echo "Please refresh your browser at http://$REMOTE_HOST"