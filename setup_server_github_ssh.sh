#!/bin/bash

# 服务器端 GitHub SSH 配置脚本
# 这个脚本需要在服务器上运行

REMOTE_HOST="root@139.162.62.115"

echo "============================================="
echo "   在服务器上配置 GitHub SSH 访问"
echo "============================================="

echo "正在连接到服务器并配置 GitHub SSH..."
echo ""

ssh "$REMOTE_HOST" "bash -s" <<'EOF'
    set -e
    
    echo "📁 检查 SSH 目录..."
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    
    # 检查是否已有 SSH 密钥
    if [ -f ~/.ssh/id_ed25519 ]; then
        echo "✅ 已找到现有 SSH 密钥"
    else
        echo "🔑 生成新的 SSH 密钥..."
        ssh-keygen -t ed25519 -C "server@ai-host" -f ~/.ssh/id_ed25519 -N ""
        echo "✅ SSH 密钥已生成"
    fi
    
    echo ""
    echo "您的服务器 SSH 公钥内容："
    echo "----------------------------------------"
    cat ~/.ssh/id_ed25519.pub
    echo "----------------------------------------"
    echo ""
    
    echo "📝 请按照以下步骤将公钥添加到 GitHub："
    echo ""
    echo "1. 复制上面的公钥内容"
    echo "2. 打开浏览器，访问："
    echo "   https://github.com/settings/keys"
    echo ""
    echo "3. 点击右上角的 'New SSH key' 按钮"
    echo ""
    echo "4. 填写信息："
    echo "   - Title: 输入一个名称（如：Server 139.162.62.115）"
    echo "   - Key: 粘贴上面的公钥内容"
    echo ""
    echo "5. 点击 'Add SSH key' 按钮"
    echo ""
    echo "6. 完成后，运行以下命令测试连接："
    echo "   ssh -T git@github.com"
    echo ""
    echo "如果看到 'Hi zhuweiwei666! You've successfully authenticated...' 就说明成功了！"
EOF

echo ""
echo "============================================="
echo "   配置指南已显示在服务器上"
echo "============================================="
echo ""
echo "💡 提示："
echo "   您也可以直接在服务器上运行以下命令查看公钥："
echo "   ssh $REMOTE_HOST 'cat ~/.ssh/id_ed25519.pub'"
echo ""

