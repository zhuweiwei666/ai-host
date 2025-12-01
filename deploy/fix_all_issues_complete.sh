#!/bin/bash

# 完整修复所有问题

set -e

echo "=========================================="
echo "  完整修复所有问题"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
CHAT_FILE="$BACKEND_DIR/src/routes/chat.js"
FISH_AUDIO_FILE="$BACKEND_DIR/src/services/fishAudioService.js"

# 1. 修复 chat.js 中的 newBalance 重复声明
echo "[1/4] 修复 chat.js 语法错误..."
if [ -f "$CHAT_FILE" ]; then
    # 检查第 486-487 行
    if grep -n "const newBalance = await walletService.getBalance" "$CHAT_FILE" > /dev/null 2>&1; then
        echo "  发现重复声明，修复中..."
        # 使用更精确的 sed 命令
        sudo sed -i 's/const newBalance = await walletService.getBalance(userId);/const finalBalance = await walletService.getBalance(userId);/' "$CHAT_FILE"
        sudo sed -i 's/balance: newBalance/balance: finalBalance/' "$CHAT_FILE"
        echo "✓ 已修复 chat.js"
    else
        echo "✓ chat.js 看起来已修复"
    fi
else
    echo "✗ chat.js 文件不存在"
fi
echo ""

# 2. 修复 uuid 模块导入问题
echo "[2/4] 修复 uuid 模块导入..."
if [ -f "$FISH_AUDIO_FILE" ]; then
    if grep -q "require('uuid')" "$FISH_AUDIO_FILE"; then
        echo "  修复 uuid 导入..."
        # 检查 uuid 版本
        UUID_VERSION=$(cd "$BACKEND_DIR" && npm list uuid 2>/dev/null | grep uuid | head -1 | awk '{print $2}' | tr -d '@' || echo "")
        
        if [[ "$UUID_VERSION" == *"13"* ]] || [[ "$UUID_VERSION" == *"14"* ]] || [[ "$UUID_VERSION" == *"15"* ]]; then
            echo "  使用新版本 uuid，改为动态导入..."
            # 将 require 改为动态导入（在异步函数中使用）
            sudo sed -i "s/const { v4: uuidv4 } = require('uuid');/\/\/ uuid imported dynamically in function/" "$FISH_AUDIO_FILE"
            
            # 找到使用 uuidv4 的地方，改为动态导入
            if grep -q "uuidv4()" "$FISH_AUDIO_FILE"; then
                # 在函数内部添加动态导入
                sudo sed -i '/const fileName = /i\
      const { v4: uuidv4 } = await import('\''uuid'\'');\
' "$FISH_AUDIO_FILE"
            fi
        else
            echo "  使用旧版本 uuid，保持 require"
        fi
    else
        echo "✓ uuid 导入看起来已修复"
    fi
else
    echo "⚠️  fishAudioService.js 不存在"
fi
echo ""

# 3. 修复 Nginx 配置
echo "[3/4] 修复 Nginx 配置..."
NGINX_SITE_CONFIG="/etc/nginx/sites-available/ai-host"

# 检查配置是否包含 @fallback
if [ -f "$NGINX_SITE_CONFIG" ]; then
    if ! grep -q "location @fallback" "$NGINX_SITE_CONFIG"; then
        echo "  添加 @fallback 定义..."
        # 备份
        sudo cp "$NGINX_SITE_CONFIG" "${NGINX_SITE_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # 在 server 块结束前添加 @fallback
        sudo sed -i '/^}$/i\
    location @fallback {\
        rewrite ^.*$ /index.html last;\
    }
' "$NGINX_SITE_CONFIG"
        echo "✓ 已添加 @fallback"
    else
        echo "✓ @fallback 已存在"
    fi
    
    # 检查是否有 try_files @fallback
    if ! grep -q "try_files.*@fallback" "$NGINX_SITE_CONFIG"; then
        echo "  修复 try_files 配置..."
        sudo sed -i 's|try_files \$uri \$uri/ /index.html;|try_files $uri $uri/ @fallback;|g' "$NGINX_SITE_CONFIG"
        echo "✓ 已修复 try_files"
    fi
else
    echo "⚠️  站点配置不存在，从模板创建..."
    sudo cp /var/www/ai-host/deploy/nginx_template.conf "$NGINX_SITE_CONFIG"
    sudo ln -sf "$NGINX_SITE_CONFIG" /etc/nginx/sites-enabled/ai-host
    echo "✓ 已创建配置"
fi
echo ""

# 4. 重启服务
echo "[4/4] 重启服务..."
# 重启后端
if pm2 list | grep -q "ai-host-backend"; then
    pm2 restart ai-host-backend
    sleep 3
    echo "✓ 后端已重启"
    
    # 检查是否有错误
    sleep 1
    if pm2 logs ai-host-backend --lines 10 --nostream 2>/dev/null | grep -q "SyntaxError\|Error loading routes"; then
        echo "⚠️  后端仍有错误，查看日志:"
        pm2 logs ai-host-backend --lines 20 --nostream | grep -A 5 "Error\|SyntaxError" | head -10
    else
        echo "✓ 后端启动成功"
    fi
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
echo "1. 检查 chat.js 第 487 行:"
echo "   sed -n '485,490p' $CHAT_FILE"
echo ""
echo "2. 测试 STS 端点:"
echo "   curl http://127.0.0.1:4000/api/oss/sts"
echo ""
echo "3. 检查后端日志:"
echo "   pm2 logs ai-host-backend --lines 30 --nostream"
echo ""

