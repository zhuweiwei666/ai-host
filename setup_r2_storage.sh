#!/bin/bash

# =============================================
# Cloudflare R2 存储配置脚本
# =============================================

set -e

echo "🚀 开始配置 Cloudflare R2 存储..."

# 配置文件路径
ENV_FILE="/root/ai-host/backend/.env"

# 检查 .env 文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 错误: $ENV_FILE 不存在"
    exit 1
fi

# 备份原文件
BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE"
echo "✅ 已备份原 .env 文件到: $BACKUP_FILE"

# 创建临时文件
TMP_FILE=$(mktemp)

# 移除旧的存储相关配置
grep -v "^STORAGE_TYPE=" "$ENV_FILE" | \
grep -v "^R2_" | \
grep -v "^OSS_" | \
grep -v "^# Cloudflare R2" | \
grep -v "^# 阿里云 OSS" | \
grep -v "^# ----------------------------------$" > "$TMP_FILE" || true

# 添加 R2 配置
cat >> "$TMP_FILE" << 'EOF'

# ----------------------------------
# Cloudflare R2 存储配置
# ----------------------------------
STORAGE_TYPE=r2
R2_ACCOUNT_ID=18f292ca4a886046b6a8ad0b3fa316a0
R2_ACCESS_KEY_ID=9077fa30661007bf09b2691a1c933b0d
R2_SECRET_ACCESS_KEY=0a08fa17ce2d0eaf5e803f63c98bcfb9852c0ade6b66840dcbc395d891902cbf
R2_BUCKET=clingai
R2_BASE_PATH=uploads
R2_DEV_URL=https://pub-adb0752163614188a4c2683000518d5d.r2.dev
EOF

# 替换原文件
mv "$TMP_FILE" "$ENV_FILE"
echo "✅ 已添加 R2 配置到 .env"

# 显示配置
echo ""
echo "📋 当前 R2 配置:"
grep -E "^(STORAGE_TYPE|R2_)" "$ENV_FILE"

# 检查配置是否正确
echo ""
echo "🔍 验证配置..."
if grep -q "^R2_ACCESS_KEY_ID=9077fa30661007bf09b2691a1c933b0d" "$ENV_FILE"; then
    echo "✅ R2_ACCESS_KEY_ID 配置正确"
else
    echo "❌ R2_ACCESS_KEY_ID 配置可能有问题"
fi

if grep -q "^R2_BUCKET=clingai" "$ENV_FILE"; then
    echo "✅ R2_BUCKET 配置正确"
else
    echo "❌ R2_BUCKET 配置可能有问题"
fi

# 重启后端服务
echo ""
echo "🔄 重启后端服务..."

cd /root/ai-host

# 检查是否使用 Docker
if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
    echo "检测到 Docker Compose，正在重建并重启后端..."
    docker-compose up -d --build backend
    echo "✅ Docker 后端服务已重建并重启"
    
    # 等待服务启动
    sleep 5
    
    # 检查日志
    echo ""
    echo "📜 最近的后端日志:"
    docker-compose logs --tail=20 backend
elif command -v pm2 &> /dev/null; then
    pm2 restart ai-host-backend 2>/dev/null || pm2 restart all
    echo "✅ PM2 后端服务已重启"
else
    echo "⚠️  请手动重启后端服务"
fi

echo ""
echo "🎉 R2 存储配置完成！"
echo ""
echo "📌 如果上传仍然失败，请检查:"
echo "   1. Cloudflare R2 CORS 策略是否已配置"
echo "   2. 运行 'docker-compose logs -f backend' 查看详细错误"
