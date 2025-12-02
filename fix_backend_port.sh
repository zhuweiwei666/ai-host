#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   修复后端端口配置"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    
    cd "$REMOTE_DIR"
    
    echo "1. 检查当前 backend/.env 中的 PORT 配置："
    echo "----------------------------------------"
    grep -E "^PORT=" backend/.env || echo "   未找到 PORT 配置"
    echo ""
    
    echo "2. 修改 PORT 为 8000..."
    if [ -f backend/.env ]; then
        # 如果存在 PORT=4000，替换为 PORT=8000
        sed -i 's/^PORT=4000$/PORT=8000/' backend/.env
        # 如果不存在 PORT，添加 PORT=8000
        if ! grep -q "^PORT=" backend/.env; then
            echo "PORT=8000" >> backend/.env
        fi
        echo "✅ backend/.env 已更新"
        echo ""
        echo "   当前 PORT 配置："
        grep -E "^PORT=" backend/.env
    else
        echo "❌ backend/.env 文件不存在"
        exit 1
    fi
    
    echo ""
    echo "3. 重启后端容器..."
    docker compose restart backend
    
    echo ""
    echo "4. 等待服务启动（5秒）..."
    sleep 5
    
    echo ""
    echo "5. 检查后端日志（最后10行）..."
    docker compose logs backend --tail=10
    
    echo ""
    echo "6. 测试后端服务..."
    docker exec ai-host-backend curl -s http://localhost:8000/api/stats 2>&1 | head -3 || echo "   服务可能还在启动中"
EOF

