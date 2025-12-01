#!/bin/bash

# Nginx 500 错误快速修复脚本
# 在服务器上运行此脚本

set -e

echo "=========================================="
echo "  Nginx 500 错误快速修复脚本"
echo "=========================================="

# 1. 检查并创建目录
echo "[1/6] 检查目录..."
if [ ! -d "/var/www/ai-host-frontend/dist" ]; then
    echo "创建目录 /var/www/ai-host-frontend/dist"
    sudo mkdir -p /var/www/ai-host-frontend/dist
else
    echo "✓ 目录已存在"
fi

# 2. 检查 index.html
echo -e "\n[2/6] 检查 index.html..."
if [ ! -f "/var/www/ai-host-frontend/dist/index.html" ]; then
    echo "⚠️  警告: index.html 不存在！"
    echo "请确保前端已构建并部署到 /var/www/ai-host-frontend/dist"
    echo "或者运行: cd frontend && npm run build && sudo cp -r dist/* /var/www/ai-host-frontend/dist/"
    exit 1
else
    echo "✓ index.html 存在"
fi

# 3. 设置权限
echo -e "\n[3/6] 设置文件权限..."
sudo chown -R www-data:www-data /var/www/ai-host-frontend
sudo chmod -R 755 /var/www/ai-host-frontend
echo "✓ 权限已设置"

# 4. 检查 Nginx 配置
echo -e "\n[4/6] 检查 Nginx 配置..."
if sudo nginx -t; then
    echo "✓ Nginx 配置语法正确"
else
    echo "✗ Nginx 配置有错误，请检查"
    exit 1
fi

# 5. 检查是否有默认站点冲突
echo -e "\n[5/6] 检查默认站点..."
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    echo "⚠️  发现默认站点，建议禁用："
    echo "sudo rm /etc/nginx/sites-enabled/default"
fi

# 6. 重载 Nginx
echo -e "\n[6/6] 重载 Nginx..."
if sudo nginx -s reload; then
    echo "✓ Nginx 已重载"
else
    echo "✗ Nginx 重载失败，尝试重启..."
    sudo systemctl restart nginx
fi

echo -e "\n=========================================="
echo "  修复完成！"
echo "=========================================="
echo "如果问题仍然存在，请检查："
echo "1. sudo tail -f /var/log/nginx/error.log"
echo "2. sudo tail -f /var/log/nginx/ai-host-error.log"
echo "3. 确保前端文件已正确部署"

