#!/bin/bash

# 修复所有 Nginx 问题的完整脚本

set -e

echo "=========================================="
echo "  修复所有 Nginx 问题"
echo "=========================================="
echo ""

# 1. 恢复正确的 nginx.conf（使用自动修复后的版本）
echo "[1/5] 恢复正确的 nginx.conf..."
BACKUP_FILE="/etc/nginx/nginx.conf.backup.20251201_230423"

if [ -f "$BACKUP_FILE" ]; then
    # 恢复备份，然后添加一个闭合括号（因为原文件确实缺少一个）
    sudo cp "$BACKUP_FILE" /etc/nginx/nginx.conf
    
    # 检查括号数量
    OPEN=$(sudo grep -o '{' /etc/nginx/nginx.conf | wc -l)
    CLOSE=$(sudo grep -o '}' /etc/nginx/nginx.conf | wc -l)
    
    if [ "$OPEN" -ne "$CLOSE" ]; then
        # 只添加一个闭合括号
        echo "}" | sudo tee -a /etc/nginx/nginx.conf > /dev/null
        echo "✓ 已恢复并修复括号"
    else
        echo "✓ 已恢复（括号已匹配）"
    fi
else
    echo "⚠️  备份文件不存在，使用当前文件"
fi
echo ""

# 2. 修复路径问题
echo "[2/5] 修复前端路径..."
sudo sed -i 's|/var/www/ai-host-frontend/dist|/var/www/ai-host/frontend/dist|g' /etc/nginx/nginx.conf
echo "✓ 路径已修复"
echo ""

# 3. 修复重定向循环（使用 @fallback）
echo "[3/5] 修复重定向循环..."
# 检查是否已经有 @fallback
if ! sudo grep -q "@fallback" /etc/nginx/nginx.conf; then
    # 替换 try_files 配置
    sudo sed -i 's|try_files \$uri \$uri/ /index.html;|try_files $uri $uri/ @fallback;|g' /etc/nginx/nginx.conf
    
    # 在 server 块结束前添加 @fallback location
    # 找到最后一个 } 之前插入
    sudo sed -i '/^}$/i\
    location @fallback {\
        rewrite ^.*$ /index.html last;\
    }
' /etc/nginx/nginx.conf
    
    echo "✓ 已添加 @fallback 配置"
else
    echo "✓ @fallback 配置已存在"
fi
echo ""

# 4. 创建站点配置文件（使用正确的模板）
echo "[4/5] 创建站点配置文件..."
NGINX_SITE_CONFIG="/etc/nginx/sites-available/ai-host"
SOURCE_CONFIG="/var/www/ai-host/deploy/nginx_template.conf"

if [ -f "$SOURCE_CONFIG" ]; then
    sudo cp "$SOURCE_CONFIG" "$NGINX_SITE_CONFIG"
    echo "✓ 站点配置已创建"
    
    # 启用站点
    sudo ln -sf "$NGINX_SITE_CONFIG" /etc/nginx/sites-enabled/ai-host
    echo "✓ 站点已启用"
else
    echo "⚠️  模板文件不存在: $SOURCE_CONFIG"
fi
echo ""

# 5. 测试并重载
echo "[5/5] 测试并重载 Nginx..."
if sudo nginx -t 2>&1; then
    echo "✓ 配置测试通过"
    
    # 重启 Nginx（因为 reload 可能失败）
    if sudo systemctl restart nginx 2>&1; then
        echo "✓ Nginx 已重启"
    else
        echo "⚠️  重启失败，尝试启动..."
        sudo systemctl start nginx
        echo "✓ Nginx 已启动"
    fi
else
    echo "✗ 配置测试失败"
    echo ""
    echo "请检查配置:"
    echo "  sudo nginx -t"
    echo "  sudo cat /etc/nginx/nginx.conf"
    exit 1
fi
echo ""

echo "=========================================="
echo "  修复完成！"
echo "=========================================="
echo ""
echo "验证步骤:"
echo "1. 检查 Nginx 状态: sudo systemctl status nginx"
echo "2. 查看错误日志: sudo tail -f /var/log/nginx/error.log"
echo "3. 访问测试: curl http://47.245.121.93"
echo ""

