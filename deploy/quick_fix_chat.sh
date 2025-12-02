#!/bin/bash

# 快速修复 Chat 500 错误

set -e

echo "=========================================="
echo "  快速修复 Chat 500 错误"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
PM2_APP_NAME="ai-host-backend"

# 1. 更新代码
echo "[1/4] 更新代码..."
cd "$BACKEND_DIR"
git pull origin main || echo "  ⚠ Git pull 失败，继续..."
echo ""

# 2. 检查 OpenRouter API Key
echo "[2/4] 检查 OpenRouter API Key..."
if [ -f "$BACKEND_DIR/.env.production.local" ]; then
    API_KEY=$(grep "^OPENROUTER_API_KEY=" "$BACKEND_DIR/.env.production.local" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    if [ -n "$API_KEY" ] && [ "$API_KEY" != "" ]; then
        KEY_LENGTH=${#API_KEY}
        echo "  ✓ API Key 已配置 (长度: $KEY_LENGTH)"
        echo "  ✓ API Key 前缀: ${API_KEY:0:15}..."
        
        # 快速测试 API Key
        echo "  正在测试 API Key..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "https://openrouter.ai/api/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $API_KEY" \
            -H "HTTP-Referer: http://47.245.121.93" \
            -H "X-Title: AI Host Admin" \
            -d '{"model":"openai/gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' 2>&1)
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "  ✓ API Key 有效"
        elif [ "$HTTP_CODE" = "401" ]; then
            echo "  ✗ API Key 无效或已过期"
            echo "  请访问 https://openrouter.ai/keys 检查或创建新的 API Key"
        elif [ "$HTTP_CODE" = "402" ]; then
            echo "  ✗ 账户余额不足"
        else
            echo "  ⚠ API 测试返回状态码: $HTTP_CODE"
        fi
    else
        echo "  ✗ API Key 未配置"
    fi
else
    echo "  ✗ .env.production.local 文件不存在"
fi
echo ""

# 3. 检查最近的错误
echo "[3/4] 检查最近的错误..."
echo "最近的 Chat 相关错误:"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream 2>/dev/null | grep -i "chat\|error\|openrouter\|llm" | tail -10 || echo "  没有找到相关错误"
echo ""

# 4. 重启服务
echo "[4/4] 重启服务..."
pm2 restart "$PM2_APP_NAME" --update-env || {
    echo "  ✗ PM2 重启失败"
    exit 1
}
echo "  ✓ 服务已重启"
echo ""

echo "=========================================="
echo "  修复完成"
echo "=========================================="
echo ""
echo "如果问题仍然存在，请："
echo "1. 查看完整日志: pm2 logs $PM2_APP_NAME --lines 100"
echo "2. 测试 API: curl -X POST http://localhost:4000/api/chat -H 'Content-Type: application/json' -H 'x-mock-user-id: test_user_001' -d '{\"agentId\":\"test\",\"prompt\":\"hello\"}'"
echo ""

