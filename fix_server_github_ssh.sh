#!/bin/bash

REMOTE_HOST="root@139.162.62.115"

echo "============================================="
echo "   修复服务器 GitHub SSH 连接"
echo "============================================="

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    set -e
    
    echo "1. 添加 GitHub 到 known_hosts..."
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    
    # 添加 GitHub 的主机密钥到 known_hosts
    ssh-keyscan -t rsa,ecdsa,ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null
    
    # 确保 known_hosts 权限正确
    chmod 600 ~/.ssh/known_hosts
    
    echo "✅ GitHub 主机密钥已添加"
    echo ""
    
    echo "2. 测试 GitHub SSH 连接..."
    ssh -T git@github.com 2>&1 | head -5
    
    echo ""
    echo "3. 如果看到 'Hi zhuweiwei666! You've successfully authenticated' 说明成功！"
    echo "   如果还是失败，请确认服务器上的 SSH 公钥已添加到您的 GitHub 账户"
    echo ""
    echo "   服务器公钥："
    cat ~/.ssh/id_ed25519.pub
EOF

