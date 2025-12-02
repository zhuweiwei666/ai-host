#!/bin/bash

# 检查 OpenRouter 配置

set -e

echo "=========================================="
echo "  检查 OpenRouter 配置"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"

# 1. 检查环境变量
echo "[1/3] 检查环境变量..."
if [ -f "$BACKEND_DIR/.env.production.local" ]; then
    if grep -q "OPENROUTER_API_KEY" "$BACKEND_DIR/.env.production.local"; then
        API_KEY=$(grep "OPENROUTER_API_KEY" "$BACKEND_DIR/.env.production.local" | cut -d'=' -f2)
        if [ -z "$API_KEY" ] || [ "$API_KEY" = "" ]; then
            echo "  ✗ OPENROUTER_API_KEY 已设置但为空"
        else
            KEY_LENGTH=${#API_KEY}
            echo "  ✓ OPENROUTER_API_KEY 已设置 (长度: $KEY_LENGTH)"
            echo "  ✓ API Key 前缀: ${API_KEY:0:10}..."
        fi
    else
        echo "  ✗ OPENROUTER_API_KEY 未在 .env.production.local 中找到"
    fi
    
    # 检查其他 OpenRouter 相关配置
    if grep -q "OPENROUTER_BASE_URL" "$BACKEND_DIR/.env.production.local"; then
        BASE_URL=$(grep "OPENROUTER_BASE_URL" "$BACKEND_DIR/.env.production.local" | cut -d'=' -f2)
        echo "  ✓ OPENROUTER_BASE_URL: $BASE_URL"
    else
        echo "  ℹ OPENROUTER_BASE_URL 未设置，将使用默认值"
    fi
else
    echo "  ✗ .env.production.local 文件不存在"
fi
echo ""

# 2. 测试 API Key（如果配置了）
echo "[2/3] 测试 OpenRouter API..."
if [ -f "$BACKEND_DIR/.env.production.local" ]; then
    # 安全地读取 API Key（只读取以 OPENROUTER_API_KEY= 开头的行，忽略注释和空行）
    API_KEY=$(grep "^OPENROUTER_API_KEY=" "$BACKEND_DIR/.env.production.local" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
    
    if [ -n "$API_KEY" ] && [ "$API_KEY" != "" ]; then
        echo "  正在测试 API Key..."
        RESPONSE=$(curl -s -w "\n%{http_code}" \
            -X POST "https://openrouter.ai/api/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $API_KEY" \
            -H "HTTP-Referer: http://47.245.121.93" \
            -H "X-Title: AI Host Admin" \
            -d '{
                "model": "openai/gpt-3.5-turbo",
                "messages": [{"role": "user", "content": "test"}]
            }' 2>&1)
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | sed '$d')
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "  ✓ API Key 有效"
        elif [ "$HTTP_CODE" = "401" ]; then
            echo "  ✗ API Key 无效或已过期"
            echo "  错误详情: $(echo "$BODY" | grep -o '"message":"[^"]*"' | head -1 || echo 'Unknown error')"
        elif [ "$HTTP_CODE" = "402" ]; then
            echo "  ✗ 账户余额不足"
        elif [ "$HTTP_CODE" = "429" ]; then
            echo "  ⚠ API 请求频率限制"
        else
            echo "  ⚠ API 测试返回状态码: $HTTP_CODE"
            ERROR_MSG=$(echo "$BODY" | grep -o '"message":"[^"]*"' | head -1 || echo "$BODY" | head -c 200)
            echo "  错误: $ERROR_MSG"
        fi
    else
        echo "  ⚠ OPENROUTER_API_KEY 未设置或为空，跳过测试"
    fi
else
    echo "  ⚠ .env.production.local 文件不存在，跳过测试"
fi
echo ""

# 3. 检查 PM2 环境变量
echo "[3/3] 检查 PM2 环境变量..."
pm2 env 0 2>/dev/null | grep -i "OPENROUTER" || echo "  ℹ PM2 环境中未找到 OPENROUTER 相关变量（这是正常的，如果使用 .env 文件）"
echo ""

echo "=========================================="
echo "  检查完成"
echo "=========================================="
echo ""
echo "如果 API Key 无效，请："
echo "1. 访问 https://openrouter.ai/keys 获取或创建新的 API Key"
echo "2. 在 .env.production.local 中设置: OPENROUTER_API_KEY=your_key_here"
echo "3. 重启服务: pm2 restart ai-host-backend --update-env"
echo ""

