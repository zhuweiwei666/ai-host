#!/bin/bash

# 检查 OSS 签名问题

echo "=========================================="
echo "  检查 OSS 签名和 HTTPS 配置"
echo "=========================================="
echo ""

# 1. 检查服务器时间同步
echo "1. 检查服务器时间同步"
echo "----------------------------------------"
ssh root@139.162.62.115 "date && echo 'UTC时间:' && date -u" 2>&1
echo ""

# 2. 检查 STS API 返回的配置
echo "2. 检查 STS API 配置"
echo "----------------------------------------"
STS_RESPONSE=$(curl -s "https://cling-ai.com/api/oss/sts" -H "x-mock-user-id: test_user_001" -H "x-mock-user-role: admin" 2>&1)
echo "$STS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -15
echo ""

# 3. 检查 region 格式
echo "3. 检查 Region 格式"
echo "----------------------------------------"
REGION=$(echo "$STS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('region', ''))" 2>/dev/null)
echo "当前 region: $REGION"
if [[ "$REGION" == oss-* ]]; then
    echo "⚠️  Region 包含 'oss-' 前缀，ali-oss SDK 需要去掉前缀"
    echo "   应该使用: ${REGION#oss-}"
else
    echo "✅ Region 格式正确"
fi
echo ""

# 4. 检查 endpoint 格式
echo "4. 检查 Endpoint 格式"
echo "----------------------------------------"
ENDPOINT=$(echo "$STS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('endpoint', ''))" 2>/dev/null)
echo "当前 endpoint: $ENDPOINT"
if [[ "$ENDPOINT" == http* ]]; then
    echo "⚠️  Endpoint 包含协议，ali-oss SDK 需要纯域名"
    echo "   应该使用: ${ENDPOINT#https://}"
else
    echo "✅ Endpoint 格式正确"
fi
echo ""

# 5. 测试 OSS 连接
echo "5. 测试 OSS HTTPS 连接"
echo "----------------------------------------"
BUCKET=$(echo "$STS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('bucket', ''))" 2>/dev/null)
if [ -n "$BUCKET" ] && [ -n "$ENDPOINT" ]; then
    TEST_URL="https://${BUCKET}.${ENDPOINT}/"
    echo "测试 URL: $TEST_URL"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$TEST_URL" 2>&1)
    echo "HTTP 状态码: $HTTP_CODE"
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
        echo "✅ OSS 连接正常"
    else
        echo "❌ OSS 连接失败"
    fi
fi
echo ""

# 6. 检查 CORS 配置
echo "6. 检查 CORS 配置"
echo "----------------------------------------"
CORS_RESPONSE=$(curl -s -i -X OPTIONS \
  -H "Origin: https://cling-ai.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "$TEST_URL" 2>&1)

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    echo "✅ CORS 配置存在"
else
    echo "❌ CORS 配置不存在"
fi
echo ""

echo "=========================================="
echo "修复建议"
echo "=========================================="
echo ""
echo "如果 region 或 endpoint 格式不正确，请："
echo "1. 检查后端返回的 region 和 endpoint 格式"
echo "2. 确保前端代码正确处理这些值"
echo "3. ali-oss SDK 要求："
echo "   - region: 不带 'oss-' 前缀（例如: ap-southeast-1）"
echo "   - endpoint: 纯域名，不包含协议（例如: oss-ap-southeast-1.aliyuncs.com）"
echo "   - secure: true（使用 HTTPS）"
echo ""
echo "如果时间不同步，请："
echo "  ssh root@139.162.62.115 'ntpdate -s time.nist.gov'"
echo ""

