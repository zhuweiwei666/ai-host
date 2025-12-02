# 完整修复指南

## 问题诊断

从错误日志看，主要有两个问题：

1. **`uuid` 模块错误**: `require() of ES Module .../uuid/dist-node/index.js ... not supported`
2. **`userId is not defined` 错误**: 多个路由加载失败

## 解决方案

### 方法 1: 使用自动修复脚本（推荐）

```bash
cd /var/www/ai-host/deploy
chmod +x fix_all_issues.sh
sudo ./fix_all_issues.sh
```

这个脚本会：
1. 从 Git 拉取最新代码
2. 自动修复所有 `uuid` 问题（替换为 `crypto.randomUUID()`）
3. 验证文件语法
4. 检查并设置环境变量
5. 重启 PM2 服务
6. 检查路由加载状态

### 方法 2: 手动修复

#### 步骤 1: 更新代码

```bash
cd /var/www/ai-host/backend
git pull origin main
```

#### 步骤 2: 修复 uuid 问题

检查以下文件是否仍在使用 `uuid`:

```bash
grep -r "require('uuid')" /var/www/ai-host/backend/src/
grep -r "uuidv4()" /var/www/ai-host/backend/src/
```

如果找到，需要替换为：

```javascript
// 替换前
const { v4: uuidv4 } = require('uuid');

// 替换后
const crypto = require('crypto');
```

并将所有 `uuidv4()` 替换为 `crypto.randomUUID()`。

#### 步骤 3: 验证语法

```bash
cd /var/www/ai-host/backend
node -c src/routes/*.js
node -c src/services/*.js
```

#### 步骤 4: 检查环境变量

确保 `.env.production.local` 或 `.env` 中有：

```bash
ENABLE_MOCK_AUTH=true
```

#### 步骤 5: 重启服务

```bash
pm2 restart ai-host-backend
# 或
pm2 restart all
```

#### 步骤 6: 检查路由加载

```bash
pm2 logs ai-host-backend --lines 50 --nostream | grep -E "(Route loaded|Failed to load route)"
```

## 常见问题

### Q: 为什么会有 `userId is not defined` 错误？

A: 这个错误通常是因为：
1. 某个模块在加载时出错，导致后续模块无法加载
2. 循环依赖导致模块加载顺序问题
3. 某个 `require()` 语句在模块加载时就执行了代码

**解决方案**: 确保所有路由文件中的 `userId` 都是在函数内部定义的，而不是在模块顶层。

### Q: 路由仍然返回 404？

A: 检查以下几点：
1. 路由是否正确加载（查看 PM2 日志）
2. Nginx 配置是否正确代理到后端
3. 后端服务是否正常运行

```bash
# 检查服务状态
pm2 status

# 检查路由加载
pm2 logs ai-host-backend --lines 100 | grep "Route loaded"

# 测试 API
curl -X POST http://localhost:4000/api/generate-image \
  -H "Content-Type: application/json" \
  -H "x-mock-user-id: test_user_001" \
  -d '{"description": "test"}'
```

### Q: 如何验证修复是否成功？

A: 运行以下命令：

```bash
# 1. 检查 uuid 是否已修复
grep -r "require('uuid')" /var/www/ai-host/backend/src/ || echo "✓ 没有找到 uuid 使用"

# 2. 检查路由加载
pm2 logs ai-host-backend --lines 30 --nostream | grep "Route loaded" | wc -l
# 应该看到 9 个路由加载成功

# 3. 测试 API
curl -X GET http://localhost:4000/api/agents \
  -H "x-mock-user-id: test_user_001"
```

## 需要帮助？

如果问题仍然存在，请提供：
1. PM2 完整日志: `pm2 logs ai-host-backend --lines 100`
2. 路由加载状态: `pm2 logs ai-host-backend --lines 50 --nostream | grep -E "(Route loaded|Failed)"`
3. 文件语法检查结果: `node -c /var/www/ai-host/backend/src/routes/*.js`

