#!/bin/bash

# 显示 nginx.conf 内容用于诊断

NGINX_CONF="/etc/nginx/nginx.conf"

echo "=========================================="
echo "  nginx.conf 内容查看"
echo "=========================================="
echo ""

echo "[完整文件内容]"
echo "---"
sudo cat "$NGINX_CONF"
echo "---"
echo ""

echo "[第 30-45 行（错误位置附近）]"
echo "---"
sudo sed -n '30,45p' "$NGINX_CONF" | cat -n
echo "---"
echo ""

echo "[括号统计]"
OPEN=$(sudo grep -o '{' "$NGINX_CONF" | wc -l)
CLOSE=$(sudo grep -o '}' "$NGINX_CONF" | wc -l)
echo "  开放括号: $OPEN"
echo "  闭合括号: $CLOSE"
if [ "$OPEN" -ne "$CLOSE" ]; then
    echo "  ⚠️  不匹配！差异: $((OPEN - CLOSE))"
else
    echo "  ✓ 匹配"
fi
echo ""

echo "[查找所有 server 块]"
sudo grep -n "server {" "$NGINX_CONF" || echo "  未找到 server {"
echo ""

echo "[查找所有 location 块]"
sudo grep -n "location" "$NGINX_CONF" | head -10
echo ""

