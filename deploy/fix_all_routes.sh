#!/bin/bash

# 修复所有路由加载问题

set -e

echo "=========================================="
echo "  修复所有路由加载问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
PM2_APP_NAME="ai-host-backend"

# 1. 检查并修复 uuid 问题
echo "[1/3] 检查 uuid 使用情况..."
FILES_WITH_UUID=$(grep -r "require.*uuid\|uuidv4" "$BACKEND_DIR/src/services" 2>/dev/null | grep -v ".git" | cut -d: -f1 | sort -u || true)

if [ -n "$FILES_WITH_UUID" ]; then
    echo "⚠️  发现以下文件仍在使用 uuid:"
    echo "$FILES_WITH_UUID"
    echo ""
    echo "这些文件需要手动修复，将 uuid 替换为 crypto.randomUUID()"
else
    echo "✓ 所有服务文件已修复 uuid 问题"
fi
echo ""

# 2. 检查环境变量
echo "[2/3] 检查环境变量..."
ENV_FILE="$BACKEND_DIR/.env.production.local"
if [ -f "$ENV_FILE" ]; then
    if grep -q "^ENABLE_MOCK_AUTH=true" "$ENV_FILE"; then
        echo "✓ ENABLE_MOCK_AUTH=true 已设置"
    else
        echo "⚠️  ENABLE_MOCK_AUTH 未设置为 true"
        echo "正在添加 ENABLE_MOCK_AUTH=true..."
        if grep -q "^ENABLE_MOCK_AUTH=" "$ENV_FILE"; then
            sed -i 's/^ENABLE_MOCK_AUTH=.*/ENABLE_MOCK_AUTH=true/' "$ENV_FILE"
        else
            echo "ENABLE_MOCK_AUTH=true" >> "$ENV_FILE"
        fi
        echo "✓ 已添加 ENABLE_MOCK_AUTH=true"
    fi
else
    echo "⚠️  环境变量文件不存在: $ENV_FILE"
fi
echo ""

# 3. 重启后端服务
echo "[3/3] 重启后端服务..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
    pm2 restart "$PM2_APP_NAME" --update-env
    echo "✓ 后端服务已重启"
    echo ""
    echo "等待 5 秒后检查路由加载状态..."
    sleep 5
    
    echo ""
    echo "路由加载状态:"
    pm2 logs "$PM2_APP_NAME" --lines 20 --nostream 2>/dev/null | grep -E "(Route loaded|Failed to load route)" | tail -10 || echo "  无法获取日志"
else
    echo "✗ PM2 应用 $PM2_APP_NAME 未运行"
fi
echo ""

echo "=========================================="
echo "  修复完成"
echo "=========================================="
echo ""
echo "如果仍有路由加载失败，请检查:"
echo "1. PM2 日志: pm2 logs $PM2_APP_NAME --lines 50"
echo "2. 路由文件语法: node -c $BACKEND_DIR/src/routes/*.js"
echo "3. 服务文件语法: node -c $BACKEND_DIR/src/services/*.js"
echo ""

