#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=================================================="
echo "   AI Host Environment Setup Script (Ubuntu)      "
echo "=================================================="

# 1. System Update
echo "[1/5] Updating System Packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential unzip

# 2. Install Node.js (v20 LTS)
echo "[2/5] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Puppeteer dependencies
echo "Installing Puppeteer dependencies..."
sudo apt install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# Verify installation
echo "Node Version: $(node -v)"
echo "NPM Version: $(npm -v)"

# 3. Install Nginx
echo "[3/5] Installing Nginx..."
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 4. Install PM2 (Process Manager)
echo "[4/5] Installing PM2..."
sudo npm install -g pm2

# 5. Create Project Directory
TARGET_DIR="/var/www/ai-host"
echo "[5/5] Setting up Project Directory at $TARGET_DIR..."

if [ ! -d "$TARGET_DIR" ]; then
    sudo mkdir -p "$TARGET_DIR"
    echo "Directory created."
else
    echo "Directory already exists."
fi

# Grant permissions to the current user
echo "Granting permissions to user: $USER"
sudo chown -R $USER:$USER /var/www/ai-host
sudo chmod -R 755 /var/www/ai-host

echo "=================================================="
echo "   Setup Complete!                                "
echo "=================================================="
echo "Next Steps:"
echo "1. Upload your 'backend' and 'frontend' folders to /var/www/ai-host"
echo "2. Go to /var/www/ai-host/backend and create your .env file (Paste your Atlas URI)"
echo "3. Run 'npm install' in both backend and frontend folders"
echo "4. Build frontend: 'npm run build'"
echo "5. Start backend: 'pm2 start src/server.js --name ai-backend'"
echo "6. Configure Nginx using the provided template"

