#!/bin/bash

# 检查 OSS CORS 配置

echo "=========================================="
echo "  检查 OSS CORS 配置"
echo "=========================================="
echo ""

BUCKET="ai-host"
ENDPOINT="oss-ap-southeast-1.aliyuncs.com"
ORIGIN="https://cling-ai.com"

echo "测试 CORS 预检请求..."
echo "Bucket: $BUCKET"
echo "Endpoint: $ENDPOINT"
echo "Origin: $ORIGIN"
echo ""

# 测试 OPTIONS 请求
RESPONSE=$(curl -s -i -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "https://${BUCKET}.${ENDPOINT}/" 2>&1)

echo "响应头："
echo "$RESPONSE" | grep -i "access-control\|http/" | head -10
echo ""

# 检查是否有 Access-Control-Allow-Origin
if echo "$RESPONSE" | grep -qi "access-control-allow-origin"; then
    echo "✅ CORS 配置存在"
    ALLOW_ORIGIN=$(echo "$RESPONSE" | grep -i "access-control-allow-origin" | head -1)
    echo "   $ALLOW_ORIGIN"
    
    if echo "$ALLOW_ORIGIN" | grep -qi "cling-ai.com"; then
        echo "✅ Origin 匹配正确"
    else
        echo "⚠️  Origin 可能不匹配，请检查 CORS 配置中的来源设置"
    fi
else
    echo "❌ CORS 配置不存在或未生效"
    echo ""
    echo "请检查："
    echo "1. 是否在阿里云控制台配置了 CORS"
    echo "2. 配置的 Origin 是否包含: $ORIGIN"
    echo "3. 是否等待了足够的时间让配置生效（1-5分钟）"
    echo "4. 是否清除了浏览器缓存"
fi

echo ""
echo "=========================================="

