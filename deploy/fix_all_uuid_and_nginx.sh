#!/bin/bash

# 修复所有 uuid 导入和 Nginx 配置

set -e

echo "=========================================="
echo "  修复所有 uuid 导入和 Nginx 配置"
echo "=========================================="
echo ""

BACKEND_DIR="/var/www/ai-host/backend"
SERVICES_DIR="$BACKEND_DIR/src/services"

# 1. 修复所有使用 uuid 的文件
echo "[1/3] 修复所有 uuid 导入..."

# imageGenerationService.js
if [ -f "$SERVICES_DIR/imageGenerationService.js" ]; then
    sudo sed -i "s/const { v4: uuidv4 } = require('uuid');/const crypto = require('crypto');/" "$SERVICES_DIR/imageGenerationService.js"
    sudo sed -i 's/uuidv4()/crypto.randomUUID()/g' "$SERVICES_DIR/imageGenerationService.js"
    echo "✓ imageGenerationService.js"
fi

# videoGenerationService.js
if [ -f "$SERVICES_DIR/videoGenerationService.js" ]; then
    sudo sed -i "s/const { v4: uuidv4 } = require('uuid');/const crypto = require('crypto');/" "$SERVICES_DIR/videoGenerationService.js"
    sudo sed -i 's/uuidv4()/crypto.randomUUID()/g' "$SERVICES_DIR/videoGenerationService.js"
    echo "✓ videoGenerationService.js"
fi

# voiceTemplateScraper.js
if [ -f "$SERVICES_DIR/voiceTemplateScraper.js" ]; then
    sudo sed -i "s/const { v4: uuidv4 } = require('uuid');/const crypto = require('crypto');/" "$SERVICES_DIR/voiceTemplateScraper.js"
    sudo sed -i 's/uuidv4()/crypto.randomUUID()/g' "$SERVICES_DIR/voiceTemplateScraper.js"
    echo "✓ voiceTemplateScraper.js"
fi

# candyScraper.js
if [ -f "$SERVICES_DIR/candyScraper.js" ]; then
    sudo sed -i "s/const { v4: uuidv4 } = require('uuid');/const crypto = require('crypto');/" "$SERVICES_DIR/candyScraper.js"
    sudo sed -i 's/uuidv4()/crypto.randomUUID()/g' "$SERVICES_DIR/candyScraper.js"
    echo "✓ candyScraper.js"
fi

echo ""

# 2. 修复 Nginx 配置（确保 @fallback 存在）
echo "[2/3] 修复 Nginx 配置..."
NGINX_SITE_CONFIG="/etc/nginx/sites-available/ai-host"

if [ -f "$NGINX_SITE_CONFIG" ]; then
    # 检查是否有 @fallback
    if ! grep -q "location @fallback" "$NGINX_SITE_CONFIG"; then
        echo "  添加 @fallback 定义..."
        
        # 找到 server 块的最后一个 }，在其前添加 @fallback
        # 使用更可靠的方法：在最后一个 } 之前插入
        sudo awk '
            /^}$/ && !found {
                print "    location @fallback {"
                print "        rewrite ^.*$ /index.html last;"
                print "    }"
                found = 1
            }
            { print }
        ' "$NGINX_SITE_CONFIG" > /tmp/nginx_config_fixed.conf
        
        # 备份原配置
        sudo cp "$NGINX_SITE_CONFIG" "${NGINX_SITE_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # 应用新配置
        sudo mv /tmp/nginx_config_fixed.conf "$NGINX_SITE_CONFIG"
        echo "✓ 已添加 @fallback"
    else
        echo "✓ @fallback 已存在"
    fi
    
    # 确保 try_files 使用 @fallback
    if ! grep -q "try_files.*@fallback" "$NGINX_SITE_CONFIG"; then
        echo "  修复 try_files..."
        sudo sed -i 's|try_files \$uri \$uri/ /index.html;|try_files $uri $uri/ @fallback;|g' "$NGINX_SITE_CONFIG"
        sudo sed -i 's|try_files \$uri \$uri/ /index.html|try_files $uri $uri/ @fallback|g' "$NGINX_SITE_CONFIG"
        echo "✓ 已修复 try_files"
    fi
else
    echo "⚠️  配置文件不存在，从模板创建..."
    sudo cp /var/www/ai-host/deploy/nginx_template.conf "$NGINX_SITE_CONFIG"
    sudo ln -sf "$NGINX_SITE_CONFIG" /etc/nginx/sites-enabled/ai-host
    echo "✓ 已创建配置"
fi
echo ""

# 3. 重启服务
echo "[3/3] 重启服务..."
pm2 restart ai-host-backend
sleep 3

# 检查后端状态
if pm2 logs ai-host-backend --lines 10 --nostream 2>/dev/null | grep -q "Server running"; then
    echo "✓ 后端启动成功"
    
    # 检查是否有错误
    if pm2 logs ai-host-backend --lines 20 --nostream 2>/dev/null | grep -q "ERR_REQUIRE_ESM.*uuid"; then
        echo "⚠️  仍有 uuid 错误，请检查日志"
    else
        echo "✓ 没有 uuid 相关错误"
    fi
else
    echo "⚠️  后端可能有问题"
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
echo "1. 测试 STS: curl http://127.0.0.1:4000/api/oss/sts"
echo "2. 检查日志: pm2 logs ai-host-backend --lines 20 --nostream | grep -E 'Error|uuid'"
echo "3. 检查 Nginx: sudo cat /etc/nginx/sites-available/ai-host | grep -A 3 '@fallback'"
echo ""

