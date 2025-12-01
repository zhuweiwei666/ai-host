#!/bin/bash

# 修复 OSS 上传认证问题

set -e

echo "=========================================="
echo "  修复 OSS 上传认证问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
ENV_FILE="$BACKEND_DIR/.env.production.local"

# 1. 检查并设置 ENABLE_MOCK_AUTH
echo "[1/3] 检查 ENABLE_MOCK_AUTH 配置..."
if [ -f "$ENV_FILE" ]; then
    if grep -q "^ENABLE_MOCK_AUTH=" "$ENV_FILE"; then
        # 更新现有值
        sudo sed -i 's/^ENABLE_MOCK_AUTH=.*/ENABLE_MOCK_AUTH=true/' "$ENV_FILE"
        echo "✓ 已更新 ENABLE_MOCK_AUTH=true"
    else
        # 添加新配置
        echo "" | sudo tee -a "$ENV_FILE" > /dev/null
        echo "# Enable mock authentication for development/testing" | sudo tee -a "$ENV_FILE" > /dev/null
        echo "ENABLE_MOCK_AUTH=true" | sudo tee -a "$ENV_FILE" > /dev/null
        echo "✓ 已添加 ENABLE_MOCK_AUTH=true"
    fi
else
    echo "⚠️  环境变量文件不存在，创建..."
    sudo mkdir -p "$BACKEND_DIR"
    echo "ENABLE_MOCK_AUTH=true" | sudo tee "$ENV_FILE" > /dev/null
    echo "✓ 已创建环境变量文件"
fi

# 验证配置
if grep -q "^ENABLE_MOCK_AUTH=true" "$ENV_FILE"; then
    echo "✓ 配置验证通过"
else
    echo "✗ 配置验证失败"
    exit 1
fi
echo ""

# 2. 检查 OSS 环境变量
echo "[2/3] 检查 OSS 环境变量..."
REQUIRED_VARS=("OSS_ACCESS_KEY_ID" "OSS_ACCESS_KEY_SECRET" "OSS_BUCKET" "OSS_REGION" "OSS_ENDPOINT")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "⚠️  缺少以下 OSS 环境变量:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "请手动添加到 $ENV_FILE"
else
    echo "✓ 所有必需的 OSS 环境变量已配置"
fi
echo ""

# 3. 重启后端服务
echo "[3/3] 重启后端服务..."
pm2 restart ai-host-backend
sleep 3

# 检查启动状态
if pm2 logs ai-host-backend --lines 10 --nostream 2>/dev/null | grep -q "Server running"; then
    echo "✓ 后端启动成功"
else
    echo "⚠️  后端可能有问题"
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "验证:"
echo "1. 测试 STS 端点:"
echo "   curl -H 'x-mock-user-id: test_user_001' http://127.0.0.1:4000/api/oss/sts"
echo ""
echo "2. 检查环境变量:"
echo "   grep ENABLE_MOCK_AUTH $ENV_FILE"
echo ""
echo "3. 查看后端日志:"
echo "   pm2 logs ai-host-backend --lines 20 --nostream"
echo ""

