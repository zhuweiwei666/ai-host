#!/bin/bash

# 诊断 API 路由问题

set -e

echo "=========================================="
echo "  API 路由诊断"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
PM2_APP_NAME="ai-host-backend"

# 1. 检查后端服务状态
echo "[1/5] 检查后端服务状态..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "✓ 后端服务正在运行"
    pm2 list | grep "$PM2_APP_NAME"
else
    echo "✗ 后端服务未运行"
    exit 1
fi
echo ""

# 2. 检查后端日志中的路由加载信息
echo "[2/5] 检查路由加载状态..."
echo "查找路由加载日志:"
pm2 logs "$PM2_APP_NAME" --lines 100 --nostream 2>/dev/null | grep -E "(Route loaded|Failed to load route|API routes)" | tail -20 || echo "  没有找到路由加载日志"
echo ""

# 3. 测试生图路由
echo "[3/5] 测试生图路由 (/api/generate-image)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "x-mock-user-id: test_user_001" \
  -H "x-mock-user-role: admin" \
  -d '{"description":"test"}' \
  http://127.0.0.1:4000/api/generate-image 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "404" ]; then
    echo "✗ 路由返回 404 (路由未找到)"
    echo "响应: $BODY"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "⚠️  路由返回 401 (认证失败，但路由存在)"
    echo "响应: $BODY"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "✓ 路由存在 (返回 400 是因为缺少必要参数，但路由已加载)"
    echo "响应: $BODY"
else
    echo "HTTP 状态码: $HTTP_CODE"
    echo "响应: $BODY" | head -c 200
fi
echo ""

# 4. 测试更新 Agent 路由
echo "[4/5] 测试更新 Agent 路由 (/api/agents/:id)..."
TEST_ID="692be447b5220b3109bde538"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
  -H "Content-Type: application/json" \
  -H "x-mock-user-id: test_user_001" \
  -H "x-mock-user-role: admin" \
  -d '{"name":"test"}' \
  "http://127.0.0.1:4000/api/agents/$TEST_ID" 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "404" ]; then
    echo "✗ 路由返回 404 (路由未找到或 Agent 不存在)"
    echo "响应: $BODY"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "✗ 路由返回 403 (权限不足)"
    echo "响应: $BODY"
    echo ""
    echo "可能原因:"
    echo "1. x-mock-user-role 未设置为 'admin'"
    echo "2. requireAdmin 中间件检查失败"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "✓ 路由存在 (返回 400 是因为数据验证失败，但路由已加载)"
    echo "响应: $BODY"
else
    echo "HTTP 状态码: $HTTP_CODE"
    echo "响应: $BODY" | head -c 200
fi
echo ""

# 5. 检查路由文件是否存在
echo "[5/5] 检查路由文件..."
ROUTES=(
    "routes/imageGen.js"
    "routes/agents.js"
    "routes/chat.js"
    "routes/oss.js"
)

for route in "${ROUTES[@]}"; do
    if [ -f "$BACKEND_DIR/src/$route" ]; then
        echo "✓ $route 存在"
    else
        echo "✗ $route 不存在"
    fi
done
echo ""

echo "=========================================="
echo "  诊断完成"
echo "=========================================="
echo ""
echo "如果路由返回 404:"
echo "1. 检查 server.js 中是否正确挂载了路由"
echo "2. 检查 PM2 日志中的路由加载信息"
echo "3. 重启后端服务: pm2 restart $PM2_APP_NAME"
echo ""
echo "如果路由返回 403:"
echo "1. 确保前端发送了 x-mock-user-role: admin header"
echo "2. 检查 .env.production.local 中 ENABLE_MOCK_AUTH=true"
echo "3. 检查后端认证中间件是否正确处理 mock headers"
echo ""

