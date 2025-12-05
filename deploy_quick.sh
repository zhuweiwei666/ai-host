#!/bin/bash
# 快速部署脚本 - 自动提交并部署到服务器

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 开始部署...${NC}"

# 1. Git 提交
if [[ -n $(git status -s) ]]; then
    echo -e "${GREEN}📝 提交代码变更...${NC}"
    git add -A
    
    # 获取提交信息（如果没有参数则使用默认）
    COMMIT_MSG="${1:-update: 自动部署}"
    git commit -m "$COMMIT_MSG"
    git push origin main
else
    echo -e "${YELLOW}⚠️  没有代码变更，跳过提交${NC}"
fi

# 2. 部署到服务器
echo -e "${GREEN}🔄 部署到服务器...${NC}"
ssh root@139.162.62.115 "cd /root/ai-host && git pull && docker compose up -d --build"

# 3. 等待服务启动
echo -e "${GREEN}⏳ 等待服务启动...${NC}"
sleep 5

# 4. 检查服务状态
echo -e "${GREEN}✅ 检查服务状态...${NC}"
ssh root@139.162.62.115 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo -e "${GREEN}🎉 部署完成！${NC}"
