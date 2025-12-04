#!/bin/bash

# =============================================
# AI Host 一键部署脚本
# 用法: ./deploy.sh [frontend|backend|all]
# =============================================

set -e

cd /root/ai-host

echo "🚀 AI Host 部署脚本"
echo "===================="

# 拉取最新代码
echo ""
echo "📥 拉取最新代码..."
git pull origin main

# 部署参数
DEPLOY_TARGET=${1:-all}

deploy_frontend() {
    echo ""
    echo "🎨 部署前端..."
    docker stop ai-host-frontend 2>/dev/null || true
    docker rm ai-host-frontend 2>/dev/null || true
    docker build -t ai-host-frontend ./frontend
    docker run -d --name ai-host-frontend \
        -p 80:80 -p 443:443 \
        --network ai-host_default \
        --restart unless-stopped \
        ai-host-frontend
    echo "✅ 前端部署完成"
}

deploy_backend() {
    echo ""
    echo "⚙️  部署后端..."
    docker stop ai-host-backend 2>/dev/null || true
    docker rm ai-host-backend 2>/dev/null || true
    docker build -t ai-host-backend ./backend
    docker run -d --name ai-host-backend \
        --env-file /root/ai-host/backend/.env \
        -p 8000:4000 \
        --network ai-host_default \
        --restart unless-stopped \
        ai-host-backend
    echo "✅ 后端部署完成"
}

case $DEPLOY_TARGET in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    all)
        deploy_frontend
        deploy_backend
        ;;
    *)
        echo "❌ 未知参数: $DEPLOY_TARGET"
        echo "用法: ./deploy.sh [frontend|backend|all]"
        exit 1
        ;;
esac

echo ""
echo "🔍 检查容器状态..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ai-host

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 查看日志:"
echo "   docker logs -f ai-host-backend"
echo "   docker logs -f ai-host-frontend"

