#!/bin/bash

# 修复 OSS 路由加载问题

set -e

echo "=========================================="
echo "  修复 OSS 路由加载问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
OSS_ROUTE_FILE="$BACKEND_DIR/src/routes/oss.js"
SERVER_FILE="$BACKEND_DIR/src/server.js"

# 1. 检查并修复 OSS 路由文件
echo "[1/4] 检查 OSS 路由文件..."
if [ ! -f "$OSS_ROUTE_FILE" ]; then
    echo "✗ OSS 路由文件不存在，创建..."
    cat > "$OSS_ROUTE_FILE" << 'EOF'
const express = require('express');
const { STS } = require('ali-oss');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/oss/sts - Get temporary STS credentials for direct OSS upload
router.get('/sts', requireAuth, async (req, res) => {
  try {
    // Validate required environment variables
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      return res.status(500).json({ 
        error: 'OSS credentials not configured. Please set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET in .env.production.local' 
      });
    }

    const STSClient = new STS({
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    });

    // Policy: Allow PutObject only to the specified bucket and base path
    const policy = {
      Version: "1",
      Statement: [
        {
          Action: ["oss:PutObject"],
          Effect: "Allow",
          Resource: `acs:oss:*:*:${process.env.OSS_BUCKET}/${process.env.OSS_BASE_PATH || 'uploads'}/*`,
        },
      ],
    };

    const roleArn = process.env.OSS_ROLE_ARN || 'acs:ram::123456789:role/aliyunossupload';

    const result = await STSClient.assumeRole(
      roleArn,
      policy,
      3600 // 1 hour expiration
    );

    res.json({
      accessKeyId: result.credentials.AccessKeyId,
      accessKeySecret: result.credentials.AccessKeySecret,
      securityToken: result.credentials.SecurityToken,
      expiration: result.credentials.Expiration,
      bucket: process.env.OSS_BUCKET,
      region: process.env.OSS_REGION,
      endpoint: process.env.OSS_ENDPOINT,
      basePath: process.env.OSS_BASE_PATH || 'uploads',
    });
  } catch (err) {
    console.error('[OSS] STS credential generation failed:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to generate STS credentials',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
EOF
    echo "✓ 已创建 OSS 路由文件"
else
    echo "✓ OSS 路由文件存在"
fi
echo ""

# 2. 检查 server.js 中的路由挂载
echo "[2/4] 检查路由挂载..."
if ! grep -q "app.use('/api/oss'" "$SERVER_FILE"; then
    echo "⚠️  OSS 路由未挂载，添加..."
    # 在 chat 路由之后添加
    sudo sed -i "/app.use('\/api\/chat'/a\\
  app.use('/api/oss', require('./routes/oss'));" "$SERVER_FILE"
    echo "✓ 已添加 OSS 路由挂载"
else
    echo "✓ OSS 路由已挂载"
fi
echo ""

# 3. 测试路由是否可以加载
echo "[3/4] 测试路由加载..."
cd "$BACKEND_DIR"
if node -e "
try {
  const oss = require('./src/routes/oss.js');
  console.log('✓ OSS 路由可以正常加载');
} catch (err) {
  console.error('✗ OSS 路由加载失败:', err.message);
  process.exit(1);
}
" 2>&1; then
    echo "✓ 路由可以正常加载"
else
    echo "✗ 路由无法加载，检查依赖..."
    # 检查依赖
    if [ ! -d "node_modules/ali-oss" ]; then
        echo "  安装 ali-oss..."
        npm install ali-oss
    fi
fi
echo ""

# 4. 重启后端服务
echo "[4/4] 重启后端服务..."
pm2 restart ai-host-backend
sleep 3

# 检查启动状态
if pm2 logs ai-host-backend --lines 10 --nostream 2>/dev/null | grep -q "Server running"; then
    echo "✓ 后端启动成功"
    
    # 检查是否有路由加载错误
    if pm2 logs ai-host-backend --lines 20 --nostream 2>/dev/null | grep -q "Error loading routes.*oss"; then
        echo "⚠️  仍有路由加载错误，查看详细日志:"
        pm2 logs ai-host-backend --lines 30 --nostream | grep -A 5 "Error loading routes" | tail -10
    else
        echo "✓ 没有路由加载错误"
    fi
else
    echo "⚠️  后端可能有问题"
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "验证:"
echo "1. 测试 STS: curl -v http://127.0.0.1:4000/api/oss/sts"
echo "2. 查看日志: pm2 logs ai-host-backend --lines 30 --nostream"
echo ""

