#!/bin/bash

# 完整修复所有问题：uuid、路由加载、代码更新

set -e

echo "=========================================="
echo "  完整修复所有问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
PM2_APP_NAME="ai-host-backend"

# 1. 更新代码
echo "[1/5] 更新代码..."
cd "$BACKEND_DIR"
git pull origin main || {
    echo "⚠️  Git pull 失败，继续使用当前代码..."
}
echo ""

# 2. 修复 WalletTrace.js 索引定义
echo "[2/6] 修复 WalletTrace.js 索引定义..."
if [ -f "$BACKEND_DIR/src/models/WalletTrace.js" ]; then
    # 修复索引定义：{ userId, traceId } -> { userId: 1, traceId: 1 }
    sed -i 's/WalletTraceSchema\.index({ userId, traceId }/WalletTraceSchema.index({ userId: 1, traceId: 1 }/g' "$BACKEND_DIR/src/models/WalletTrace.js"
    echo "  ✓ WalletTrace.js 已修复"
fi
echo ""

# 3. 修复所有 uuid 问题
echo "[3/6] 修复所有 uuid 问题..."
FILES_TO_FIX=(
    "src/services/candyScraper.js"
    "src/services/voiceTemplateScraper.js"
    "src/services/imageGenerationService.js"
    "src/services/videoGenerationService.js"
    "src/services/fishAudioService.js"
)

for file in "${FILES_TO_FIX[@]}"; do
    if [ -f "$BACKEND_DIR/$file" ]; then
        # 检查是否仍在使用 uuid
        if grep -q "require('uuid')" "$BACKEND_DIR/$file" || grep -q "from 'uuid'" "$BACKEND_DIR/$file"; then
            echo "  修复 $file..."
            # 替换 require('uuid')
            sed -i "s/const { v4: uuidv4 } = require('uuid');/const crypto = require('crypto');/g" "$BACKEND_DIR/$file"
            sed -i "s/require('uuid')/require('crypto')/g" "$BACKEND_DIR/$file"
            # 替换 uuidv4() 为 crypto.randomUUID()
            sed -i "s/uuidv4()/crypto.randomUUID()/g" "$BACKEND_DIR/$file"
            echo "  ✓ $file 已修复"
        else
            echo "  ✓ $file 无需修复"
        fi
    fi
done
echo ""

# 4. 验证语法
echo "[4/6] 验证文件语法..."
for file in "${FILES_TO_FIX[@]}"; do
    if [ -f "$BACKEND_DIR/$file" ]; then
        if node -c "$BACKEND_DIR/$file" 2>/dev/null; then
            echo "  ✓ $file 语法正确"
        else
            echo "  ✗ $file 语法错误:"
            node -c "$BACKEND_DIR/$file" 2>&1 || true
        fi
    fi
done
echo ""

# 5. 检查环境变量
echo "[5/6] 检查环境变量..."
if grep -q "ENABLE_MOCK_AUTH=true" "$BACKEND_DIR/.env.production.local" 2>/dev/null || grep -q "ENABLE_MOCK_AUTH=true" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "  ✓ ENABLE_MOCK_AUTH=true 已设置"
else
    echo "  ⚠️  ENABLE_MOCK_AUTH 未设置，正在添加..."
    echo "ENABLE_MOCK_AUTH=true" >> "$BACKEND_DIR/.env.production.local" 2>/dev/null || echo "ENABLE_MOCK_AUTH=true" >> "$BACKEND_DIR/.env"
fi
echo ""

# 6. 重启服务
echo "[6/6] 重启后端服务..."
pm2 restart "$PM2_APP_NAME" || pm2 start "$BACKEND_DIR/src/server.js" --name "$PM2_APP_NAME" || {
    echo "  ✗ PM2 重启失败"
    exit 1
}
echo "  ✓ 服务已重启"
echo ""

# 等待服务启动
echo "等待 5 秒后检查路由加载状态..."
sleep 5

# 检查路由加载
echo ""
echo "路由加载状态:"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream 2>/dev/null | grep -E "(Route loaded|Failed to load route)" | tail -15 || echo "  无法获取日志"

echo ""
echo "=========================================="
echo "  修复完成"
echo "=========================================="
echo ""
echo "如果仍有问题，请检查:"
echo "1. PM2 日志: pm2 logs $PM2_APP_NAME --lines 100"
echo "2. 路由文件: node -c $BACKEND_DIR/src/routes/*.js"
echo "3. 服务文件: node -c $BACKEND_DIR/src/services/*.js"
echo ""

