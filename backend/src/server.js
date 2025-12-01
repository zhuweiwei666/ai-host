const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Global error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥', err);
});

// Load environment variables
// 1. Load default .env from backend directory
const path = require('path');
const envPath = path.join(__dirname, '../.env');
const envProdPath = path.join(__dirname, '../.env.production.local');

dotenv.config({ path: envPath });

// 2. Load production local environment variables (overrides .env, not tracked by git)
// Only load if file exists (won't fail if file doesn't exist)
try {
  const fs = require('fs');
  if (fs.existsSync(envProdPath)) {
    dotenv.config({ path: envProdPath, override: true });
    console.log('[ENV] Loaded .env.production.local');
  } else {
    console.log('[ENV] .env.production.local not found, using default .env');
  }
} catch (err) {
  console.warn('[ENV] Could not load .env.production.local:', err.message);
}

// Initialize DB connection once
connectDB();

const app = express();

// CORS Configuration - Compatible with Nginx reverse proxy
app.use(cors({
  origin: "*",
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true
}));

app.use(express.json());

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API logging middleware
app.use((req, res, next) => {
  console.log('[API]', req.method, req.url);
  next();
});

// Routes - All APIs under /api prefix
// Frontend: /api/agents → Backend: /api/agents
try {
  app.use('/api/agents', require('./routes/agents'));
  app.use('/api/chat', require('./routes/chat'));
  app.use('/api/upload', require('./routes/upload'));
  app.use('/api/voice-models', require('./routes/voiceModels'));
  app.use('/api/generate-image', require('./routes/imageGen'));
  app.use('/api/generate-video', require('./routes/videoGen'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/wallet', require('./routes/wallet'));
  app.use('/api/stats', require('./routes/stats'));
} catch (err) {
  console.error('Error loading routes:', err);
}

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 Handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Route not found' });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  res.status(500).json({ 
    message: 'Internal Server Error', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API routes (backend): /api/agents, /api/chat, /api/upload, /api/voice-models, /api/generate-image, /api/generate-video, /api/users, /api/wallet, /api/stats`);
  console.log(`📁 Static uploads at: /uploads`);
  console.log(`✅ Ready to accept requests at /api/* endpoints`);
});
