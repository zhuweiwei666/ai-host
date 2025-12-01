#!/bin/bash

echo "=== Pull latest code ==="

git pull origin main

echo "=== Deploy & Restart ==="

docker compose up -d --build

echo "=== DONE ==="

