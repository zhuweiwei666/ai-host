#!/bin/bash

# 快速修复当前所有问题

set -e

echo "=========================================="
echo "  快速修复 Nginx 所有问题"
echo "=========================================="
echo ""

# 1. 恢复正确的 nginx.conf（使用自动修复后的备份）
echo "[1/4] 恢复正确的 nginx.conf..."
BACKUP_FILE="/etc/nginx/nginx.conf.backup.20251201_230423"

if [ -f "$BACKUP_FILE" ]; then
    sudo cp "$BACKUP_FILE" /etc/nginx/nginx.conf
    # 添加一个闭合括号（原文件确实缺少一个）
    echo "}" | sudo tee -a /etc/nginx/nginx.conf > /dev/null
    echo "✓ 已恢复正确的配置"
else
    echo "⚠️  备份文件不存在，创建新的正确配置..."
    sudo tee /etc/nginx/nginx.conf > /dev/null <<'EOF'
user nginx;
worker_processes auto;

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF
    echo "✓ 已创建新配置"
fi
echo ""

# 2. 修复路径并添加 @fallback（直接在 nginx.conf 中修复 server 块）
echo "[2/4] 修复 server 块配置..."
# 检查是否 server 块在 nginx.conf 中
if sudo grep -q "server {" /etc/nginx/nginx.conf; then
    # 修复路径
    sudo sed -i 's|/var/www/ai-host-frontend/dist|/var/www/ai-host/frontend/dist|g' /etc/nginx/nginx.conf
    
    # 修复重定向循环
    sudo sed -i 's|try_files \$uri \$uri/ /index.html;|try_files $uri $uri/ @fallback;|g' /etc/nginx/nginx.conf
    
    # 添加 @fallback（在 server 块的最后一个 } 之前）
    if ! sudo grep -q "@fallback" /etc/nginx/nginx.conf; then
        sudo sed -i '/^}$/i\
    location @fallback {\
        rewrite ^.*$ /index.html last;\
    }
' /etc/nginx/nginx.conf
    fi
    
    echo "✓ 已修复 server 块"
else
    echo "✓ server 块在站点配置文件中（将在下一步处理）"
fi
echo ""

# 3. 创建/更新站点配置文件
echo "[3/4] 创建站点配置文件..."
NGINX_SITE_CONFIG="/etc/nginx/sites-available/ai-host"
SOURCE_CONFIG="/var/www/ai-host/deploy/nginx_template.conf"

if [ -f "$SOURCE_CONFIG" ]; then
    sudo cp "$SOURCE_CONFIG" "$NGINX_SITE_CONFIG"
    echo "✓ 站点配置已创建/更新"
    
    # 启用站点
    sudo ln -sf "$NGINX_SITE_CONFIG" /etc/nginx/sites-enabled/ai-host
    echo "✓ 站点已启用"
else
    echo "⚠️  模板文件不存在: $SOURCE_CONFIG"
fi
echo ""

# 4. 测试并重启
echo "[4/4] 测试并重启 Nginx..."
if sudo nginx -t 2>&1; then
    echo "✓ 配置测试通过"
    
    # 重启 Nginx
    sudo systemctl restart nginx
    sleep 2
    
    if systemctl is-active --quiet nginx; then
        echo "✓ Nginx 已成功重启"
    else
        echo "⚠️  Nginx 可能未运行，尝试启动..."
        sudo systemctl start nginx
        echo "✓ Nginx 已启动"
    fi
else
    echo "✗ 配置测试失败"
    echo ""
    echo "请检查:"
    echo "  sudo nginx -t"
    exit 1
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "验证:"
echo "1. 检查状态: sudo systemctl status nginx"
echo "2. 查看日志: sudo tail -f /var/log/nginx/error.log"
echo "3. 测试访问: curl http://47.245.121.93"
echo ""

