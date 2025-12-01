#!/bin/bash

# 修复 nginx.conf 语法错误的脚本

set -e

NGINX_CONF="/etc/nginx/nginx.conf"

echo "=========================================="
echo "  修复 nginx.conf 语法错误"
echo "=========================================="
echo ""

# 1. 备份
echo "[1/4] 备份原配置文件..."
BACKUP_FILE="${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$NGINX_CONF" "$BACKUP_FILE"
echo "✓ 已备份到: $BACKUP_FILE"
echo ""

# 2. 显示第 37 行附近的内容
echo "[2/4] 显示第 37 行附近的内容..."
echo "---"
sudo sed -n '25,45p' "$NGINX_CONF" | cat -n
echo "---"
echo ""

# 3. 检查括号匹配
echo "[3/4] 检查括号匹配..."
OPEN_BRACES=$(sudo grep -o '{' "$NGINX_CONF" | wc -l)
CLOSE_BRACES=$(sudo grep -o '}' "$NGINX_CONF" | wc -l)

echo "  开放括号数: $OPEN_BRACES"
echo "  闭合括号数: $CLOSE_BRACES"
echo ""

if [ "$OPEN_BRACES" -ne "$CLOSE_BRACES" ]; then
    DIFF=$((OPEN_BRACES - CLOSE_BRACES))
    echo "⚠️  括号不匹配！缺少 $DIFF 个闭合括号"
    echo ""
    
    # 尝试自动修复（在文件末尾添加缺失的括号）
    if [ "$DIFF" -gt 0 ] && [ "$DIFF" -le 3 ]; then
        echo "尝试自动修复..."
        for ((i=1; i<=DIFF; i++)); do
            echo "}" | sudo tee -a "$NGINX_CONF" > /dev/null
        done
        echo "✓ 已添加 $DIFF 个闭合括号"
    else
        echo "⚠️  括号差异过大，需要手动检查"
        echo ""
        echo "请检查以下内容："
        echo "1. 每个 server { 是否有对应的 }"
        echo "2. 每个 location { 是否有对应的 }"
        echo "3. http { 块是否闭合"
        echo ""
        echo "查看完整文件："
        echo "  sudo cat $NGINX_CONF"
        exit 1
    fi
else
    echo "✓ 括号数量匹配"
fi
echo ""

# 4. 测试配置
echo "[4/4] 测试配置..."
if sudo nginx -t 2>&1; then
    echo ""
    echo "=========================================="
    echo "  ✓ 配置语法正确！"
    echo "=========================================="
    echo ""
    echo "可以重载 Nginx:"
    echo "  sudo nginx -s reload"
else
    echo ""
    echo "=========================================="
    echo "  ✗ 配置仍有错误"
    echo "=========================================="
    echo ""
    echo "请手动检查："
    echo "1. 查看完整错误: sudo nginx -t"
    echo "2. 查看文件内容: sudo cat $NGINX_CONF"
    echo "3. 恢复备份: sudo cp $BACKUP_FILE $NGINX_CONF"
    echo ""
    exit 1
fi

