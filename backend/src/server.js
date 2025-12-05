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
// Load each route separately to avoid one failure affecting others
const loadRoute = (path, routeName) => {
  try {
    app.use(path, require(routeName));
    console.log(`✓ Route loaded: ${path}`);
  } catch (err) {
    console.error(`✗ Failed to load route ${path}:`, err.message);
  }
};

loadRoute('/api/agents', './routes/agents');
loadRoute('/api/chat', './routes/chat');
loadRoute('/api/oss', './routes/oss');
loadRoute('/api/voice-models', './routes/voiceModels');
loadRoute('/api/generate-image', './routes/imageGen');

const isVideoFeatureEnabled = process.env.ENABLE_VIDEO_FEATURE === 'true';
if (isVideoFeatureEnabled) {
  loadRoute('/api/generate-video', './routes/videoGen');
} else {
  console.log('⚠️  Video generation route disabled (ENABLE_VIDEO_FEATURE != true)');
}
loadRoute('/api/users', './routes/users');
loadRoute('/api/wallet', './routes/wallet');
loadRoute('/api/stats', './routes/stats');
loadRoute('/api/gift', './routes/gift');
loadRoute('/api/outfit', './routes/outfit');
loadRoute('/api/profile', './routes/profile');
loadRoute('/api/analytics', './routes/analytics');

// Static uploads (legacy - kept for backward compatibility with old files)
// New uploads go directly to OSS, not through this endpoint
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 Handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  const { errors } = require('./utils/errorHandler');
  errors.notFound(res, 'Route not found', { path: req.path, method: req.method });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  const { errors: errorHandler } = require('./utils/errorHandler');
  errorHandler.internalError(res, 'Internal Server Error', { 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 统一端口配置：容器内部使用4000，可通过.env覆盖
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API routes (backend): /api/agents, /api/chat, /api/oss, /api/voice-models, /api/generate-image, ${isVideoFeatureEnabled ? '/api/generate-video, ' : ''}/api/users, /api/wallet, /api/stats`);
  console.log(`📁 Static uploads at: /uploads`);
  console.log(`✅ Ready to accept requests at /api/* endpoints`);
  
  // 启动 AI 自进化系统定时任务调度器
  try {
    const scheduler = require('./jobs/scheduler');
    scheduler.start();
  } catch (err) {
    console.error('❌ Failed to start scheduler:', err.message);
  }
});
