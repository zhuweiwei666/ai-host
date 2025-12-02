#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   检查部署状态和诊断 502 错误"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    
    cd "$REMOTE_DIR"
    
    echo "1. 检查容器状态："
    echo "----------------------------------------"
    docker compose ps
    echo ""
    
    echo "2. 检查后端服务是否在监听端口："
    echo "----------------------------------------"
    docker exec ai-host-backend netstat -tlnp 2>/dev/null | grep -E ":(4000|8000)" || echo "   无法检查端口（可能 netstat 不可用）"
    echo ""
    
    echo "3. 检查后端容器内的进程："
    echo "----------------------------------------"
    docker exec ai-host-backend ps aux | head -10
    echo ""
    
    echo "4. 后端最近日志（最后30行）："
    echo "----------------------------------------"
    docker compose logs backend --tail=30
    echo ""
    
    echo "5. 前端 Nginx 日志（最后20行）："
    echo "----------------------------------------"
    docker compose logs frontend --tail=20
    echo ""
    
    echo "6. 测试后端服务是否响应："
    echo "----------------------------------------"
    echo "从容器内部测试："
    docker exec ai-host-backend curl -s http://localhost:8000/api/stats 2>&1 | head -5 || echo "   后端服务无响应"
    echo ""
    echo "从宿主机测试："
    curl -s http://localhost:8000/api/stats 2>&1 | head -5 || echo "   无法从宿主机访问后端"
    echo ""
    
    echo "7. 检查 Nginx 配置："
    echo "----------------------------------------"
    docker exec ai-host-frontend cat /etc/nginx/conf.d/default.conf 2>/dev/null | grep -A 5 "location /api/" || echo "   无法读取 Nginx 配置"
EOF

