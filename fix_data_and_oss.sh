#!/bin/bash

REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"

echo "============================================="
echo "   修复数据问题和 OSS 配置"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    set -e
    
    cd /root/ai-host
    
    echo "1. 检查 OSS 配置..."
    echo "----------------------------------------"
    if [ -f backend/.env ]; then
        echo "OSS 相关配置："
        grep -E "^OSS_" backend/.env || echo "   ⚠️  未找到 OSS 配置"
    else
        echo "   ❌ backend/.env 文件不存在"
    fi
    echo ""
    
    echo "2. 检查是否需要从 MongoDB Atlas 迁移数据..."
    echo "----------------------------------------"
    echo "   如果您之前使用的是 MongoDB Atlas，需要："
    echo "   1. 从 Atlas 导出数据"
    echo "   2. 导入到本地 mongo 容器"
    echo ""
    echo "   或者，我们可以先初始化一些示例数据..."
    echo ""
    
    echo ""
    echo "3. 运行 seedAgents.js 初始化示例数据..."
    docker exec ai-host-backend node src/services/seedAgents.js 2>&1 || echo "   ⚠️  初始化失败，可能数据已存在"
    
    echo ""
    echo "4. 验证数据是否创建成功..."
    COUNT=$(docker exec ai-host-mongo mongosh --quiet --eval "
        use ai-host;
        db.agents.countDocuments();
    " 2>/dev/null || docker exec ai-host-mongo mongo --quiet --eval "
        use ai-host;
        db.agents.count();
    " 2>/dev/null | tr -d ' \n' || echo "0")
    
    if [ "$COUNT" != "0" ] && [ -n "$COUNT" ]; then
        echo "   ✅ 数据库中有 $COUNT 个 Agent"
    else
        echo "   ⚠️  数据库中暂无数据"
    fi
    
    echo ""
    echo "5. 测试 API 是否返回数据..."
    API_RESPONSE=$(curl -s http://localhost:8000/api/agents 2>&1)
    if echo "$API_RESPONSE" | grep -q "\[" && [ "$API_RESPONSE" != "[]" ]; then
        echo "   ✅ API 返回了数据"
        echo "$API_RESPONSE" | head -5
    elif [ "$API_RESPONSE" = "[]" ]; then
        echo "   ⚠️  API 返回空数组（数据库为空）"
    else
        echo "   ❌ API 请求失败"
        echo "$API_RESPONSE" | head -3
    fi
    
    echo ""
    echo "6. OSS 配置检查..."
    echo "----------------------------------------"
    if grep -q "^OSS_ACCESS_KEY_ID=" backend/.env 2>/dev/null; then
        echo "✅ OSS 配置已存在"
        echo ""
        echo "如果图片无法加载，请检查："
        echo "1. OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET 是否正确"
        echo "2. OSS_BUCKET、OSS_REGION、OSS_ENDPOINT 是否正确"
        echo "3. OSS bucket 的 CORS 配置是否正确"
    else
        echo "⚠️  OSS 配置缺失"
        echo ""
        echo "请添加以下配置到 backend/.env："
        echo "OSS_ACCESS_KEY_ID=your-access-key-id"
        echo "OSS_ACCESS_KEY_SECRET=your-access-key-secret"
        echo "OSS_BUCKET=your-bucket-name"
        echo "OSS_REGION=oss-ap-southeast-1"
        echo "OSS_ENDPOINT=oss-ap-southeast-1.aliyuncs.com"
        echo "OSS_BASE_PATH=uploads"
    fi
EOF

