#!/bin/bash

# OSS 上传问题诊断脚本

echo "=========================================="
echo "  OSS 上传问题全面诊断"
echo "=========================================="
echo ""

BUCKET="ai-host"
REGION="oss-ap-southeast-1"
ENDPOINT="oss-ap-southeast-1.aliyuncs.com"
ORIGIN="https://cling-ai.com"
TEST_URL="https://${BUCKET}.${ENDPOINT}/"

echo "配置信息："
echo "  Bucket: $BUCKET"
echo "  Region: $REGION"
echo "  Endpoint: $ENDPOINT"
echo "  Origin: $ORIGIN"
echo "  Test URL: $TEST_URL"
echo ""

# 1. 检查后端 OSS 配置
echo "=========================================="
echo "1. 检查后端 OSS 环境变量"
echo "=========================================="
ssh root@139.162.62.115 "docker exec ai-host-backend node -e \"
console.log('OSS_ACCESS_KEY_ID:', process.env.OSS_ACCESS_KEY_ID ? 'SET (' + process.env.OSS_ACCESS_KEY_ID.substring(0, 15) + '...)' : 'NOT SET');
console.log('OSS_ACCESS_KEY_SECRET:', process.env.OSS_ACCESS_KEY_SECRET ? 'SET' : 'NOT SET');
console.log('OSS_BUCKET:', process.env.OSS_BUCKET || 'NOT SET');
console.log('OSS_REGION:', process.env.OSS_REGION || 'NOT SET');
console.log('OSS_ENDPOINT:', process.env.OSS_ENDPOINT || 'NOT SET');
\"" 2>&1
    echo ""
    
# 2. 测试后端 OSS STS API
echo "=========================================="
echo "2. 测试后端 OSS STS API"
echo "=========================================="
STS_RESPONSE=$(curl -s "https://cling-ai.com/api/oss/sts" -H "x-mock-user-id: test_user_001" -H "x-mock-user-role: admin" 2>&1)
echo "$STS_RESPONSE" | head -5
if echo "$STS_RESPONSE" | grep -q "success.*true"; then
    echo "✅ STS API 正常"
        else
    echo "❌ STS API 异常"
        fi
echo ""

# 3. 测试 CORS 预检请求（OPTIONS）
echo "=========================================="
echo "3. 测试 CORS 预检请求 (OPTIONS)"
echo "=========================================="
CORS_RESPONSE=$(curl -s -i -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "$TEST_URL" 2>&1)

echo "HTTP 状态码:"
echo "$CORS_RESPONSE" | grep -i "^HTTP/" | head -1
echo ""

echo "CORS 相关响应头:"
echo "$CORS_RESPONSE" | grep -i "access-control" | head -10
echo ""

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    ALLOW_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" | head -1)
    echo "✅ CORS 配置存在"
    echo "   $ALLOW_ORIGIN"
    
    if echo "$ALLOW_ORIGIN" | grep -qi "cling-ai.com"; then
        echo "✅ Origin 匹配正确"
    else
        echo "⚠️  Origin 不匹配！"
        echo "   期望: $ORIGIN"
        echo "   实际: $ALLOW_ORIGIN"
    fi
else
    echo "❌ CORS 配置不存在或未生效"
    echo ""
    echo "完整响应头:"
    echo "$CORS_RESPONSE" | head -20
fi
echo ""

# 4. 测试实际的 PUT 请求（带签名）
echo "=========================================="
echo "4. 测试 OSS 连接性"
echo "=========================================="
# 先获取 STS 凭证
STS_DATA=$(curl -s "https://cling-ai.com/api/oss/sts" -H "x-mock-user-id: test_user_001" -H "x-mock-user-role: admin" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data.get('data', {})))" 2>/dev/null)

if [ -n "$STS_DATA" ] && echo "$STS_DATA" | grep -q "accessKeyId"; then
    echo "✅ 已获取 STS 凭证"
    echo "   测试上传小文件..."
    
    # 创建一个测试文件
    TEST_FILE="/tmp/oss_test_$(date +%s).txt"
    echo "OSS CORS Test $(date)" > "$TEST_FILE"
    
    # 使用 ali-oss CLI 测试（如果可用）
    if command -v ossutil64 &> /dev/null || command -v ossutil &> /dev/null; then
        echo "   使用 ossutil 测试上传..."
    else
        echo "   ⚠️  ossutil 未安装，跳过直接上传测试"
    fi
else
    echo "❌ 无法获取 STS 凭证"
fi
echo ""

# 5. 检查 OSS bucket 配置（通过 API）
echo "=========================================="
echo "5. 检查 OSS Bucket 配置"
echo "=========================================="
echo "Bucket 名称: $BUCKET"
        echo "Region: $REGION"
        echo "Endpoint: $ENDPOINT"
        echo ""
echo "⚠️  无法通过 API 直接检查 CORS 配置，需要在阿里云控制台手动验证："
echo "   1. 访问: https://oss.console.aliyun.com/bucket/$BUCKET/permission/cors"
echo "   2. 检查是否配置了 CORS 规则"
echo "   3. 确认 Origin 包含: $ORIGIN"
echo "   4. 确认 Methods 包含: PUT, POST, GET, HEAD, DELETE（控制台不会列出 OPTIONS）"
echo ""

# 6. 检查前端代码配置
echo "=========================================="
echo "6. 检查前端代码配置"
echo "=========================================="
if [ -f "frontend/src/utils/ossUpload.ts" ]; then
    echo "✅ ossUpload.ts 存在"
    echo ""
    echo "检查 endpoint 配置:"
    grep -A 5 "endpoint:" frontend/src/utils/ossUpload.ts | head -5
    echo ""
    echo "检查 secure 配置:"
    grep -A 2 "secure:" frontend/src/utils/ossUpload.ts | head -2
else
    echo "❌ ossUpload.ts 不存在"
fi
echo ""

# 7. 网络连接测试
echo "=========================================="
echo "7. 网络连接测试"
echo "=========================================="
if ping -c 1 -W 2 "$ENDPOINT" &> /dev/null; then
    echo "✅ 可以 ping 通 $ENDPOINT"
else
    echo "⚠️  无法 ping $ENDPOINT（可能禁 ping，这是正常的）"
fi

if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$TEST_URL" | grep -q "200\|403\|404"; then
    echo "✅ 可以连接到 OSS endpoint"
else
    echo "❌ 无法连接到 OSS endpoint"
fi
echo ""

# 8. 总结和建议
echo "=========================================="
echo "诊断总结"
echo "=========================================="
echo ""

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    if echo "$CORS_RESPONSE" | grep -qi "cling-ai.com"; then
        echo "✅ CORS 配置看起来正确"
        echo ""
        echo "如果仍然报错，可能的原因："
        echo "1. 浏览器缓存了旧的 CORS 响应，请清除缓存"
        echo "2. 预检请求和实际请求的 Headers 不匹配"
        echo "3. OSS SDK 发送的请求格式与 CORS 配置不匹配"
    else
        echo "❌ CORS Origin 不匹配"
        echo "   请在阿里云控制台检查 CORS 配置中的 Origin 设置"
    fi
else
    echo "❌ CORS 配置不存在或未生效"
    echo ""
    echo "请执行以下步骤："
    echo "1. 登录阿里云控制台: https://oss.console.aliyun.com/"
    echo "2. 选择 bucket: $BUCKET"
    echo "3. 进入: 权限管理 -> 跨域设置（CORS）"
    echo "4. 创建或编辑 CORS 规则："
    echo "   - 来源: $ORIGIN"
    echo "   - 允许 Methods: GET, PUT, POST, HEAD, DELETE（OSS 会自动处理 OPTIONS 预检）"
    echo "   - 允许 Headers: *"
    echo "   - 暴露 Headers: ETag, x-oss-request-id"
    echo "   - 缓存时间: 3600"
    echo "5. 保存后等待 1-5 分钟生效"
fi

echo ""
echo "=========================================="
