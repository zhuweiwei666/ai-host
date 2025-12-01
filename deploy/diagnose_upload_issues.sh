#!/bin/bash

# 上传问题诊断脚本

echo "=========================================="
echo "  上传问题诊断"
echo "=========================================="
echo ""

# 1. 检查后端服务状态
echo "[1/8] 检查后端服务状态..."
if pm2 list | grep -q "ai-host-backend\|ai-backend"; then
    echo "✓ 后端服务正在运行"
    pm2 list | grep -E "ai-host-backend|ai-backend"
else
    echo "✗ 后端服务未运行"
    echo "  启动命令: cd /var/www/ai-host/backend && pm2 start src/server.js --name ai-host-backend"
fi
echo ""

# 2. 检查后端端口
echo "[2/8] 检查后端端口..."
if netstat -tlnp 2>/dev/null | grep -q ":4000" || ss -tlnp 2>/dev/null | grep -q ":4000"; then
    echo "✓ 端口 4000 正在监听"
    netstat -tlnp 2>/dev/null | grep ":4000" || ss -tlnp 2>/dev/null | grep ":4000"
else
    echo "✗ 端口 4000 未监听"
fi
echo ""

# 3. 测试 OSS STS 端点
echo "[3/8] 测试 OSS STS 端点..."
STS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/oss/sts 2>/dev/null || echo "000")
if [ "$STS_RESPONSE" = "200" ]; then
    echo "✓ /api/oss/sts 返回 200"
elif [ "$STS_RESPONSE" = "401" ]; then
    echo "⚠️  /api/oss/sts 返回 401 (需要认证)"
    echo "  这是正常的，需要 JWT token"
elif [ "$STS_RESPONSE" = "404" ]; then
    echo "✗ /api/oss/sts 返回 404 (路由不存在)"
    echo "  问题：OSS 路由未正确挂载"
elif [ "$STS_RESPONSE" = "000" ]; then
    echo "✗ 无法连接到后端服务"
else
    echo "⚠️  /api/oss/sts 返回 $STS_RESPONSE"
fi
echo ""

# 4. 检查后端路由配置
echo "[4/8] 检查后端路由配置..."
BACKEND_SERVER="/var/www/ai-host/backend/src/server.js"
if [ -f "$BACKEND_SERVER" ]; then
    if grep -q "/api/oss" "$BACKEND_SERVER"; then
        echo "✓ server.js 中包含 /api/oss 路由"
        echo "  相关行:"
        grep -n "/api/oss" "$BACKEND_SERVER" | head -3
    else
        echo "✗ server.js 中未找到 /api/oss 路由"
        echo "  需要添加: app.use('/api/oss', require('./routes/oss'));"
    fi
else
    echo "⚠️  找不到 server.js: $BACKEND_SERVER"
fi
echo ""

# 5. 检查 OSS 路由文件
echo "[5/8] 检查 OSS 路由文件..."
OSS_ROUTE="/var/www/ai-host/backend/src/routes/oss.js"
if [ -f "$OSS_ROUTE" ]; then
    echo "✓ OSS 路由文件存在"
    if grep -q "router.get.*sts" "$OSS_ROUTE"; then
        echo "✓ STS 端点已定义"
    else
        echo "✗ STS 端点未定义"
    fi
else
    echo "✗ OSS 路由文件不存在: $OSS_ROUTE"
fi
echo ""

# 6. 检查环境变量
echo "[6/8] 检查 OSS 环境变量..."
ENV_FILE="/var/www/ai-host/backend/.env.production.local"
if [ -f "$ENV_FILE" ]; then
    echo "✓ 环境变量文件存在: $ENV_FILE"
    
    if grep -q "OSS_ACCESS_KEY_ID" "$ENV_FILE"; then
        KEY_ID=$(grep "OSS_ACCESS_KEY_ID" "$ENV_FILE" | cut -d'=' -f2)
        if [ -n "$KEY_ID" ] && [ "$KEY_ID" != "" ]; then
            echo "✓ OSS_ACCESS_KEY_ID 已配置"
        else
            echo "✗ OSS_ACCESS_KEY_ID 为空"
        fi
    else
        echo "✗ OSS_ACCESS_KEY_ID 未配置"
    fi
    
    if grep -q "OSS_ACCESS_KEY_SECRET" "$ENV_FILE"; then
        echo "✓ OSS_ACCESS_KEY_SECRET 已配置"
    else
        echo "✗ OSS_ACCESS_KEY_SECRET 未配置"
    fi
    
    if grep -q "OSS_BUCKET" "$ENV_FILE"; then
        BUCKET=$(grep "OSS_BUCKET" "$ENV_FILE" | cut -d'=' -f2)
        echo "✓ OSS_BUCKET 已配置: $BUCKET"
    else
        echo "✗ OSS_BUCKET 未配置"
    fi
else
    echo "⚠️  环境变量文件不存在: $ENV_FILE"
    echo "  检查: /var/www/ai-host/backend/.env"
fi
echo ""

# 7. 检查 ali-oss 依赖
echo "[7/8] 检查 ali-oss 依赖..."
if [ -f "/var/www/ai-host/backend/package.json" ]; then
    if grep -q "ali-oss" "/var/www/ai-host/backend/package.json"; then
        echo "✓ ali-oss 在 package.json 中"
        if [ -d "/var/www/ai-host/backend/node_modules/ali-oss" ]; then
            echo "✓ ali-oss 已安装"
        else
            echo "✗ ali-oss 未安装"
            echo "  运行: cd /var/www/ai-host/backend && npm install ali-oss"
        fi
    else
        echo "✗ ali-oss 不在 package.json 中"
    fi
else
    echo "⚠️  找不到 package.json"
fi
echo ""

# 8. 检查 Nginx 代理配置
echo "[8/8] 检查 Nginx 代理配置..."
NGINX_CONFIG="/etc/nginx/sites-available/ai-host"
if [ -f "$NGINX_CONFIG" ]; then
    if grep -q "location /api/" "$NGINX_CONFIG"; then
        echo "✓ Nginx 已配置 /api/ 代理"
        echo "  相关配置:"
        grep -A 5 "location /api/" "$NGINX_CONFIG" | head -6
    else
        echo "✗ Nginx 未配置 /api/ 代理"
    fi
else
    echo "⚠️  Nginx 站点配置不存在"
fi
echo ""

# 总结
echo "=========================================="
echo "  诊断总结"
echo "=========================================="
echo ""

# 检查关键问题
ISSUES=0

if ! pm2 list | grep -q "ai-host-backend\|ai-backend"; then
    echo "🔴 问题 1: 后端服务未运行"
    ISSUES=$((ISSUES + 1))
fi

if [ "$STS_RESPONSE" = "404" ]; then
    echo "🔴 问题 2: OSS STS 端点返回 404"
    echo "   可能原因:"
    echo "   - server.js 中未挂载 /api/oss 路由"
    echo "   - routes/oss.js 文件不存在或有问题"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f "$OSS_ROUTE" ]; then
    echo "🔴 问题 3: OSS 路由文件不存在"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f "$ENV_FILE" ] || ! grep -q "OSS_ACCESS_KEY_ID" "$ENV_FILE" 2>/dev/null; then
    echo "🔴 问题 4: OSS 环境变量未配置"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ 基本检查通过"
    echo ""
    echo "如果上传仍然失败，请："
    echo "1. 查看后端日志: pm2 logs ai-host-backend"
    echo "2. 查看 Nginx 错误日志: sudo tail -f /var/log/nginx/error.log"
    echo "3. 测试 STS 端点: curl -H 'Authorization: Bearer YOUR_TOKEN' http://127.0.0.1:4000/api/oss/sts"
else
    echo ""
    echo "发现 $ISSUES 个问题，请先修复这些问题"
fi
echo ""

echo "=========================================="
echo "  日志收集命令"
echo "=========================================="
echo ""
echo "运行以下命令收集日志信息："
echo ""
echo "# 1. 后端 PM2 日志（最近 100 行）"
echo "pm2 logs ai-host-backend --lines 100 --nostream"
echo ""
echo "# 2. Nginx 错误日志（最近 50 行）"
echo "sudo tail -50 /var/log/nginx/error.log"
echo ""
echo "# 3. Nginx 访问日志（最近 50 行，过滤 /api/oss）"
echo "sudo tail -50 /var/log/nginx/access.log | grep '/api/oss'"
echo ""
echo "# 4. 后端环境变量（隐藏敏感信息）"
echo "grep '^OSS_' /var/www/ai-host/backend/.env.production.local 2>/dev/null | sed 's/=.*/=***/'"
echo ""
echo "# 5. 测试 STS 端点（需要认证）"
echo "curl -v http://127.0.0.1:4000/api/oss/sts"
echo ""

