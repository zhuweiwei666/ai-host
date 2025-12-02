# 修复 OpenRouter 401 错误

## 问题诊断

从日志可以看到：
```
OpenRouter API Error: { error: { message: 'User not found.', code: 401 } }
LLM call failed: Error: OpenRouter API authentication failed
```

这说明 OpenRouter API Key 无效或已过期。

## 解决步骤

### 步骤 1: 获取新的 OpenRouter API Key

1. 访问 https://openrouter.ai/keys
2. 登录你的 OpenRouter 账户
3. 如果已有 API Key，检查是否有效
4. 如果无效或不存在，点击 "Create Key" 创建新的 API Key
5. 复制新的 API Key（格式类似：`sk-or-v1-xxxxxxxxxxxxx`）

### 步骤 2: 更新服务器配置

在服务器上运行：

```bash
# 1. 编辑配置文件
nano /var/www/ai-host/backend/.env.production.local

# 2. 找到这一行（大约在第 33 行）
OPENROUTER_API_KEY=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

# 3. 替换为新的 API Key
OPENROUTER_API_KEY=sk-or-v1-your-new-api-key-here

# 4. 保存文件（Ctrl+O, Enter, Ctrl+X）
```

### 步骤 3: 验证配置

```bash
# 检查 API Key 是否正确设置
grep "OPENROUTER_API_KEY" /var/www/ai-host/backend/.env.production.local

# 应该看到类似：
# OPENROUTER_API_KEY=sk-or-v1-your-new-api-key-here
```

### 步骤 4: 重启服务

```bash
# 重启服务以加载新的环境变量
pm2 restart ai-host-backend --update-env

# 验证服务状态
pm2 status
```

### 步骤 5: 测试 API Key

```bash
# 运行检查脚本
cd /var/www/ai-host/deploy
./check_openrouter.sh
```

如果看到 "✓ API Key 有效"，说明配置成功。

## 快速修复命令

如果你想快速更新 API Key，可以运行：

```bash
# 替换 YOUR_NEW_API_KEY 为实际的 API Key
sed -i 's/^OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=YOUR_NEW_API_KEY/' /var/www/ai-host/backend/.env.production.local

# 重启服务
pm2 restart ai-host-backend --update-env
```

## 验证修复

1. 刷新浏览器页面
2. 尝试发送一条聊天消息
3. 如果不再出现 500 错误，说明修复成功

## 常见问题

### Q: 如何检查 API Key 是否有效？

A: 运行检查脚本：
```bash
cd /var/www/ai-host/deploy
./check_openrouter.sh
```

### Q: API Key 格式是什么？

A: OpenRouter API Key 格式通常是：`sk-or-v1-` 后跟一串字符，总长度约 140-150 个字符。

### Q: 更新后仍然报错？

A: 检查：
1. API Key 是否正确复制（没有多余空格）
2. 文件是否保存成功
3. 服务是否已重启
4. 查看日志：`pm2 logs ai-host-backend --lines 50`

## 需要帮助？

如果问题仍然存在，请提供：
1. 检查脚本的输出
2. PM2 日志：`pm2 logs ai-host-backend --lines 50 | grep -i openrouter`

