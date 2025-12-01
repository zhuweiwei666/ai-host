#!/bin/bash

# 在服务器上直接修复所有问题的脚本

set -e

echo "=========================================="
echo "  修复服务器上的所有问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
CHAT_FILE="$BACKEND_DIR/src/routes/chat.js"
FISH_AUDIO_FILE="$BACKEND_DIR/src/services/fishAudioService.js"

# 1. 修复 chat.js
echo "[1/4] 修复 chat.js..."
if [ -f "$CHAT_FILE" ]; then
    # 直接替换（更可靠）
    sudo sed -i '486s/const newBalance/const finalBalance/' "$CHAT_FILE"
    sudo sed -i '488s/balance: newBalance/balance: finalBalance/' "$CHAT_FILE"
    
    # 验证修复
    if grep -q "const finalBalance = await walletService.getBalance" "$CHAT_FILE"; then
        echo "✓ chat.js 已修复"
    else
        echo "⚠️  chat.js 修复可能失败，请手动检查"
    fi
else
    echo "✗ chat.js 不存在"
fi
echo ""

# 2. 修复 uuid 导入（使用 Node.js 内置 crypto）
echo "[2/4] 修复 uuid 导入..."
if [ -f "$FISH_AUDIO_FILE" ]; then
    # 移除 uuid require
    sudo sed -i "s/const { v4: uuidv4 } = require('uuid');/const crypto = require('crypto');/" "$FISH_AUDIO_FILE"
    # 替换 uuidv4() 为 crypto.randomUUID()
    sudo sed -i 's/uuidv4()/crypto.randomUUID()/g' "$FISH_AUDIO_FILE"
    echo "✓ uuid 导入已修复（使用 Node.js crypto）"
else
    echo "⚠️  fishAudioService.js 不存在"
fi
echo ""

# 3. 修复 Nginx 配置
echo "[3/4] 修复 Nginx 配置..."
NGINX_SITE_CONFIG="/etc/nginx/sites-available/ai-host"

if [ -f "$NGINX_SITE_CONFIG" ]; then
    # 检查是否有 @fallback
    if ! grep -q "location @fallback" "$NGINX_SITE_CONFIG"; then
        echo "  添加 @fallback..."
        # 在最后一个 } 之前添加
        sudo sed -i '/^}$/i\
    location @fallback {\
        rewrite ^.*$ /index.html last;\
    }
' "$NGINX_SITE_CONFIG"
    fi
    
    # 确保 try_files 使用 @fallback
    if ! grep -q "try_files.*@fallback" "$NGINX_SITE_CONFIG"; then
        echo "  修复 try_files..."
        sudo sed -i 's|try_files \$uri \$uri/ /index.html;|try_files $uri $uri/ @fallback;|g' "$NGINX_SITE_CONFIG"
    fi
    
    echo "✓ Nginx 配置已修复"
else
    echo "⚠️  配置文件不存在，从模板创建..."
    sudo cp /var/www/ai-host/deploy/nginx_template.conf "$NGINX_SITE_CONFIG"
    sudo ln -sf "$NGINX_SITE_CONFIG" /etc/nginx/sites-enabled/ai-host
    echo "✓ 已创建配置"
fi
echo ""

# 4. 重启服务
echo "[4/4] 重启服务..."
pm2 restart ai-host-backend
sleep 3

# 检查后端状态
if pm2 logs ai-host-backend --lines 5 --nostream 2>/dev/null | grep -q "Server running"; then
    echo "✓ 后端启动成功"
else
    echo "⚠️  后端可能有问题，查看日志:"
    pm2 logs ai-host-backend --lines 10 --nostream | tail -5
fi

# 测试 Nginx
if sudo nginx -t 2>&1 | grep -q "test is successful"; then
    sudo nginx -s reload
    echo "✓ Nginx 已重载"
else
    echo "⚠️  Nginx 配置有错误"
    sudo nginx -t
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "验证:"
echo "1. 测试 STS: curl http://127.0.0.1:4000/api/oss/sts"
echo "2. 查看日志: pm2 logs ai-host-backend --lines 20 --nostream"
echo ""

