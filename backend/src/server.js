const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const fs = require('fs');
const envPath = path.join(__dirname, '../.env');
const envProdPath = path.join(__dirname, '../.env.production.local');

dotenv.config({ path: envPath });

// 2. Load production local environment variables (overrides .env, not tracked by git)
// Only load if file exists (won't fail if file doesn't exist)
try {
  if (fs.existsSync(envProdPath)) {
    dotenv.config({ path: envProdPath, override: true });
    console.log('[ENV] Loaded .env.production.local');
  } else {
    console.log('[ENV] .env.production.local not found, using default .env');
  }
} catch (err) {
  console.warn('[ENV] Could not load .env.production.local:', err.message);
}

// ============================================================
// Security: Validate critical environment variables
// ============================================================
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const jwtSecret = process.env.JWT_SECRET;
  const defaultSecrets = ['your-secret-key-change-in-production', 'secret', 'jwt_secret', ''];
  
  if (!jwtSecret || defaultSecrets.includes(jwtSecret)) {
    console.error('❌ FATAL: JWT_SECRET is not set or using default value in production!');
    console.error('   Please set a strong random JWT_SECRET in your .env file.');
    console.error('   Generate one with: openssl rand -hex 32');
    process.exit(1);
  }
  
  if (process.env.ENABLE_MOCK_AUTH === 'true') {
    console.error('❌ FATAL: ENABLE_MOCK_AUTH=true is not allowed in production!');
    process.exit(1);
  }
  
  console.log('✅ Security checks passed');
}

// Initialize DB connection once
connectDB();

const app = express();

// ============================================================
// Security: Trust proxy (required behind Nginx/Cloudflare)
// ============================================================
// Trust first proxy (Nginx). For Cloudflare, use 'cf-connecting-ip' header.
app.set('trust proxy', 1);

// ============================================================
// Security: Helmet - secure HTTP headers
// ============================================================
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // Allow cross-origin requests
  crossOriginResourcePolicy: false, // Allow cross-origin resource loading
}));

// ============================================================
// Security: Rate limiting (defense in depth, after Nginx)
// ============================================================
// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down' },
  keyGenerator: (req) => {
    // Use Cloudflare's real IP header if available
    return req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip;
  },
});

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'Too many auth attempts' },
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip,
});

// Very strict for expensive operations
const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'Rate limit for expensive operations' },
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip,
});

// Apply general limiter to all routes
app.use(generalLimiter);

// ============================================================
// CORS Configuration - Compatible with Nginx reverse proxy
// ============================================================
app.use(cors({
  origin: "*",
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true
}));

// ============================================================
// Body parsing with size limits
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================================
// Response format negotiation (iOS/raw client compatibility)
// ============================================================
// Some mobile clients decode responses as raw models/arrays and will fail on
// the { success, statusCode, timestamp, data } envelope.
// Heuristics:
// - Explicit: ?raw=1, header x-response-format: raw, header x-client: ios
// - Implicit: iOS networking stack often includes "CFNetwork" / "Darwin" in User-Agent
app.use((req, res, next) => {
  const ua = String(req.headers['user-agent'] || '');
  const wantRawByQuery = req.query?.raw === '1' || req.query?.raw === 'true';
  const wantRawByHeader =
    String(req.headers['x-response-format'] || '').toLowerCase() === 'raw' ||
    String(req.headers['x-client'] || '').toLowerCase() === 'ios';
  const looksLikeIOS = /CFNetwork|Darwin/i.test(ua) && !/Mozilla/i.test(ua);

  res.locals.rawResponse = Boolean(wantRawByQuery || wantRawByHeader || looksLikeIOS);
  next();
});

// ============================================================
// Health check endpoint (for monitoring/uptime checks)
// ============================================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ============================================================
// Apply stricter rate limits to specific routes BEFORE loading them
// ============================================================
app.use('/api/users/sync', authLimiter);
app.use('/api/generate-image', expensiveLimiter);
app.use('/api/generate-video', expensiveLimiter);
app.use('/api/avatar-assets', expensiveLimiter);

// ============================================================
// Routes - All APIs under /api prefix
// ============================================================
// Load each route separately to avoid one failure affecting others
const loadRoute = (routePath, routeName) => {
  try {
    app.use(routePath, require(routeName));
    console.log(`✓ Route loaded: ${routePath}`);
  } catch (err) {
    console.error(`✗ Failed to load route ${routePath}:`, err.message);
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
loadRoute('/api/alert', './routes/alert');
loadRoute('/api/preview', './routes/preview');
loadRoute('/api/liveskin', './routes/liveskin');
loadRoute('/api/idle-video', './routes/idleVideo');
loadRoute('/api/avatar-assets', './routes/avatarAssets');
loadRoute('/api/billing', './routes/billing');
loadRoute('/api/admin', './routes/adminWallet');
loadRoute('/api/admin/live-skin', './routes/adminLiveSkin');
loadRoute('/api/user-agents', './routes/userAgents');
loadRoute('/api/admin/review', './routes/adminReview');
loadRoute('/api/story', './routes/story');
loadRoute('/api/gallery', './routes/gallery');
loadRoute('/api/media', './routes/media');
loadRoute('/api/applications', './routes/applications');

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
