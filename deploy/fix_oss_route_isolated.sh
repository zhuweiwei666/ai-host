#!/bin/bash

# 单独测试和修复 OSS 路由

set -e

echo "=========================================="
echo "  单独测试和修复 OSS 路由"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
SERVER_FILE="$BACKEND_DIR/src/server.js"
OSS_ROUTE_FILE="$BACKEND_DIR/src/routes/oss.js"

# 1. 检查路由加载顺序 - 可能是其他路由加载失败导致
echo "[1/5] 检查所有路由加载..."
cd "$BACKEND_DIR"

# 测试每个路由是否可以加载
ROUTES=("agents" "chat" "oss" "voiceModels" "imageGen" "videoGen" "users" "wallet" "stats")

for route in "${ROUTES[@]}"; do
    if node -e "
    try {
      const r = require('./src/routes/${route}.js');
      console.log('✓ ${route}');
    } catch (e) {
      console.error('✗ ${route}:', e.message);
      process.exit(1);
    }
    " 2>&1; then
        echo "  ✓ $route 可以加载"
    else
        echo "  ✗ $route 加载失败"
    fi
done
echo ""

# 2. 检查 server.js 中的路由挂载顺序
echo "[2/5] 检查路由挂载顺序..."
echo "当前路由挂载顺序:"
grep -n "app.use('/api/" "$SERVER_FILE" | head -10
echo ""

# 3. 尝试将 OSS 路由移到最前面（避免被其他路由错误影响）
echo "[3/5] 尝试将 OSS 路由移到最前面..."
# 备份
sudo cp "$SERVER_FILE" "${SERVER_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# 检查是否已经有 OSS 路由
if grep -q "app.use('/api/oss'" "$SERVER_FILE"; then
    # 移除现有的 OSS 路由行
    sudo sed -i "/app.use('\/api\/oss'/d" "$SERVER_FILE"
    
    # 在第一个路由之前插入 OSS 路由
    sudo sed -i "/app.use('\/api\/agents'/i\\
  app.use('/api/oss', require('./routes/oss'));" "$SERVER_FILE"
    
    echo "✓ 已将 OSS 路由移到最前面"
else
    echo "⚠️  OSS 路由未找到，添加..."
    sudo sed -i "/app.use('\/api\/agents'/i\\
  app.use('/api/oss', require('./routes/oss'));" "$SERVER_FILE"
fi
echo ""

# 4. 验证修改后的 server.js 语法
echo "[4/5] 验证 server.js 语法..."
if node -c "$SERVER_FILE" 2>/dev/null; then
    echo "✓ server.js 语法正确"
else
    echo "✗ server.js 有语法错误，恢复备份..."
    sudo cp "${SERVER_FILE}.backup."* "$SERVER_FILE" 2>/dev/null || true
    exit 1
fi
echo ""

# 5. 重启服务并测试
echo "[5/5] 重启服务并测试..."
pm2 restart ai-host-backend
sleep 4

# 等待服务启动
for i in {1..10}; do
    if pm2 logs ai-host-backend --lines 5 --nostream 2>/dev/null | grep -q "Server running"; then
        echo "✓ 后端已启动"
        break
    fi
    sleep 1
done

# 测试 OSS 路由
echo ""
echo "测试 OSS 路由:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/oss/sts 2>/dev/null || echo "000")

if [ "$RESPONSE" = "401" ]; then
    echo "✓ OSS 路由工作正常（返回 401 需要认证）"
elif [ "$RESPONSE" = "404" ]; then
    echo "✗ OSS 路由仍然返回 404"
    echo ""
    echo "检查详细日志:"
    pm2 logs ai-host-backend --lines 30 --nostream | grep -E "Error loading routes|oss|OSS" | tail -10
else
    echo "⚠️  返回状态码: $RESPONSE"
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "如果仍然返回 404，请检查:"
echo "1. pm2 logs ai-host-backend --lines 50 --nostream | grep -A 5 'Error loading routes'"
echo "2. 确认路由文件路径正确"
echo "3. 检查是否有其他中间件拦截了请求"
echo ""

