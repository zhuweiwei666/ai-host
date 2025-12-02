#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   最终修复端口问题"
echo "============================================="

# 1. 同步 docker-compose.yml 到服务器
echo "[1/3] 同步 docker-compose.yml 到服务器..."
scp docker-compose.yml "$REMOTE_HOST:$REMOTE_DIR/"

# 2. 在服务器上执行修复
ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    
    cd "$REMOTE_DIR"
    
    echo "[2/3] 确保 backend/.env 中 PORT=8000..."
    if [ -f backend/.env ]; then
        sed -i 's/^PORT=.*/PORT=8000/' backend/.env
        if ! grep -q "^PORT=" backend/.env; then
            echo "PORT=8000" >> backend/.env
        fi
        echo "✅ backend/.env 已更新"
        echo "   当前 PORT: \$(grep '^PORT=' backend/.env)"
    fi
    
    echo ""
    echo "[3/3] 重新启动后端容器（使用新的 volume 挂载）..."
    docker compose up -d backend
    
    echo ""
    echo "等待服务启动（5秒）..."
    sleep 5
    
    echo ""
    echo "检查后端日志..."
    docker compose logs backend --tail=10 | grep -E "(Server running|PORT|port|Error)" || docker compose logs backend --tail=10
    
    echo ""
    echo "测试后端服务..."
    docker exec ai-host-backend curl -s http://localhost:8000/api/stats 2>&1 | head -3 || echo "   服务可能还在启动中，请稍后检查"
EOF

echo ""
echo "============================================="
echo "   修复完成！"
echo "============================================="
echo "请刷新浏览器页面测试：http://139.162.62.115"

