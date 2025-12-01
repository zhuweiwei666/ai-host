#!/bin/bash

# 检查并修复 nginx.conf 语法错误的脚本

echo "=========================================="
echo "  检查 Nginx 主配置文件"
echo "=========================================="
echo ""

NGINX_CONF="/etc/nginx/nginx.conf"

# 备份
echo "[1/3] 备份原配置文件..."
sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✓ 备份完成"
echo ""

# 检查语法
echo "[2/3] 检查配置语法..."
if sudo nginx -t 2>&1 | tee /tmp/nginx_test_output.txt; then
    echo "✓ 配置语法正确"
else
    echo "✗ 发现语法错误"
    echo ""
    echo "错误详情："
    cat /tmp/nginx_test_output.txt
    echo ""
    
    # 检查括号匹配
    OPEN=$(grep -o '{' "$NGINX_CONF" | wc -l)
    CLOSE=$(grep -o '}' "$NGINX_CONF" | wc -l)
    
    echo "括号统计："
    echo "  开放括号: $OPEN"
    echo "  闭合括号: $CLOSE"
    echo ""
    
    if [ "$OPEN" -ne "$CLOSE" ]; then
        echo "⚠️  括号不匹配！"
        echo ""
        echo "请检查以下位置："
        echo "1. 查看第 37 行附近："
        echo "   sudo sed -n '30,45p' $NGINX_CONF"
        echo ""
        echo "2. 手动编辑修复："
        echo "   sudo nano $NGINX_CONF"
        echo ""
        echo "3. 或者查看完整文件："
        echo "   sudo cat $NGINX_CONF"
    fi
fi
echo ""

# 显示相关行
echo "[3/3] 显示第 37 行附近的内容..."
sudo sed -n '30,45p' "$NGINX_CONF"
echo ""

