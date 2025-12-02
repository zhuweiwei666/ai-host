#!/bin/bash

# GitHub SSH 公钥配置辅助脚本

echo "============================================="
echo "   GitHub SSH 公钥配置助手"
echo "============================================="

# 检查是否有 SSH 公钥
if [ -f ~/.ssh/id_ed25519.pub ]; then
    PUB_KEY_FILE=~/.ssh/id_ed25519.pub
elif [ -f ~/.ssh/id_rsa.pub ]; then
    PUB_KEY_FILE=~/.ssh/id_rsa.pub
else
    echo "❌ 未找到 SSH 公钥文件"
    echo "正在生成新的 SSH 密钥..."
    ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""
    PUB_KEY_FILE=~/.ssh/id_ed25519.pub
fi

echo ""
echo "您的 SSH 公钥内容："
echo "----------------------------------------"
cat "$PUB_KEY_FILE"
echo "----------------------------------------"
echo ""

# 尝试复制到剪贴板（macOS）
if command -v pbcopy &> /dev/null; then
    cat "$PUB_KEY_FILE" | pbcopy
    echo "✅ 公钥已复制到剪贴板！"
    echo ""
fi

echo "📝 请按照以下步骤将公钥添加到 GitHub："
echo ""
echo "1. 打开浏览器，访问："
echo "   https://github.com/settings/keys"
echo ""
echo "2. 点击右上角的 'New SSH key' 按钮"
echo ""
echo "3. 填写信息："
echo "   - Title: 输入一个名称（如：MacBook Pro）"
echo "   - Key: 粘贴上面的公钥内容（如果已复制到剪贴板，直接 Cmd+V）"
echo ""
echo "4. 点击 'Add SSH key' 按钮"
echo ""
echo "5. 完成后，运行以下命令测试连接："
echo "   ssh -T git@github.com"
echo ""
echo "如果看到 'Hi zhuweiwei666! You've successfully authenticated...' 就说明成功了！"
echo ""

