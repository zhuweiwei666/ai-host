#!/bin/bash

# 配置 OSS CORS 规则
# 需要先安装阿里云 CLI: https://help.aliyun.com/document_detail/121258.html

set -e

BUCKET_NAME="ai-host"
REGION="oss-ap-southeast-1"
ALLOWED_ORIGINS=("https://cling-ai.com" "https://www.cling-ai.com" "http://localhost:5173" "http://localhost:3000")

echo "=========================================="
echo "  配置 OSS CORS 规则"
echo "=========================================="
echo ""
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo "允许来源:"
for origin in "${ALLOWED_ORIGINS[@]}"; do
  echo "  - $origin"
done
echo ""

# 检查是否安装了阿里云 CLI
if ! command -v aliyun &> /dev/null; then
    echo "❌ 未安装阿里云 CLI"
    echo ""
    echo "请先安装阿里云 CLI："
    echo "  wget https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz"
    echo "  tar -xzf aliyun-cli-linux-latest-amd64.tgz"
    echo "  sudo mv aliyun /usr/local/bin/"
    echo ""
    echo "然后配置 AccessKey："
    echo "  aliyun configure set --profile default --mode AK --region $REGION --access-key-id <你的AccessKeyId> --access-key-secret <你的AccessKeySecret>"
    echo ""
    exit 1
fi

# 创建 CORS 配置文件
ALLOWED_ORIGIN_JSON=$(printf '"%s",' "${ALLOWED_ORIGINS[@]}")
ALLOWED_ORIGIN_JSON="[${ALLOWED_ORIGIN_JSON%,}]"

CORS_CONFIG=$(cat <<EOF
{
  "CORSRule": [
    {
      "AllowedOrigin": $ALLOWED_ORIGIN_JSON,
      "AllowedMethod": ["GET", "PUT", "POST", "HEAD", "DELETE"],
      "AllowedHeader": ["*"],
      "ExposeHeader": ["ETag", "x-oss-request-id", "x-oss-next-append-position"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF
)

echo "CORS 配置内容："
echo "$CORS_CONFIG" | jq '.' 2>/dev/null || echo "$CORS_CONFIG"
echo ""

# 保存配置到临时文件
TEMP_FILE=$(mktemp)
echo "$CORS_CONFIG" > "$TEMP_FILE"

echo "正在配置 OSS CORS..."
echo ""

# 使用阿里云 CLI 配置 CORS
if aliyun oss put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --cors-configuration file://"$TEMP_FILE" 2>&1; then
    echo ""
    echo "✅ CORS 配置成功！"
    echo ""
    echo "等待 1-2 分钟让配置生效..."
    echo ""
    echo "验证配置："
    echo "  curl -X OPTIONS -H 'Origin: https://cling-ai.com' -H 'Access-Control-Request-Method: PUT' -v https://$BUCKET_NAME.$REGION.aliyuncs.com/"
else
    echo ""
    echo "❌ CORS 配置失败"
    echo ""
    echo "请检查："
    echo "1. AccessKey 是否正确配置"
    echo "2. AccessKey 是否有 OSS 管理权限"
    echo "3. Bucket 名称是否正确"
    echo ""
    echo "或者手动在阿里云控制台配置："
    echo "  https://oss.console.aliyun.com/bucket/$BUCKET_NAME/permission/cors"
    exit 1
fi

# 清理临时文件
rm -f "$TEMP_FILE"

echo "=========================================="

