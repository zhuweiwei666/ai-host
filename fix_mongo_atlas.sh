#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   修复 MongoDB Atlas 连接"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    set -e
    
    cd /root/ai-host
    
    echo "1. 检查当前 backend/.env 中的 MONGO_URI..."
    echo "----------------------------------------"
    if [ -f backend/.env ]; then
        MONGO_URI=$(grep "^MONGO_URI=" backend/.env | cut -d'=' -f2-)
        if [ -n "$MONGO_URI" ]; then
            echo "   当前 MONGO_URI: ${MONGO_URI:0:50}..."
            if echo "$MONGO_URI" | grep -q "mongodb://mongo"; then
                echo "   ⚠️  当前指向本地 mongo 容器，需要改回 Atlas"
            elif echo "$MONGO_URI" | grep -q "mongodb+srv"; then
                echo "   ✅ 已配置为 MongoDB Atlas"
            fi
        else
            echo "   ❌ 未找到 MONGO_URI 配置"
        fi
    else
        echo "   ❌ backend/.env 文件不存在"
    fi
    echo ""
    
    echo "2. 检查本地 .env 文件中的配置..."
    echo "----------------------------------------"
    if [ -f backend/env.example ] || [ -f backend/.env.sample ]; then
        echo "   找到示例文件，但我们需要使用您配置好的 .env"
    fi
    echo ""
    
    echo "3. 如果 MONGO_URI 指向本地，需要手动修改..."
    echo "----------------------------------------"
    echo "   请确保 backend/.env 中的 MONGO_URI 指向 MongoDB Atlas"
    echo "   格式应该是：mongodb+srv://username:password@cluster.mongodb.net/..."
    echo ""
    
    echo "4. 重启后端容器以应用配置..."
    docker compose restart backend
    
    echo ""
    echo "5. 等待服务启动（5秒）..."
    sleep 5
    
    echo ""
    echo "6. 检查后端连接日志..."
    docker compose logs backend --tail=20 | grep -E "(MongoDB|Connected|Error|error|Atlas)" || docker compose logs backend --tail=20
    
    echo ""
    echo "7. 测试 API 是否返回数据..."
    API_RESPONSE=$(curl -s http://localhost:8000/api/agents 2>&1)
    if echo "$API_RESPONSE" | grep -q "\[" && [ "$API_RESPONSE" != "[]" ]; then
        echo "   ✅ API 返回了数据"
        echo "$API_RESPONSE" | head -3
    elif [ "$API_RESPONSE" = "[]" ]; then
        echo "   ⚠️  API 返回空数组（数据库可能为空或连接失败）"
    else
        echo "   ❌ API 请求失败"
        echo "$API_RESPONSE" | head -3
    fi
EOF

