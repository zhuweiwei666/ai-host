#!/bin/bash

# 修复 userId is not defined 错误

set -e

echo "=========================================="
echo "  修复 userId is not defined 错误"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
PM2_APP_NAME="ai-host-backend"

# 1. 检查路由文件语法
echo "[1/4] 检查路由文件语法..."
ROUTE_FILES=(
    "src/routes/chat.js"
    "src/routes/users.js"
    "src/routes/wallet.js"
    "src/routes/imageGen.js"
    "src/routes/videoGen.js"
)

for file in "${ROUTE_FILES[@]}"; do
    if [ -f "$BACKEND_DIR/$file" ]; then
        if node -c "$BACKEND_DIR/$file" 2>/dev/null; then
            echo "✓ $file 语法正确"
        else
            echo "✗ $file 语法错误:"
            node -c "$BACKEND_DIR/$file" 2>&1 || true
        fi
    else
        echo "⚠️  $file 不存在"
    fi
done
echo ""

# 2. 检查是否有模块顶层使用 userId
echo "[2/4] 检查模块顶层 userId 使用..."
echo "搜索顶层 userId 定义..."
grep -n "^const userId\|^let userId\|^var userId" "$BACKEND_DIR/src/routes"/*.js 2>/dev/null || echo "  未找到顶层 userId 定义"
echo ""

# 3. 检查服务文件
echo "[3/4] 检查服务文件..."
SERVICE_FILES=(
    "src/services/walletService.js"
    "src/services/relationshipService.js"
)

for file in "${SERVICE_FILES[@]}"; do
    if [ -f "$BACKEND_DIR/$file" ]; then
        if node -c "$BACKEND_DIR/$file" 2>/dev/null; then
            echo "✓ $file 语法正确"
        else
            echo "✗ $file 语法错误:"
            node -c "$BACKEND_DIR/$file" 2>&1 || true
        fi
    fi
done
echo ""

# 4. 检查最新的错误日志
echo "[4/4] 检查最新错误日志..."
echo "最近的 userId 相关错误:"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream 2>/dev/null | grep -i "userId\|not defined" | tail -10 || echo "  没有找到相关错误"
echo ""

echo "=========================================="
echo "  诊断完成"
echo "=========================================="
echo ""
echo "如果仍有 userId is not defined 错误，可能原因:"
echo "1. 某个模块在顶层代码中使用了 userId"
echo "2. 循环依赖导致模块加载顺序问题"
echo "3. 某个 require() 语句在模块加载时出错"
echo ""
echo "建议:"
echo "1. 检查 PM2 完整日志: pm2 logs $PM2_APP_NAME --lines 100"
echo "2. 手动测试路由文件: node -e \"require('./src/routes/chat.js')\""
echo ""

