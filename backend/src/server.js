const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Global error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥', err);
});

// 先加载默认 .env
dotenv.config();

// 再加载服务器专用环境变量（不会被 git 覆盖）
dotenv.config({ path: ".env.production.local" });

// Initialize DB connection once
connectDB();

const app = express();

// CORS Configuration - Allow all origins for development and production
app.use(cors({
  origin: "*", // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Mock-User-Id', 'X-Mock-User-Role']
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
try {
app.use('/api/agents', require('./routes/agents'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/voice-models', require('./routes/voiceModels'));
app.use('/api/generate-image', require('./routes/imageGen'));
app.use('/api/generate-video', require('./routes/videoGen')); // Added video gen route
  app.use('/api/users', require('./routes/users')); // Added users route
  app.use('/api/wallet', require('./routes/wallet')); // Ensure wallet route is mounted if not already
  app.use('/api/stats', require('./routes/stats')); // Added stats route
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
  console.log(`🌐 API endpoints available at: http://localhost:${PORT}/api`);
  console.log(`📁 Static uploads at: http://localhost:${PORT}/uploads`);
});
