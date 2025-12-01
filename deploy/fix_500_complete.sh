#!/bin/bash

# Nginx 500 错误完整修复脚本
# 此脚本会执行所有必要的修复步骤

set -e

echo "=========================================="
echo "  Nginx 500 错误完整修复"
echo "=========================================="
echo ""

FRONTEND_DIR="/var/www/ai-host-frontend/dist"
NGINX_CONFIG="/etc/nginx/sites-available/ai-host"

# 1. 创建目录
echo "[1/7] 创建前端目录..."
sudo mkdir -p "$FRONTEND_DIR"
sudo mkdir -p /var/www/ai-host-frontend
echo "✓ 目录已创建"
echo ""

# 2. 检查是否有前端文件
echo "[2/7] 检查前端文件..."
if [ -f "$FRONTEND_DIR/index.html" ]; then
    echo "✓ 前端文件已存在"
else
    echo "⚠️  前端文件不存在"
    echo ""
    echo "请选择:"
    echo "1) 如果前端文件在其他位置，请输入路径"
    echo "2) 如果需要在服务器上构建，请确保已安装 Node.js"
    echo ""
    read -p "前端 dist 目录路径（留空跳过）: " SOURCE_DIR
    
    if [ -n "$SOURCE_DIR" ] && [ -d "$SOURCE_DIR" ]; then
        echo "复制文件从 $SOURCE_DIR 到 $FRONTEND_DIR..."
        sudo cp -r "$SOURCE_DIR"/* "$FRONTEND_DIR/"
        echo "✓ 文件已复制"
    else
        echo "⚠️  未提供有效路径，跳过文件复制"
        echo "   请手动部署前端文件到: $FRONTEND_DIR"
    fi
fi
echo ""

# 3. 设置权限
echo "[3/7] 设置文件权限..."
sudo chown -R www-data:www-data /var/www/ai-host-frontend
sudo chmod -R 755 /var/www/ai-host-frontend
echo "✓ 权限已设置"
echo ""

# 4. 检查并创建 Nginx 配置
echo "[4/7] 检查 Nginx 配置..."
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "⚠️  配置文件不存在，需要创建"
    echo "   请确保已将 nginx_template.conf 复制到服务器"
    read -p "配置文件路径（留空跳过）: " CONFIG_SOURCE
    
    if [ -n "$CONFIG_SOURCE" ] && [ -f "$CONFIG_SOURCE" ]; then
        sudo cp "$CONFIG_SOURCE" "$NGINX_CONFIG"
        echo "✓ 配置文件已创建"
    else
        echo "⚠️  未提供配置文件，将使用默认配置"
        # 创建基本配置
        sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
server {
    listen 80;
    server_name 47.245.121.93;

    root $FRONTEND_DIR;
    index index.html;

    error_log /var/log/nginx/ai-host-error.log;
    access_log /var/log/nginx/ai-host-access.log;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
        echo "✓ 已创建基本配置"
    fi
else
    echo "✓ 配置文件已存在"
fi
echo ""

# 5. 启用站点
echo "[5/7] 启用 Nginx 站点..."
sudo ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/ai-host
echo "✓ 站点已启用"
echo ""

# 6. 禁用默认站点（如果存在）
echo "[6/7] 检查默认站点..."
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    echo "⚠️  发现默认站点，建议禁用"
    read -p "是否禁用默认站点? (y/n): " DISABLE_DEFAULT
    if [ "$DISABLE_DEFAULT" = "y" ]; then
        sudo rm /etc/nginx/sites-enabled/default
        echo "✓ 默认站点已禁用"
    fi
else
    echo "✓ 无默认站点冲突"
fi
echo ""

# 7. 测试并重载 Nginx
echo "[7/7] 测试并重载 Nginx..."
if sudo nginx -t; then
    echo "✓ 配置测试通过"
    if sudo nginx -s reload; then
        echo "✓ Nginx 已重载"
    else
        echo "⚠️  重载失败，尝试重启..."
        sudo systemctl restart nginx
        echo "✓ Nginx 已重启"
    fi
else
    echo "✗ 配置测试失败"
    echo "请检查配置文件: $NGINX_CONFIG"
    exit 1
fi
echo ""

# 验证
echo "=========================================="
echo "  验证"
echo "=========================================="
echo ""

if [ -f "$FRONTEND_DIR/index.html" ]; then
    echo "✓ index.html 存在"
    FILE_SIZE=$(du -h "$FRONTEND_DIR/index.html" | cut -f1)
    echo "  文件大小: $FILE_SIZE"
else
    echo "✗ index.html 不存在 - 这是主要问题！"
    echo ""
    echo "请部署前端文件:"
    echo "  cd frontend && npm run build"
    echo "  sudo cp -r dist/* $FRONTEND_DIR/"
fi
echo ""

if systemctl is-active --quiet nginx; then
    echo "✓ Nginx 正在运行"
else
    echo "✗ Nginx 未运行"
    echo "  启动: sudo systemctl start nginx"
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 访问 http://47.245.121.93 测试"
echo "2. 如果仍有问题，查看日志:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo "   sudo tail -f /var/log/nginx/ai-host-error.log"
echo "3. 运行诊断脚本:"
echo "   sudo ./diagnose_500.sh"
echo ""

