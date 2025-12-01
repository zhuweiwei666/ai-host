#!/bin/bash

# Nginx 500 错误详细诊断脚本
# 在服务器上以 root 或 sudo 权限运行

echo "=========================================="
echo "  Nginx 500 错误详细诊断"
echo "=========================================="
echo ""

# 1. 检查 Nginx 状态
echo "[1/10] 检查 Nginx 服务状态..."
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx 正在运行"
else
    echo "✗ Nginx 未运行"
    echo "  尝试启动: sudo systemctl start nginx"
fi
echo ""

# 2. 检查 Nginx 配置语法
echo "[2/10] 检查 Nginx 配置语法..."
if sudo nginx -t 2>&1; then
    echo "✓ 配置语法正确"
else
    echo "✗ 配置语法有错误（见上方输出）"
fi
echo ""

# 3. 检查前端目录是否存在
echo "[3/10] 检查前端目录..."
FRONTEND_DIR="/var/www/ai-host/frontend/dist"
if [ -d "$FRONTEND_DIR" ]; then
    echo "✓ 目录存在: $FRONTEND_DIR"
    echo "  目录内容:"
    ls -la "$FRONTEND_DIR" | head -10
else
    echo "✗ 目录不存在: $FRONTEND_DIR"
    echo "  需要创建: sudo mkdir -p $FRONTEND_DIR"
fi
echo ""

# 4. 检查 index.html
echo "[4/10] 检查 index.html..."
if [ -f "$FRONTEND_DIR/index.html" ]; then
    echo "✓ index.html 存在"
    echo "  文件大小: $(du -h "$FRONTEND_DIR/index.html" | cut -f1)"
    echo "  文件权限: $(ls -l "$FRONTEND_DIR/index.html" | awk '{print $1, $3, $4}')"
    echo "  前几行内容:"
    head -5 "$FRONTEND_DIR/index.html"
else
    echo "✗ index.html 不存在"
    echo "  这是导致 500 错误的主要原因！"
    echo "  需要部署前端文件到: $FRONTEND_DIR"
fi
echo ""

# 5. 检查文件权限
echo "[5/10] 检查文件权限..."
if [ -d "$FRONTEND_DIR" ]; then
    DIR_PERM=$(stat -c "%a %U:%G" "$FRONTEND_DIR")
    echo "  目录权限: $DIR_PERM"
    
    # 检查 Nginx 用户
    NGINX_USER=$(ps aux | grep '[n]ginx' | head -1 | awk '{print $1}')
    echo "  Nginx 运行用户: $NGINX_USER"
    
    # 检查是否可以读取
    if sudo -u "$NGINX_USER" test -r "$FRONTEND_DIR/index.html" 2>/dev/null; then
        echo "✓ Nginx 用户可以读取文件"
    else
        echo "✗ Nginx 用户无法读取文件"
        echo "  需要修复权限: sudo chown -R www-data:www-data $FRONTEND_DIR"
    fi
fi
echo ""

# 6. 检查 Nginx 配置中的路径
echo "[6/10] 检查 Nginx 配置中的路径..."
NGINX_CONFIG="/etc/nginx/sites-available/ai-host"
if [ -f "$NGINX_CONFIG" ]; then
    echo "✓ 配置文件存在: $NGINX_CONFIG"
    echo "  配置中的 root 路径:"
    grep -E "^\s*root\s+" "$NGINX_CONFIG" || echo "  未找到 root 配置"
    echo "  配置中的 index:"
    grep -E "^\s*index\s+" "$NGINX_CONFIG" || echo "  未找到 index 配置"
else
    echo "✗ 配置文件不存在: $NGINX_CONFIG"
    echo "  需要创建配置文件"
fi
echo ""

# 7. 检查启用的站点
echo "[7/10] 检查启用的站点..."
echo "  启用的站点:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "  sites-enabled 目录不存在"
echo ""

# 8. 检查 Nginx 错误日志
echo "[8/10] 检查 Nginx 错误日志（最后 30 行）..."
if [ -f "/var/log/nginx/error.log" ]; then
    echo "  标准错误日志:"
    sudo tail -30 /var/log/nginx/error.log | grep -v "^$" | tail -10
fi
if [ -f "/var/log/nginx/ai-host-error.log" ]; then
    echo "  自定义错误日志:"
    sudo tail -30 /var/log/nginx/ai-host-error.log | grep -v "^$" | tail -10
fi
echo ""

# 9. 检查 SELinux（如果适用）
echo "[9/10] 检查 SELinux..."
if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce 2>/dev/null)
    echo "  SELinux 状态: $SELINUX_STATUS"
    if [ "$SELINUX_STATUS" = "Enforcing" ]; then
        echo "  ⚠️  SELinux 已启用，可能需要设置上下文"
        echo "  运行: sudo chcon -R -t httpd_sys_content_t $FRONTEND_DIR"
    fi
else
    echo "  SELinux 未安装或未启用"
fi
echo ""

# 10. 测试文件访问
echo "[10/10] 测试文件访问..."
if [ -f "$FRONTEND_DIR/index.html" ]; then
    echo "  尝试读取文件..."
    if sudo -u www-data cat "$FRONTEND_DIR/index.html" > /dev/null 2>&1; then
        echo "✓ www-data 用户可以读取文件"
    else
        echo "✗ www-data 用户无法读取文件"
        echo "  错误信息:"
        sudo -u www-data cat "$FRONTEND_DIR/index.html" 2>&1 | head -3
    fi
else
    echo "  跳过（文件不存在）"
fi
echo ""

# 总结
echo "=========================================="
echo "  诊断总结"
echo "=========================================="
echo ""

if [ ! -f "$FRONTEND_DIR/index.html" ]; then
    echo "🔴 主要问题: index.html 文件不存在"
    echo ""
    echo "解决方案:"
    echo "1. 在本地构建前端:"
    echo "   cd frontend && npm run build"
    echo ""
    echo "2. 上传到服务器:"
    echo "   scp -r dist/* user@47.245.121.93:$FRONTEND_DIR/"
    echo ""
    echo "3. 或者直接在服务器上构建:"
    echo "   cd /path/to/ai-host/frontend"
    echo "   npm run build"
    echo "   sudo cp -r dist/* $FRONTEND_DIR/"
    echo ""
elif [ ! -d "$FRONTEND_DIR" ]; then
    echo "🔴 主要问题: 目录不存在"
    echo ""
    echo "解决方案:"
    echo "   sudo mkdir -p $FRONTEND_DIR"
    echo "   sudo chown -R www-data:www-data /var/www/ai-host/frontend"
    echo "   然后部署前端文件"
    echo ""
else
    echo "✅ 基本检查通过，但仍有 500 错误"
    echo ""
    echo "请检查:"
    echo "1. Nginx 错误日志（见上方输出）"
    echo "2. 文件权限是否正确"
    echo "3. SELinux 是否阻止访问"
    echo ""
fi

echo "查看实时错误日志:"
echo "  sudo tail -f /var/log/nginx/error.log"
echo ""

