#!/bin/bash
# 配置验证脚本

echo "=== 端口配置验证 ==="
echo ""

echo "1. Docker Compose 端口映射:"
grep -A2 "backend:" docker-compose.yml | grep "ports:" -A1 | grep -o '"[0-9]*:[0-9]*"'

echo ""
echo "2. Backend 默认端口 (server.js):"
grep "const PORT" backend/src/server.js

echo ""
echo "3. Backend Dockerfile EXPOSE:"
grep "EXPOSE" backend/Dockerfile

echo ""
echo "4. Nginx 代理配置:"
grep "proxy_pass.*backend" frontend/nginx.conf

echo ""
echo "=== 配置一致性检查 ==="
BACKEND_PORT=$(grep "const PORT" backend/src/server.js | grep -o '[0-9]*' | head -1)
DOCKERFILE_PORT=$(grep "EXPOSE" backend/Dockerfile | grep -o '[0-9]*')
NGINX_PORT=$(grep "proxy_pass.*backend" frontend/nginx.conf | grep -o '[0-9]*')

if [ "$BACKEND_PORT" = "$DOCKERFILE_PORT" ] && [ "$BACKEND_PORT" = "$NGINX_PORT" ]; then
    echo "✅ 所有配置一致: 端口 $BACKEND_PORT"
else
    echo "❌ 配置不一致:"
    echo "   Backend: $BACKEND_PORT"
    echo "   Dockerfile: $DOCKERFILE_PORT"
    echo "   Nginx: $NGINX_PORT"
fi
