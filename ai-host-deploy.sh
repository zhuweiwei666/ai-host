#!/bin/bash

# Configuration
REMOTE_HOST="root@139.162.62.115"
REMOTE_DIR="/root/ai-host"
GIT_BRANCH="main" # 您的GitHub主分支名称，通常是main或master

echo "============================================="
echo "   AI Host 一键部署脚本 (GitHub → 服务器)    "
echo "============================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在 Git 仓库中
if [ ! -d .git ]; then
    echo -e "${RED}❌ 错误：当前目录不是 Git 仓库${NC}"
    exit 1
fi

# 1. 检查本地是否有未提交的更改
echo -e "${YELLOW}[1/6] 检查本地代码状态...${NC}"
git status --short

# 询问是否要提交更改
read -p "是否要将本地更改提交并推送到 GitHub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}[2/6] 提交并推送代码到 GitHub...${NC}"
    
    # 添加所有更改
    git add .
    
    # 获取提交信息
    read -p "请输入提交信息 (直接回车使用默认信息): " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="Auto deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    # 提交
    git commit -m "$commit_msg"
    
    # 推送到 GitHub
    echo "正在推送到 GitHub..."
    git push origin "$GIT_BRANCH"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 错误：推送到 GitHub 失败${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 代码已推送到 GitHub${NC}"
else
    echo -e "${YELLOW}⚠️  跳过提交，直接部署服务器上的最新代码${NC}"
fi

# 2. 同步本地文件到服务器（确保 .env 等配置文件也被同步）
echo -e "${YELLOW}[3/6] 同步本地文件到服务器（包括配置文件）...${NC}"
rsync -avz \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'frontend/dist' \
    --exclude 'frontend/node_modules' \
    --exclude 'backend/node_modules' \
    --exclude 'backend/uploads' \
    --exclude 'ai-wallet-backend/node_modules' \
    --exclude '.DS_Store' \
    ./ "$REMOTE_HOST:$REMOTE_DIR"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 错误：文件同步失败，请检查 SSH 连接${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 文件同步完成${NC}"

# 3. 在服务器上执行部署操作
echo -e "${YELLOW}[4/6] 在服务器上拉取最新代码并重新构建...${NC}"

ssh "$REMOTE_HOST" "bash -s" <<EOF
    set -e
    
    echo "📁 进入项目目录: $REMOTE_DIR"
    cd "$REMOTE_DIR"
    
    echo "📥 从 GitHub 拉取最新代码..."
    git fetch origin
    git reset --hard origin/"$GIT_BRANCH"
    git pull origin "$GIT_BRANCH" || echo "⚠️  Git pull 有冲突或警告，继续执行..."
    
    echo "🛑 停止现有容器..."
    docker compose down --remove-orphans || true
    
    echo "🔨 重新构建并启动所有服务..."
    docker compose up -d --build
    
    echo "🧹 清理未使用的 Docker 镜像..."
    docker image prune -f
    
    echo ""
    echo "📊 服务状态："
    docker compose ps
    
    echo ""
    echo "📋 最近的后端日志（最后20行）："
    docker compose logs backend --tail=20
    
    echo ""
    echo "📋 最近的 AI Wallet 日志（最后20行）："
    docker compose logs aiwallet --tail=20
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 错误：服务器部署操作失败${NC}"
    exit 1
fi

# 4. 等待服务启动
echo -e "${YELLOW}[5/6] 等待服务启动（10秒）...${NC}"
sleep 10

# 5. 检查服务健康状态
echo -e "${YELLOW}[6/6] 检查服务健康状态...${NC}"

ssh "$REMOTE_HOST" "bash -s" <<EOF
    cd "$REMOTE_DIR"
    
    echo "🔍 检查容器状态..."
    docker compose ps
    
    echo ""
    echo "🔍 检查后端服务是否响应..."
    if curl -f -s http://localhost:8000/api/stats > /dev/null 2>&1; then
        echo "✅ 后端服务正常"
    else
        echo "⚠️  后端服务可能还在启动中，请稍后检查"
    fi
    
    echo ""
    echo "🔍 检查前端服务是否响应..."
    if curl -f -s http://localhost:80 > /dev/null 2>&1; then
        echo "✅ 前端服务正常"
    else
        echo "⚠️  前端服务可能还在启动中，请稍后检查"
    fi
EOF

echo ""
echo "============================================="
echo -e "${GREEN}   ✅ 部署完成！${NC}"
echo "============================================="
echo ""
echo "🌐 访问地址: http://139.162.62.115"
echo ""
echo "📝 查看完整日志:"
echo "   ssh $REMOTE_HOST 'cd $REMOTE_DIR && docker compose logs -f'"
echo ""
echo "📊 查看服务状态:"
echo "   ssh $REMOTE_HOST 'cd $REMOTE_DIR && docker compose ps'"
echo ""
