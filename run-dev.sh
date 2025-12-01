#!/bin/bash

# Kill background jobs on exit
trap 'kill $(jobs -p)' EXIT

echo "🚀 Starting AI Host Admin..."

# Start Backend
echo "📦 Starting Backend (Port 4000)..."
cd backend
npm install
npm run dev &
BACKEND_PID=$!
cd ..

# Start AI Wallet
echo "💰 Starting AI Wallet (Port 4100)..."
cd ai-wallet-backend
npm install
npm run dev &
WALLET_PID=$!
cd ..

# Start Frontend
echo "✨ Starting Frontend..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ All services started!"
echo "   Backend: http://localhost:4000"
echo "   Wallet:  http://localhost:4100"
echo "   Frontend: http://localhost:5173"

# Wait for processes to finish (simple wait for compatibility)
wait
