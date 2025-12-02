#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   检查数据库数据和 OSS 配置"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    set -e
    
    cd /root/ai-host
    
    echo "1. 检查后端容器中的 OSS 配置..."
    echo "----------------------------------------"
    docker exec ai-host-backend sh -c 'cat /app/.env 2>/dev/null | grep -i "OSS\|ALI\|ACCESS" | head -10 || echo "   未找到 OSS 相关配置"'
    echo ""
    
    echo "2. 检查数据库中是否有 Agent 数据..."
    echo "----------------------------------------"
    docker exec ai-host-mongo mongosh --quiet --eval "
        use ai-host;
        db.agents.countDocuments();
    " 2>/dev/null || docker exec ai-host-mongo mongo --quiet --eval "
        use ai-host;
        db.agents.count();
    " 2>/dev/null || echo "   无法连接数据库或查询失败"
    echo ""
    
    echo "3. 查看前几个 Agent 记录（如果有）..."
    echo "----------------------------------------"
    docker exec ai-host-mongo mongosh --quiet --eval "
        use ai-host;
        db.agents.find({}, {name: 1, style: 1, avatar: 1, _id: 0}).limit(3).toArray();
    " 2>/dev/null || docker exec ai-host-mongo mongo --quiet --eval "
        use ai-host;
        db.agents.find({}, {name: 1, style: 1, avatar: 1}).limit(3);
    " 2>/dev/null || echo "   无法查询数据"
    echo ""
    
    echo "4. 测试 API 是否能返回数据..."
    echo "----------------------------------------"
    echo "测试 /api/agents 接口："
    curl -s http://localhost:8000/api/agents 2>&1 | head -20
    echo ""
    
    echo "5. 检查后端日志中的 OSS 相关错误..."
    echo "----------------------------------------"
    docker compose logs backend --tail=50 | grep -i "oss\|ali\|upload\|error" | tail -10 || echo "   未找到相关日志"
EOF

