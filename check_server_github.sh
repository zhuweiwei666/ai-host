#!/bin/bash

REMOTE_HOST="root@139.162.62.115"

echo "============================================="
echo "   检查服务器 GitHub SSH 配置"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    echo "1. 检查 SSH 密钥文件："
    ls -la ~/.ssh/id_* 2>/dev/null || echo "   ⚠️  未找到 SSH 密钥文件"
    echo ""
    
    echo "2. 检查 GitHub 连接："
    ssh -T git@github.com 2>&1
    echo ""
    
    echo "3. 检查 known_hosts："
    if [ -f ~/.ssh/known_hosts ]; then
        grep -q github.com ~/.ssh/known_hosts && echo "   ✅ GitHub 已在 known_hosts 中" || echo "   ⚠️  GitHub 不在 known_hosts 中"
    else
        echo "   ⚠️  known_hosts 文件不存在"
    fi
    echo ""
    
    echo "4. 显示 SSH 公钥（如果存在）："
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        echo "   ed25519 公钥："
        cat ~/.ssh/id_ed25519.pub
    elif [ -f ~/.ssh/id_rsa.pub ]; then
        echo "   rsa 公钥："
        cat ~/.ssh/id_rsa.pub
    else
        echo "   ⚠️  未找到公钥文件"
    fi
EOF

