#!/bin/bash

# 诊断 OSS 路由问题

set -e

echo "=========================================="
echo "  OSS 路由诊断"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
OSS_ROUTE_FILE="$BACKEND_DIR/src/routes/oss.js"
SERVER_FILE="$BACKEND_DIR/src/server.js"

# 1. 检查文件是否存在
echo "[1/6] 检查文件..."
if [ -f "$OSS_ROUTE_FILE" ]; then
    echo "✓ OSS 路由文件存在: $OSS_ROUTE_FILE"
else
    echo "✗ OSS 路由文件不存在: $OSS_ROUTE_FILE"
    exit 1
fi

if [ -f "$SERVER_FILE" ]; then
    echo "✓ server.js 存在"
else
    echo "✗ server.js 不存在"
    exit 1
fi
echo ""

# 2. 检查 server.js 中是否挂载了 OSS 路由
echo "[2/6] 检查路由挂载..."
if grep -q "app.use('/api/oss'" "$SERVER_FILE"; then
    echo "✓ OSS 路由已挂载"
    grep "app.use('/api/oss'" "$SERVER_FILE"
else
    echo "✗ OSS 路由未挂载"
fi
echo ""

# 3. 检查 OSS 路由文件语法
echo "[3/6] 检查 OSS 路由文件语法..."
if node -c "$OSS_ROUTE_FILE" 2>/dev/null; then
    echo "✓ OSS 路由文件语法正确"
else
    echo "✗ OSS 路由文件有语法错误"
    node -c "$OSS_ROUTE_FILE"
fi
echo ""

# 4. 检查依赖
echo "[4/6] 检查依赖..."
cd "$BACKEND_DIR"

if [ -d "node_modules/ali-oss" ]; then
    echo "✓ ali-oss 已安装"
else
    echo "✗ ali-oss 未安装"
fi

if [ -f "src/middleware/auth.js" ]; then
    echo "✓ auth middleware 存在"
else
    echo "✗ auth middleware 不存在"
fi
echo ""

# 5. 检查后端日志中的错误
echo "[5/6] 检查后端日志中的错误..."
echo "最近 50 行日志中与 OSS 相关的错误:"
pm2 logs ai-host-backend --lines 50 --nostream 2>/dev/null | grep -i -E "oss|Error loading routes" | tail -10 || echo "  没有找到相关错误"
echo ""

# 6. 尝试手动加载路由
echo "[6/6] 尝试手动加载路由..."
cd "$BACKEND_DIR"
if node -e "
try {
  const oss = require('./src/routes/oss.js');
  console.log('✓ OSS 路由可以正常加载');
  console.log('  路由类型:', typeof oss);
  if (oss && typeof oss === 'function') {
    console.log('  路由是一个函数（Router）');
  }
} catch (err) {
  console.error('✗ OSS 路由加载失败:');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
}
" 2>&1; then
    echo "✓ 路由可以手动加载"
else
    echo "✗ 路由无法手动加载"
fi
echo ""

echo "=========================================="
echo "  诊断完成"
echo "=========================================="
echo ""
echo "如果路由可以手动加载但服务器返回 404，可能是："
echo "1. 路由加载时出错（被 try-catch 捕获）"
echo "2. 需要重启后端服务"
echo "3. 检查 PM2 日志中的 'Error loading routes'"
echo ""

