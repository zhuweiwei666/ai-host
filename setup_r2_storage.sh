#!/bin/bash

# =============================================
# Cloudflare R2 存储配置脚本
# =============================================

set -e

echo "🚀 开始配置 Cloudflare R2 存储..."

# 配置文件路径
ENV_FILE="/root/ai-host/backend/.env"

# R2 配置信息
R2_CONFIG="
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
"

# 检查 .env 文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 错误: $ENV_FILE 不存在"
    exit 1
fi

# 备份原文件
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ 已备份原 .env 文件"

# 移除旧的 OSS/R2 配置（如果存在）
sed -i '/^# ----------------------------------$/,/^# Cloudflare R2/d' "$ENV_FILE" 2>/dev/null || true
sed -i '/^STORAGE_TYPE=/d' "$ENV_FILE" 2>/dev/null || true
sed -i '/^R2_/d' "$ENV_FILE" 2>/dev/null || true
sed -i '/^OSS_/d' "$ENV_FILE" 2>/dev/null || true

# 添加 R2 配置
echo "$R2_CONFIG" >> "$ENV_FILE"
echo "✅ 已添加 R2 配置到 .env"

# 显示配置
echo ""
echo "📋 当前 R2 配置:"
grep -E "^(STORAGE_TYPE|R2_)" "$ENV_FILE" || true

# 重启后端服务
echo ""
echo "🔄 重启后端服务..."

cd /root/ai-host

# 检查是否使用 Docker
if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
    docker-compose restart backend
    echo "✅ Docker 后端服务已重启"
elif command -v pm2 &> /dev/null; then
    pm2 restart ai-host-backend 2>/dev/null || pm2 restart all
    echo "✅ PM2 后端服务已重启"
else
    echo "⚠️  请手动重启后端服务"
fi

echo ""
echo "🎉 R2 存储配置完成！"
echo ""
echo "📌 后续步骤:"
echo "   1. 确保已在 Cloudflare R2 设置中配置 CORS 策略"
echo "   2. 测试文件上传功能"

