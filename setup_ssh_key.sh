#!/bin/bash

# SSH 免密登录设置脚本
REMOTE_HOST="root@139.162.62.115"

echo "============================================="
echo "   设置 SSH 免密登录到 $REMOTE_HOST"
echo "============================================="

# 检查本地是否有 SSH 密钥
if [ ! -f ~/.ssh/id_ed25519 ] && [ ! -f ~/.ssh/id_rsa ]; then
    echo "[1/3] 未找到 SSH 密钥，正在生成新的密钥对..."
    ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""
    echo "✅ SSH 密钥已生成"
else
    echo "[1/3] ✅ 已找到现有 SSH 密钥"
fi

# 确定使用的密钥文件
if [ -f ~/.ssh/id_ed25519.pub ]; then
    PUB_KEY_FILE=~/.ssh/id_ed25519.pub
elif [ -f ~/.ssh/id_rsa.pub ]; then
    PUB_KEY_FILE=~/.ssh/id_rsa.pub
else
    echo "❌ 错误：未找到公钥文件"
    exit 1
fi

echo ""
echo "[2/3] 正在将公钥复制到远程服务器..."
echo "⚠️  注意：您需要输入一次 root 用户的密码（这是最后一次）"
echo ""

# 使用 ssh-copy-id 复制公钥
ssh-copy-id -i "$PUB_KEY_FILE" "$REMOTE_HOST"

if [ $? -eq 0 ]; then
    echo ""
    echo "[3/3] 测试免密登录..."
    ssh -o BatchMode=yes "$REMOTE_HOST" "echo '✅ SSH 免密登录配置成功！'"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "============================================="
        echo "   ✅ SSH 免密登录设置完成！"
        echo "============================================="
        echo "现在您可以运行 ./update_and_deploy.sh 而无需输入密码了。"
    else
        echo ""
        echo "⚠️  警告：免密登录测试失败，请检查服务器配置。"
    fi
else
    echo ""
    echo "❌ 错误：公钥复制失败。"
    echo ""
    echo "如果 ssh-copy-id 不工作，您可以手动执行以下步骤："
    echo ""
    echo "1. 查看您的公钥："
    echo "   cat $PUB_KEY_FILE"
    echo ""
    echo "2. 手动登录服务器并添加公钥："
    echo "   ssh $REMOTE_HOST"
    echo "   mkdir -p ~/.ssh"
    echo "   chmod 700 ~/.ssh"
    echo "   echo '$(cat $PUB_KEY_FILE)' >> ~/.ssh/authorized_keys"
    echo "   chmod 600 ~/.ssh/authorized_keys"
    echo "   exit"
    exit 1
fi

