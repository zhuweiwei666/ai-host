#!/bin/bash

# 诊断 chat 500 错误

set -e

echo "=========================================="
echo "  诊断 Chat 500 错误"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
PM2_APP_NAME="ai-host-backend"

# 1. 检查最近的错误日志
echo "[1/5] 检查最近的错误日志..."
echo "最近的 Chat 相关错误:"
pm2 logs "$PM2_APP_NAME" --lines 100 --nostream 2>/dev/null | grep -i "chat\|CHAT\|error\|Error\|ERROR" | tail -20 || echo "  没有找到相关错误"
echo ""

# 2. 检查路由加载状态
echo "[2/5] 检查路由加载状态..."
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream 2>/dev/null | grep -E "(Route loaded|Failed to load route)" | grep -i chat || echo "  Chat 路由加载状态未找到"
echo ""

# 3. 检查环境变量
echo "[3/5] 检查关键环境变量..."
if [ -f "$BACKEND_DIR/.env.production.local" ]; then
    echo "检查 .env.production.local:"
    grep -E "OSS_|MONGO_|ENABLE_MOCK_AUTH" "$BACKEND_DIR/.env.production.local" | sed 's/=.*/=***/' || echo "  未找到相关配置"
else
    echo "  .env.production.local 不存在"
fi
echo ""

# 4. 测试 chat 路由文件语法
echo "[4/5] 检查 chat.js 语法..."
if [ -f "$BACKEND_DIR/src/routes/chat.js" ]; then
    if node -c "$BACKEND_DIR/src/routes/chat.js" 2>/dev/null; then
        echo "  ✓ chat.js 语法正确"
    else
        echo "  ✗ chat.js 语法错误:"
        node -c "$BACKEND_DIR/src/routes/chat.js" 2>&1 || true
    fi
else
    echo "  ✗ chat.js 文件不存在"
fi
echo ""

# 5. 检查依赖服务
echo "[5/5] 检查依赖服务..."
echo "检查 imageGenerationService:"
if [ -f "$BACKEND_DIR/src/services/imageGenerationService.js" ]; then
    if node -c "$BACKEND_DIR/src/services/imageGenerationService.js" 2>/dev/null; then
        echo "  ✓ imageGenerationService.js 语法正确"
    else
        echo "  ✗ imageGenerationService.js 语法错误"
    fi
else
    echo "  ✗ imageGenerationService.js 不存在"
fi

echo "检查 ossUpload:"
if [ -f "$BACKEND_DIR/src/utils/ossUpload.js" ]; then
    if node -c "$BACKEND_DIR/src/utils/ossUpload.js" 2>/dev/null; then
        echo "  ✓ ossUpload.js 语法正确"
    else
        echo "  ✗ ossUpload.js 语法错误"
    fi
else
    echo "  ✗ ossUpload.js 不存在"
fi
echo ""

echo "=========================================="
echo "  诊断完成"
echo "=========================================="
echo ""
echo "如果仍有问题，请检查:"
echo "1. PM2 完整日志: pm2 logs $PM2_APP_NAME --lines 200"
echo "2. 测试 API: curl -X POST http://localhost:4000/api/chat -H 'Content-Type: application/json' -H 'x-mock-user-id: test_user_001' -d '{\"agentId\":\"test\",\"prompt\":\"hello\"}'"
echo ""

