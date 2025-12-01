#!/bin/bash

# 修复 chat.js 语法错误和 Nginx @fallback 问题

set -e

echo "=========================================="
echo "  修复 chat.js 语法错误和 Nginx 配置"
echo "=========================================="
echo ""

# 1. 修复 chat.js 语法错误
echo "[1/3] 修复 chat.js 语法错误..."
CHAT_FILE="/var/www/ai-host/backend/src/routes/chat.js"

if [ -f "$CHAT_FILE" ]; then
    # 检查是否有重复声明
    NEWBALANCE_COUNT=$(grep -n "const newBalance\|let newBalance" "$CHAT_FILE" | wc -l)
    echo "  找到 $NEWBALANCE_COUNT 个 newBalance 声明"
    
    # 修复第 486 行的重复声明
    if grep -q "const newBalance = await walletService.getBalance" "$CHAT_FILE"; then
        echo "  修复重复声明..."
        sed -i '486s/const newBalance/finalBalance/' "$CHAT_FILE"
        sed -i '488s/newBalance/finalBalance/' "$CHAT_FILE"
        echo "✓ 已修复 chat.js 语法错误"
    else
        echo "✓ chat.js 语法看起来正确"
    fi
else
    echo "⚠️  chat.js 文件不存在: $CHAT_FILE"
fi
echo ""

# 2. 检查并修复 Nginx 站点配置
echo "[2/3] 检查 Nginx 站点配置..."
NGINX_SITE_CONFIG="/etc/nginx/sites-available/ai-host"

if [ -f "$NGINX_SITE_CONFIG" ]; then
    if ! grep -q "@fallback" "$NGINX_SITE_CONFIG"; then
        echo "⚠️  缺少 @fallback 定义，添加..."
        
        # 备份
        sudo cp "$NGINX_SITE_CONFIG" "${NGINX_SITE_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # 检查是否有 try_files @fallback
        if grep -q "try_files.*@fallback" "$NGINX_SITE_CONFIG"; then
            # 添加 @fallback 定义（在 server 块结束前）
            sudo sed -i '/^}$/i\
    location @fallback {\
        rewrite ^.*$ /index.html last;\
    }
' "$NGINX_SITE_CONFIG"
            echo "✓ 已添加 @fallback 定义"
        else
            echo "⚠️  需要手动修复 Nginx 配置"
        fi
    else
        echo "✓ @fallback 已定义"
    fi
else
    echo "⚠️  站点配置文件不存在: $NGINX_SITE_CONFIG"
    echo "  创建配置文件..."
    sudo cp /var/www/ai-host/deploy/nginx_template.conf "$NGINX_SITE_CONFIG"
    sudo ln -sf "$NGINX_SITE_CONFIG" /etc/nginx/sites-enabled/ai-host
    echo "✓ 已创建并启用站点配置"
fi
echo ""

# 3. 重启服务
echo "[3/3] 重启服务..."
# 重启后端
if pm2 list | grep -q "ai-host-backend"; then
    pm2 restart ai-host-backend
    sleep 2
    echo "✓ 后端服务已重启"
else
    echo "⚠️  后端服务未运行"
fi

# 测试并重载 Nginx
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
echo "1. 检查后端日志: pm2 logs ai-host-backend --lines 50 --nostream"
echo "2. 测试 STS 端点: curl http://127.0.0.1:4000/api/oss/sts"
echo "3. 检查 Nginx: sudo nginx -t"
echo ""

