#!/bin/bash

# 更新 OpenRouter API Key

set -e

NEW_API_KEY="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"
BACKEND_DIR="/var/www/ai-host/backend"
ENV_FILE="$BACKEND_DIR/.env.production.local"

echo "=========================================="
echo "  更新 OpenRouter API Key"
echo "=========================================="
echo ""

# 检查文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "✗ 错误: $ENV_FILE 文件不存在"
    exit 1
fi

# 备份原文件
BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE"
echo "✓ 已创建备份: $BACKUP_FILE"
echo ""

# 检查是否已有 OPENROUTER_API_KEY
if grep -q "^OPENROUTER_API_KEY=" "$ENV_FILE"; then
    # 更新现有的 API Key
    sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$NEW_API_KEY|" "$ENV_FILE"
    echo "✓ 已更新 OPENROUTER_API_KEY"
else
    # 添加新的 API Key（如果不存在）
    echo "OPENROUTER_API_KEY=$NEW_API_KEY" >> "$ENV_FILE"
    echo "✓ 已添加 OPENROUTER_API_KEY"
fi

# 验证更新
echo ""
echo "验证更新:"
if grep -q "^OPENROUTER_API_KEY=$NEW_API_KEY" "$ENV_FILE"; then
    echo "✓ API Key 更新成功"
    echo "✓ 新 API Key 前缀: ${NEW_API_KEY:0:15}..."
else
    echo "✗ 更新失败，请手动检查"
    exit 1
fi

echo ""
echo "=========================================="
echo "  更新完成"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 重启服务: pm2 restart ai-host-backend --update-env"
echo "2. 验证配置: cd /var/www/ai-host/deploy && ./check_openrouter.sh"
echo ""

