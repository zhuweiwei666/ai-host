#!/bin/bash

# 修复 Nginx 配置问题的脚本
# 解决：语法错误、配置文件缺失、重定向循环

set -e

echo "=========================================="
echo "  修复 Nginx 配置问题"
echo "=========================================="
echo ""

# 1. 检查并修复 nginx.conf 语法错误
echo "[1/5] 检查 nginx.conf 语法错误..."
if ! sudo nginx -t 2>&1 | grep -q "test is successful"; then
    echo "⚠️  发现 nginx.conf 语法错误"
    echo "检查第 37 行附近..."
    
    # 备份原文件
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # 检查是否有未闭合的大括号
    OPEN_BRACES=$(grep -o '{' /etc/nginx/nginx.conf | wc -l)
    CLOSE_BRACES=$(grep -o '}' /etc/nginx/nginx.conf | wc -l)
    
    echo "  开放括号数: $OPEN_BRACES"
    echo "  闭合括号数: $CLOSE_BRACES"
    
    if [ "$OPEN_BRACES" -ne "$CLOSE_BRACES" ]; then
        echo "⚠️  括号不匹配，需要手动修复"
        echo "  请检查 /etc/nginx/nginx.conf 第 37 行附近"
        echo "  或运行: sudo nginx -t 查看详细错误"
    fi
else
    echo "✓ nginx.conf 语法正确"
fi
echo ""

# 2. 创建站点配置文件
echo "[2/5] 创建站点配置文件..."
NGINX_CONFIG="/etc/nginx/sites-available/ai-host"
SOURCE_CONFIG="/var/www/ai-host/deploy/nginx_template.conf"

if [ ! -f "$NGINX_CONFIG" ]; then
    if [ -f "$SOURCE_CONFIG" ]; then
        echo "从模板复制配置文件..."
        sudo cp "$SOURCE_CONFIG" "$NGINX_CONFIG"
        echo "✓ 配置文件已创建: $NGINX_CONFIG"
    else
        echo "⚠️  模板文件不存在: $SOURCE_CONFIG"
        echo "创建基本配置..."
        sudo tee "$NGINX_CONFIG" > /dev/null <<'EOF'
server {
    listen 80;
    server_name 47.245.121.93;

    root /var/www/ai-host/frontend/dist;
    index index.html;

    error_log /var/log/nginx/ai-host-error.log;
    access_log /var/log/nginx/ai-host-access.log;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }

    # 前端路由（修复重定向循环）
    location / {
        try_files $uri $uri/ @fallback;
    }

    location @fallback {
        rewrite ^.*$ /index.html last;
    }
}
EOF
        echo "✓ 基本配置已创建"
    fi
else
    echo "✓ 配置文件已存在"
fi
echo ""

# 3. 启用站点
echo "[3/5] 启用站点..."
sudo ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/ai-host
echo "✓ 站点已启用"
echo ""

# 4. 设置文件权限（适配 root 用户运行 Nginx）
echo "[4/5] 设置文件权限..."
NGINX_USER=$(ps aux | grep '[n]ginx: master' | awk '{print $1}' | head -1)
echo "Nginx 运行用户: $NGINX_USER"

if [ "$NGINX_USER" = "root" ]; then
    echo "使用 root 用户运行，设置权限为 root:root"
    sudo chown -R root:root /var/www/ai-host/frontend
    sudo chmod -R 755 /var/www/ai-host/frontend
else
    echo "使用 $NGINX_USER 用户运行"
    sudo chown -R $NGINX_USER:$NGINX_USER /var/www/ai-host/frontend
    sudo chmod -R 755 /var/www/ai-host/frontend
fi
echo "✓ 权限已设置"
echo ""

# 5. 测试并重载
echo "[5/5] 测试并重载 Nginx..."
if sudo nginx -t 2>&1; then
    echo "✓ 配置测试通过"
    if sudo nginx -s reload 2>&1; then
        echo "✓ Nginx 已重载"
    else
        echo "⚠️  重载失败，尝试重启..."
        sudo systemctl restart nginx
        echo "✓ Nginx 已重启"
    fi
else
    echo "✗ 配置测试失败"
    echo ""
    echo "请手动修复 nginx.conf 的语法错误："
    echo "  sudo nano /etc/nginx/nginx.conf"
    echo "  检查第 37 行附近是否有未闭合的大括号"
    exit 1
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "如果仍有问题，请检查："
echo "1. sudo tail -f /var/log/nginx/error.log"
echo "2. sudo tail -f /var/log/nginx/ai-host-error.log"
echo "3. 访问 http://47.245.121.93 测试"
echo ""

