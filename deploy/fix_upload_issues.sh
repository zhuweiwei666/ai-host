#!/bin/bash

# 修复上传问题的脚本

set -e

echo "=========================================="
echo "  修复上传问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
OSS_ROUTE="$BACKEND_DIR/src/routes/oss.js"

# 1. 检查并创建 OSS 路由文件
echo "[1/4] 检查 OSS 路由文件..."
if [ ! -f "$OSS_ROUTE" ]; then
    echo "⚠️  OSS 路由文件不存在，创建..."
    sudo tee "$OSS_ROUTE" > /dev/null <<'EOF'
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

    // Note: This requires a RAM role to be created in Alibaba Cloud
    // Role ARN format: acs:ram::<AccountID>:role/<RoleName>
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
    echo "✓ OSS 路由文件已创建"
else
    echo "✓ OSS 路由文件已存在"
fi
echo ""

# 2. 检查并安装依赖
echo "[2/4] 检查 ali-oss 依赖..."
cd "$BACKEND_DIR"
if ! grep -q "ali-oss" package.json 2>/dev/null; then
    echo "⚠️  ali-oss 不在 package.json 中，添加..."
    npm install ali-oss --save
    echo "✓ ali-oss 已安装"
elif [ ! -d "node_modules/ali-oss" ]; then
    echo "⚠️  ali-oss 未安装，安装中..."
    npm install
    echo "✓ 依赖已安装"
else
    echo "✓ ali-oss 已安装"
fi
echo ""

# 3. 检查环境变量
echo "[3/4] 检查环境变量..."
ENV_FILE="$BACKEND_DIR/.env.production.local"
ENV_EXAMPLE="$BACKEND_DIR/env.production.local.example"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  环境变量文件不存在，从示例创建..."
    if [ -f "$ENV_EXAMPLE" ]; then
        sudo cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo "✓ 已从示例创建，请编辑并填入正确的值:"
        echo "  sudo nano $ENV_FILE"
    else
        echo "⚠️  示例文件也不存在，创建基本配置..."
        sudo tee "$ENV_FILE" > /dev/null <<'EOF'
# OSS Configuration
OSS_ACCESS_KEY_ID=your-oss-access-key-id
OSS_ACCESS_KEY_SECRET=your-oss-access-key-secret
OSS_BUCKET=ai-host
OSS_REGION=oss-ap-southeast-1
OSS_ENDPOINT=oss-ap-southeast-1.aliyuncs.com
OSS_BASE_PATH=uploads
OSS_ROLE_ARN=acs:ram::123456789:role/aliyunossupload
EOF
        echo "✓ 已创建基本配置，请编辑并填入正确的值:"
        echo "  sudo nano $ENV_FILE"
    fi
else
    echo "✓ 环境变量文件存在"
    
    # 检查必要的变量
    MISSING_VARS=()
    if ! grep -q "^OSS_ACCESS_KEY_ID=" "$ENV_FILE" 2>/dev/null; then
        MISSING_VARS+=("OSS_ACCESS_KEY_ID")
    fi
    if ! grep -q "^OSS_ACCESS_KEY_SECRET=" "$ENV_FILE" 2>/dev/null; then
        MISSING_VARS+=("OSS_ACCESS_KEY_SECRET")
    fi
    if ! grep -q "^OSS_BUCKET=" "$ENV_FILE" 2>/dev/null; then
        MISSING_VARS+=("OSS_BUCKET")
    fi
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo "⚠️  缺少以下环境变量: ${MISSING_VARS[*]}"
        echo "  请编辑: sudo nano $ENV_FILE"
    else
        echo "✓ 必要的环境变量已配置"
    fi
fi
echo ""

# 4. 重启后端服务
echo "[4/4] 重启后端服务..."
if pm2 list | grep -q "ai-host-backend\|ai-backend"; then
    SERVICE_NAME=$(pm2 list | grep -E "ai-host-backend|ai-backend" | awk '{print $2}' | head -1)
    echo "重启服务: $SERVICE_NAME"
    pm2 restart "$SERVICE_NAME"
    sleep 2
    echo "✓ 服务已重启"
else
    echo "⚠️  后端服务未运行"
    echo "启动命令:"
    echo "  cd $BACKEND_DIR"
    echo "  pm2 start src/server.js --name ai-host-backend"
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 如果环境变量未配置，请编辑:"
echo "   sudo nano $ENV_FILE"
echo ""
echo "2. 运行诊断脚本验证:"
echo "   cd /var/www/ai-host/deploy"
echo "   sudo ./diagnose_upload_issues.sh"
echo ""
echo "3. 如果仍有问题，收集日志:"
echo "   sudo ./collect_upload_logs.sh"
echo ""

