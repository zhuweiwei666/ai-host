#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   创建 backend/.env 文件"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    set -e
    
    cd /root/ai-host
    
    echo "1. 检查是否有示例文件..."
    if [ -f backend/.env.sample ]; then
        echo "✅ 找到 .env.sample，基于它创建 .env"
        cp backend/.env.sample backend/.env
    elif [ -f backend/env.example ]; then
        echo "✅ 找到 env.example，基于它创建 .env"
        cp backend/env.example backend/.env
    else
        echo "⚠️  未找到示例文件，创建新的 .env"
        touch backend/.env
    fi
    
    echo ""
    echo "2. 确保 PORT=8000..."
    # 删除旧的 PORT 配置（如果有）
    sed -i '/^PORT=/d' backend/.env
    # 添加 PORT=8000
    echo "PORT=8000" >> backend/.env
    
    echo ""
    echo "3. 检查 MONGO_URI 配置..."
    if ! grep -q "^MONGO_URI=" backend/.env; then
        echo "⚠️  未找到 MONGO_URI，添加默认配置（使用本地 mongo 容器）"
        echo "MONGO_URI=mongodb://mongo:27017/ai-host" >> backend/.env
    else
        echo "✅ MONGO_URI 已存在"
        # 如果 MONGO_URI 指向 localhost，改为 mongo（Docker 服务名）
        sed -i 's|mongodb://localhost|mongodb://mongo|g' backend/.env
        sed -i 's|mongodb://127.0.0.1|mongodb://mongo|g' backend/.env
    fi
    
    echo ""
    echo "4. 显示 .env 文件内容（隐藏敏感信息）："
    echo "----------------------------------------"
    cat backend/.env | sed 's/\(.*=\)\(.*\)/\1***/' | head -10
    
    echo ""
    echo "5. 重启后端容器..."
    cd /root/ai-host
    docker compose restart backend
    
    echo ""
    echo "6. 等待服务启动（5秒）..."
    sleep 5
    
    echo ""
    echo "7. 检查后端日志（最后15行）..."
    docker compose logs backend --tail=15 | grep -E "(Server running|PORT|MongoDB|Error|error)" || docker compose logs backend --tail=15
EOF

