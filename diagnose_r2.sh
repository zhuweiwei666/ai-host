#!/bin/bash

# =============================================
# R2 配置诊断脚本
# =============================================

echo "🔍 R2 配置诊断..."
echo ""

# 检查 .env 文件
ENV_FILE="/root/ai-host/backend/.env"

echo "📋 1. 检查 .env 文件中的 R2 配置:"
echo "-----------------------------------"
if [ -f "$ENV_FILE" ]; then
    grep -E "^(STORAGE_TYPE|R2_)" "$ENV_FILE" || echo "❌ 未找到 R2 配置"
else
    echo "❌ .env 文件不存在: $ENV_FILE"
fi

echo ""
echo "📋 2. 检查 Docker 容器中的环境变量:"
echo "-----------------------------------"
cd /root/ai-host

# 获取后端容器名称
CONTAINER=$(docker-compose ps -q backend 2>/dev/null)
if [ -n "$CONTAINER" ]; then
    echo "R2 相关环境变量:"
    docker exec $CONTAINER env | grep -E "^(STORAGE_TYPE|R2_)" | sed 's/SECRET_ACCESS_KEY=.*/SECRET_ACCESS_KEY=***HIDDEN***/'
else
    echo "❌ 后端容器未运行"
fi

echo ""
echo "📋 3. 检查后端日志中的 R2 错误:"
echo "-----------------------------------"
docker-compose logs --tail=30 backend 2>/dev/null | grep -i -E "(r2|storage|upload|signature|error)" || echo "无相关日志"

echo ""
echo "📋 4. 测试 R2 连接 (使用 curl):"
echo "-----------------------------------"
# 从 .env 读取配置
if [ -f "$ENV_FILE" ]; then
    source <(grep -E "^R2_" "$ENV_FILE")
    
    if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ]; then
        echo "Account ID: $R2_ACCOUNT_ID"
        echo "Access Key ID: ${R2_ACCESS_KEY_ID:0:10}..."
        echo "Bucket: $R2_BUCKET"
        echo "Endpoint: https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
        echo ""
        
        # 简单的连接测试
        echo "测试端点连接..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" 2>/dev/null)
        echo "HTTP 响应码: $HTTP_CODE"
        
        if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "400" ]; then
            echo "✅ 端点可访问 (需要认证)"
        elif [ "$HTTP_CODE" = "000" ]; then
            echo "❌ 无法连接到端点"
        else
            echo "响应码: $HTTP_CODE"
        fi
    else
        echo "❌ R2 配置不完整"
    fi
fi

echo ""
echo "📋 5. 创建测试上传脚本:"
echo "-----------------------------------"
cat > /tmp/test_r2_upload.js << 'TESTEOF'
const { S3Client, PutObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function testR2() {
  console.log('Testing R2 connection...');
  console.log('Config:', {
    accountId: process.env.R2_ACCOUNT_ID,
    bucket: process.env.R2_BUCKET,
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.substring(0, 10) + '...',
  });

  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  console.log('Endpoint:', endpoint);

  const client = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  try {
    // 测试上传小文件
    const testKey = `test-${Date.now()}.txt`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: testKey,
      Body: Buffer.from('Hello R2! Test upload at ' + new Date().toISOString()),
      ContentType: 'text/plain',
    });

    console.log('Uploading test file:', testKey);
    const result = await client.send(command);
    console.log('✅ Upload successful!');
    console.log('ETag:', result.ETag);
    console.log('Public URL:', `${process.env.R2_DEV_URL}/${testKey}`);
  } catch (error) {
    console.error('❌ Upload failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.Code || error.$metadata?.httpStatusCode);
    if (error.$metadata) {
      console.error('Request ID:', error.$metadata.requestId);
    }
  }
}

testR2();
TESTEOF

echo "测试脚本已创建: /tmp/test_r2_upload.js"
echo ""
echo "在后端容器中运行测试:"
docker exec -it $CONTAINER node /tmp/test_r2_upload.js 2>/dev/null || echo "无法在容器中运行测试"

echo ""
echo "📋 6. 建议操作:"
echo "-----------------------------------"
echo "如果上面显示配置正确但上传失败，请尝试："
echo "1. 在 Cloudflare 重新生成 R2 API Token"
echo "2. 确保 Token 有 '对象读和写' 权限"
echo "3. 确保服务器时间同步: date"
echo ""
echo "当前服务器时间: $(date)"
echo "UTC 时间: $(date -u)"

