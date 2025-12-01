#!/bin/bash

# 验证部署是否成功

echo "=========================================="
echo "  验证部署状态"
echo "=========================================="
echo ""

# 1. 检查 Nginx 状态
echo "[1/5] 检查 Nginx 状态..."
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx 正在运行"
else
    echo "✗ Nginx 未运行"
    exit 1
fi
echo ""

# 2. 检查配置
echo "[2/5] 检查 Nginx 配置..."
if sudo nginx -t 2>&1 | grep -q "test is successful"; then
    echo "✓ 配置语法正确"
else
    echo "✗ 配置有错误"
    sudo nginx -t
    exit 1
fi
echo ""

# 3. 检查前端文件
echo "[3/5] 检查前端文件..."
FRONTEND_DIR="/var/www/ai-host/frontend/dist"
if [ -f "$FRONTEND_DIR/index.html" ]; then
    echo "✓ index.html 存在"
    FILE_SIZE=$(du -h "$FRONTEND_DIR/index.html" | cut -f1)
    echo "  文件大小: $FILE_SIZE"
else
    echo "✗ index.html 不存在"
    exit 1
fi
echo ""

# 4. 检查站点配置
echo "[4/5] 检查站点配置..."
if [ -f "/etc/nginx/sites-available/ai-host" ]; then
    echo "✓ 站点配置文件存在"
    if [ -L "/etc/nginx/sites-enabled/ai-host" ]; then
        echo "✓ 站点已启用"
    else
        echo "⚠️  站点未启用"
    fi
else
    echo "⚠️  站点配置文件不存在"
fi
echo ""

# 5. 检查错误日志（最近）
echo "[5/5] 检查最近的错误日志..."
RECENT_ERRORS=$(sudo tail -5 /var/log/nginx/error.log | grep -i error | wc -l)
if [ "$RECENT_ERRORS" -eq 0 ]; then
    echo "✓ 最近没有错误"
else
    echo "⚠️  发现 $RECENT_ERRORS 个最近的错误："
    sudo tail -5 /var/log/nginx/error.log | grep -i error
fi
echo ""

# 6. 测试 HTTP 访问
echo "[6/5] 测试 HTTP 访问..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ HTTP 访问正常 (200 OK)"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "⚠️  无法连接到服务器"
else
    echo "⚠️  HTTP 状态码: $HTTP_CODE"
fi
echo ""

echo "=========================================="
echo "  验证完成"
echo "=========================================="
echo ""
echo "如果所有检查都通过，可以访问:"
echo "  http://47.245.121.93"
echo ""
echo "如果仍有问题，查看详细日志:"
echo "  sudo tail -f /var/log/nginx/error.log"
echo "  sudo tail -f /var/log/nginx/ai-host-error.log"
echo ""

