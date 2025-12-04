#!/bin/bash

# 添加 GORK_API_KEY 配置脚本

echo "=========================================="
echo "  配置 GORK_API_KEY"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "使用方法:"
    echo "  ./add_gork_api_key.sh <你的GORK_API_KEY>"
    echo ""
    echo "或者手动配置："
    echo "  1. ssh root@139.162.62.115"
    echo "  2. 编辑 /root/ai-host/backend/.env"
    echo "  3. 添加: GORK_API_KEY=你的API密钥"
    echo "  4. 运行: cd /root/ai-host && docker compose restart backend"
    echo ""
    exit 1
fi

GORK_API_KEY="$1"

echo "正在配置 GORK_API_KEY..."
echo ""

ssh root@139.162.62.115 "bash -s" <<EOF
    cd /root/ai-host/backend
    
    # 删除旧的 GORK_API_KEY 配置（如果存在）
    sed -i '/^GORK_API_KEY=/d' .env
    sed -i '/^#.*Gork API/d' .env
    sed -i '/^#.*GORK/d' .env
    
    # 添加新的配置
    cat >> .env << 'GORK_EOF'

# Gork API (for Grok models, using xAI API)
GORK_API_KEY=${GORK_API_KEY}
GORK_API_URL=https://api.x.ai/v1/chat/completions
GORK_EOF
    
    echo "✅ GORK_API_KEY 已添加到 .env 文件"
    echo ""
    echo "当前 GORK 配置:"
    grep "^GORK_" .env
    echo ""
    
    # 重启后端容器
    echo "正在重启后端容器..."
    cd /root/ai-host
    docker compose stop backend
    docker compose rm -f backend
    docker compose up -d backend
    
    echo "等待后端启动..."
    sleep 8
    
    # 验证配置
    echo ""
    echo "验证环境变量:"
    docker exec ai-host-backend node -e "console.log('GORK_API_KEY:', process.env.GORK_API_KEY ? 'SET (' + process.env.GORK_API_KEY.substring(0, 10) + '...)' : 'NOT SET');" 2>/dev/null || echo "后端还在启动中，请稍等..."
    
    echo ""
    echo "✅ 完成！"
EOF

echo ""
echo "=========================================="

