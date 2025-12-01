const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const walletRoutes = require('./routes/wallet');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4100;

connectDB();

// 中间件
app.use(helmet());
app.use(
  cors({
    origin: '*'
  })
);
app.use(express.json());
app.use(morgan('dev'));

// 健康检查
app.get('/health', (_req, res) => {
  res.json({
    code: 200,
    msg: 'ai-wallet running',
    data: { ts: Date.now(), service: process.env.SERVICE_NAME || 'ai-wallet' }
  });
});

// 钱包相关路由，统一前缀 /api/ai-wallet
app.use('/api/ai-wallet', walletRoutes);

// 错误处理
app.use(errorHandler);

// 启动服务
app.listen(PORT, () => {
  console.log(`[AI Wallet] Server listening on port ${PORT}`);
});