#!/bin/bash

# 诊断 OSS 上传问题

set -e

echo "=========================================="
echo "  OSS 上传问题诊断"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
ENV_FILE="$BACKEND_DIR/.env.production.local"

# 1. 检查 OSS 环境变量
echo "[1/6] 检查 OSS 环境变量..."
if [ -f "$ENV_FILE" ]; then
    echo "环境变量文件: $ENV_FILE"
    echo ""
    
    # 检查必需的变量（隐藏敏感值）
    echo "OSS 配置（值已隐藏）:"
    grep "^OSS_" "$ENV_FILE" 2>/dev/null | while IFS='=' read -r key value; do
        if [[ "$key" == *"SECRET"* ]] || [[ "$key" == *"KEY"* ]]; then
            echo "  $key=***"
        else
            echo "  $key=$value"
        fi
    done
    
    # 检查是否缺少变量
    REQUIRED_VARS=("OSS_ACCESS_KEY_ID" "OSS_ACCESS_KEY_SECRET" "OSS_BUCKET" "OSS_REGION" "OSS_ENDPOINT")
    MISSING=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
            MISSING+=("$var")
        fi
    done
    
    if [ ${#MISSING[@]} -gt 0 ]; then
        echo ""
        echo "✗ 缺少以下环境变量:"
        for var in "${MISSING[@]}"; do
            echo "   - $var"
        done
    else
        echo ""
        echo "✓ 所有必需的 OSS 环境变量已配置"
    fi
else
    echo "✗ 环境变量文件不存在: $ENV_FILE"
fi
echo ""

# 2. 测试 STS 端点
echo "[2/6] 测试 OSS STS 端点..."
RESPONSE=$(curl -s -w "\n%{http_code}" -H 'x-mock-user-id: test_user_001' http://127.0.0.1:4000/api/oss/sts 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ STS 端点返回 200"
    echo "响应内容（前 200 字符）:"
    echo "$BODY" | head -c 200
    echo ""
    
    # 检查响应是否包含必要的字段
    if echo "$BODY" | grep -q "accessKeyId"; then
        echo "✓ 响应包含 accessKeyId"
    else
        echo "✗ 响应缺少 accessKeyId"
    fi
    
    if echo "$BODY" | grep -q "bucket"; then
        BUCKET=$(echo "$BODY" | grep -o '"bucket":"[^"]*"' | cut -d'"' -f4)
        echo "✓ Bucket: $BUCKET"
    fi
else
    echo "✗ STS 端点返回 $HTTP_CODE"
    echo "错误信息:"
    echo "$BODY" | head -c 500
    echo ""
fi
echo ""

# 3. 检查后端日志中的 OSS 相关错误
echo "[3/6] 检查后端日志..."
echo "最近 50 行日志中与 OSS 相关的错误:"
pm2 logs ai-host-backend --lines 50 --nostream 2>/dev/null | grep -i -E "oss|sts|upload" | tail -10 || echo "  没有找到相关日志"
echo ""

# 4. 检查 OSS bucket 配置（需要 AccessKey）
echo "[4/6] 检查 OSS bucket 配置..."
if [ -f "$ENV_FILE" ]; then
    # 读取配置（不显示敏感信息）
    BUCKET=$(grep "^OSS_BUCKET=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
    REGION=$(grep "^OSS_REGION=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
    ENDPOINT=$(grep "^OSS_ENDPOINT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
    
    if [ -n "$BUCKET" ] && [ -n "$ENDPOINT" ]; then
        echo "Bucket: $BUCKET"
        echo "Region: $REGION"
        echo "Endpoint: $ENDPOINT"
        echo ""
        echo "⚠️  需要手动检查以下 OSS 配置:"
        echo "1. Bucket 的 CORS 配置（必须允许前端域名）"
        echo "2. Bucket 的权限设置（公共读或私有）"
        echo "3. AccessKey 的权限（必须有 PutObject 权限）"
    else
        echo "⚠️  无法读取 OSS 配置"
    fi
else
    echo "⚠️  环境变量文件不存在"
fi
echo ""

# 5. 检查前端构建
echo "[5/6] 检查前端构建..."
FRONTEND_DIST="/var/www/ai-host/frontend/dist"
if [ -d "$FRONTEND_DIST" ]; then
    if [ -f "$FRONTEND_DIST/index.html" ]; then
        echo "✓ 前端构建文件存在"
        echo "  路径: $FRONTEND_DIST"
    else
        echo "✗ index.html 不存在"
    fi
else
    echo "✗ 前端构建目录不存在"
fi
echo ""

# 6. 生成 OSS CORS 配置建议
echo "[6/6] OSS CORS 配置建议..."
cat << 'EOF'

==========================================
  OSS CORS 配置指南
==========================================

需要在阿里云 OSS 控制台配置 CORS，允许前端域名上传：

1. 登录阿里云控制台 -> OSS -> 选择 bucket
2. 进入"权限管理" -> "跨域设置" -> "创建规则"
3. 配置如下：

来源（AllowedOrigins）:
  http://47.245.121.93
  http://localhost:5173
  http://localhost:3000

允许 Methods:
  GET
  PUT
  POST
  HEAD

允许 Headers:
  *

暴露 Headers:
  ETag
  x-oss-request-id

缓存时间（秒）:
  3600

==========================================

EOF

echo "=========================================="
echo "  诊断完成"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 检查上述输出中的错误"
echo "2. 配置 OSS bucket 的 CORS（见上方指南）"
echo "3. 确认 AccessKey 有 PutObject 权限"
echo "4. 重新测试上传功能"
echo ""

