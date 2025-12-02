#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   同步 MongoDB Atlas 配置到服务器"
echo "============================================="

# 1. 从本地读取 MONGO_URI
if [ -f backend/.env ]; then
    MONGO_URI=$(grep "^MONGO_URI=" backend/.env | cut -d'=' -f2-)
    if [ -z "$MONGO_URI" ]; then
        echo "❌ 错误：本地 backend/.env 中未找到 MONGO_URI"
        exit 1
    fi
    echo "✅ 找到本地 Atlas 配置"
else
    echo "❌ 错误：本地 backend/.env 文件不存在"
    exit 1
fi

# 2. 同步到服务器
echo ""
echo "[1/3] 同步 backend/.env 到服务器..."
scp backend/.env "$REMOTE_HOST:$REMOTE_DIR/backend/.env"

# 3. 在服务器上重启服务
echo ""
echo "[2/3] 重启后端容器以应用 Atlas 配置..."
ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    cd "$REMOTE_DIR"
    
    echo "   验证配置..."
    grep "^MONGO_URI=" backend/.env | head -1 | sed 's/\(mongodb\+srv:\/\/\)[^@]*@/\1***:***@/'
    
    echo ""
    echo "   重启后端容器..."
    docker compose restart backend
    
    echo ""
    echo "   等待服务启动（5秒）..."
    sleep 5
EOF

# 4. 检查连接状态
echo ""
echo "[3/3] 检查 Atlas 连接状态..."
ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    cd /root/ai-host
    
    echo "   后端连接日志："
    docker compose logs backend --tail=15 | grep -E "(MongoDB|Connected|Atlas|Error|error)" || docker compose logs backend --tail=15
    
    echo ""
    echo "   测试 API..."
    curl -s http://localhost:8000/api/agents 2>&1 | head -3
EOF

echo ""
echo "============================================="
echo "   配置同步完成！"
echo "============================================="
echo ""
echo "⚠️  重要提示："
echo "   如果连接失败，请确保服务器 IP (139.162.62.115) 已添加到"
echo "   MongoDB Atlas 的 IP 白名单中："
echo "   https://cloud.mongodb.com/v2#/security/network/whitelist"
echo ""

