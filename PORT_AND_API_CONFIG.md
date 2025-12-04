# 端口和接口配置文档

## ⚠️ 重要更新 (2025-12-03)

**所有API接口已迁移到HTTPS域名访问**

- ✅ **使用域名**: `https://cling-ai.com/api/*` 或 `https://www.cling-ai.com/api/*`
- ❌ **不再使用IP地址**: `http://139.162.62.115:8000` (仅用于本地调试)
- 🔒 **所有接口必须通过HTTPS访问**，HTTP会自动重定向到HTTPS
- 📱 **iOS/Android客户端请使用HTTPS域名访问API**

### 迁移指南

**旧方式（已废弃）:**
```
http://139.162.62.115:8000/api/agents
http://139.162.62.115:9000/api/ai-wallet/...
```

**新方式（推荐）:**
```
https://cling-ai.com/api/agents
https://cling-ai.com/api/ai-wallet/...
```

## 📌 端口配置总览

### 服务端口分配

| 服务 | 容器内部端口 | 宿主机端口 | 说明 |
|------|------------|-----------|------|
| **Frontend (Nginx)** | 80, 443 | 80, 443 | Web前端服务 (HTTP自动重定向到HTTPS) |
| **Backend (Node.js)** | 4000 | 8000 | API后端服务 |
| **AI Wallet** | 9000 | 9000 | 钱包服务 |
| **MongoDB** | 27017 | 27017 | 数据库服务 |

### 端口映射规则

```
宿主机:容器内部
80:80      (Frontend)
8000:4000  (Backend)  ← 注意：宿主机8000映射到容器4000
9000:9000  (AI Wallet)
27017:27017 (MongoDB)
```

## 🔧 配置文件位置

### 1. Docker Compose (`docker-compose.yml`)
```yaml
backend:
  ports:
    - "8000:4000"  # 宿主机8000 -> 容器4000
```

### 2. Backend 服务 (`backend/src/server.js`)
```javascript
const PORT = process.env.PORT || 4000;  // 容器内部监听4000
```

### 3. Backend 环境变量 (`backend/.env`)
```bash
PORT=4000  # 必须设置为4000，与容器内部端口一致
```

### 4. Frontend Nginx (`frontend/nginx.conf`)
```nginx
location /api/ {
    proxy_pass http://backend:4000;  # 容器内部通信，使用4000
}
```

### 5. Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
EXPOSE 4000  # 声明容器内部端口
```

## 🧩 特性开关（Feature Flags）

| 变量 | 位置 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ENABLE_VIDEO_FEATURE` | `backend/.env` | `false` | 是否启用视频生成 API（Fal/Puppeteer）。关闭后将不加载 `/api/generate-video` 路由，避免 Puppeteer 依赖报错。 |
| `VITE_ENABLE_VIDEO` | `frontend/.env.*` | `false` | 是否在聊天页面展示「Video (50)」按钮及模板设置。应与后端开关保持一致。 |

> ✅ 建议：除非视频生成链路完全可用，否则保持这两个配置为 `false`，避免前端误触发、后端日志持续报错。

## 🌐 API 接口配置

### 前端访问路径
- **前端页面**: 
  - `https://cling-ai.com` (推荐，HTTPS域名访问)
  - `https://www.cling-ai.com` (推荐，HTTPS www子域名)
  - `http://cling-ai.com` (自动重定向到HTTPS)
  - `http://139.162.62.115/` (IP访问，备用，不推荐)
- **API请求**: 
  - 使用相对路径 `/api/*` (由Nginx自动代理到后端，支持HTTPS)
  - 或使用完整URL `https://cling-ai.com/api/*` (推荐)

### 后端API端点
所有API路径以 `/api/` 开头，通过HTTPS域名访问：

```
https://cling-ai.com/api/agents          - AI主播管理
https://cling-ai.com/api/chat            - 聊天相关
https://cling-ai.com/api/oss              - OSS上传
https://cling-ai.com/api/voice-models     - 语音模型
https://cling-ai.com/api/generate-image   - 图片生成
https://cling-ai.com/api/generate-video   - 视频生成
https://cling-ai.com/api/users            - 用户管理
https://cling-ai.com/api/wallet           - 钱包服务
https://cling-ai.com/api/stats            - 统计数据
https://cling-ai.com/api/ai-wallet/*      - AI钱包服务
```

**注意**: 
- 所有API接口必须通过HTTPS访问
- HTTP请求会自动重定向到HTTPS
- 前端代码中使用相对路径 `/api/*` 即可，会自动使用当前域名和协议

### 容器内部服务通信
- Frontend (Nginx) → Backend: `http://backend:4000`
- Frontend (Nginx) → AI Wallet: `http://aiwallet:9000`
- Backend → MongoDB: `mongodb://mongo:27017`

### iOS/Android 客户端兼容性
- **HTTPS访问**: 所有客户端必须使用HTTPS协议访问API
  - 推荐: `https://cling-ai.com/api/*`
  - 或: `https://www.cling-ai.com/api/*`
- **双斜杠路径兼容**: Nginx已配置支持 `//api/agents` 格式（iOS客户端常见问题）
  - `https://cling-ai.com//api/agents` 可以正常工作
  - `https://cling-ai.com/api/agents` 同样正常工作
- **建议**: 
  - 客户端应使用 `https://cling-ai.com/api/*` 格式
  - 避免使用IP地址直接访问
  - 服务端已兼容双斜杠路径，但建议客户端使用标准路径

## ⚠️ 重要注意事项

1. **后端端口必须统一为4000**
   - `backend/.env` 中 `PORT=4000`
   - `backend/src/server.js` 默认值 `4000`
   - `backend/Dockerfile` 中 `EXPOSE 4000`
   - `frontend/nginx.conf` 中 `proxy_pass http://backend:4000`

2. **Docker Compose端口映射**
   - 宿主机8000映射到容器4000：`"8000:4000"`
   - 仅用于本地调试，生产环境应使用HTTPS域名访问

3. **前端API配置**
   - 前端使用相对路径 `/api/*` (推荐)
   - 或使用完整HTTPS URL: `https://cling-ai.com/api/*`
   - Nginx自动代理到 `http://backend:4000/api/*` (容器内部通信)
   - 外部访问必须通过HTTPS域名

4. **修改端口时的检查清单**
   - [ ] `docker-compose.yml` 端口映射
   - [ ] `backend/.env` 中的 PORT
   - [ ] `backend/src/server.js` 默认值
   - [ ] `backend/Dockerfile` EXPOSE
   - [ ] `frontend/nginx.conf` proxy_pass
   - [ ] 重启所有相关容器

## 🔍 验证配置

### 检查后端端口
```bash
# 容器内部检查
docker exec ai-host-backend netstat -tlnp | grep 4000

# 从宿主机访问（本地调试）
curl http://localhost:8000/api/agents

# 从外部访问（生产环境，推荐）
curl https://cling-ai.com/api/agents
```

### 检查Nginx配置
```bash
docker exec ai-host-frontend cat /etc/nginx/conf.d/default.conf | grep backend
```

### 检查环境变量
```bash
docker exec ai-host-backend env | grep PORT
```

## 📝 修改历史

- 2025-12-03: 统一端口配置为4000（容器内部），宿主机映射8000:4000
- 2025-12-03: 修复iOS客户端双斜杠路径问题（`//api/agents`），nginx已兼容处理
- 2025-12-03: 配置域名绑定 `cling-ai.com` 和 `www.cling-ai.com`
- 2025-12-03: 配置HTTPS SSL证书，HTTP自动重定向到HTTPS
- 2025-12-03: **更新接口访问方式为HTTPS域名** - 所有API接口必须通过 `https://cling-ai.com/api/*` 访问
- 2025-12-03: **统一错误响应格式和状态码** - 所有API错误响应使用标准化格式

## 📋 API错误响应格式

### 标准错误响应格式

所有API错误响应遵循统一格式：

```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "错误描述信息",
  "timestamp": "2025-12-03T04:15:36.000Z",
  "details": {
    "error": "详细错误信息（可选）"
  }
}
```

### HTTP状态码说明

| 状态码 | 说明 | 错误代码 | 使用场景 |
|--------|------|----------|----------|
| **200** | OK | - | 请求成功 |
| **201** | Created | - | 资源创建成功 |
| **400** | Bad Request | `BAD_REQUEST`, `VALIDATION_ERROR`, `MISSING_PARAMETER` | 请求参数错误 |
| **401** | Unauthorized | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` | 未认证或token无效 |
| **402** | Payment Required | `INSUFFICIENT_FUNDS` | 余额不足 |
| **403** | Forbidden | `FORBIDDEN`, `ADMIN_REQUIRED` | 无权限访问 |
| **404** | Not Found | `NOT_FOUND` | 资源不存在 |
| **409** | Conflict | `CONFLICT`, `ALREADY_EXISTS` | 资源冲突 |
| **422** | Unprocessable Entity | `VALIDATION_ERROR` | 数据验证失败 |
| **429** | Too Many Requests | `RESOURCE_LIMIT_EXCEEDED` | 请求频率过高 |
| **500** | Internal Server Error | `INTERNAL_ERROR`, `DATABASE_ERROR` | 服务器内部错误 |
| **502** | Bad Gateway | `EXTERNAL_API_ERROR` | 外部服务错误 |
| **503** | Service Unavailable | `SERVICE_UNAVAILABLE` | 服务不可用 |

### 业务错误代码

| 错误代码 | 说明 | HTTP状态码 |
|----------|------|------------|
| `UNAUTHORIZED` | 需要认证 | 401 |
| `INVALID_TOKEN` | Token无效 | 401 |
| `TOKEN_EXPIRED` | Token已过期 | 401 |
| `FORBIDDEN` | 无权限 | 403 |
| `ADMIN_REQUIRED` | 需要管理员权限 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `BAD_REQUEST` | 请求参数错误 | 400 |
| `VALIDATION_ERROR` | 数据验证失败 | 422 |
| `INSUFFICIENT_FUNDS` | 余额不足 | 402 |
| `LLM_ERROR` | LLM服务错误 | 500 |
| `TTS_ERROR` | TTS服务错误 | 500 |
| `IMAGE_GEN_ERROR` | 图片生成错误 | 500 |
| `VIDEO_GEN_ERROR` | 视频生成错误 | 500 |
| `OSS_ERROR` | OSS服务错误 | 500 |
| `INTERNAL_ERROR` | 内部服务器错误 | 500 |
| `DATABASE_ERROR` | 数据库错误 | 500 |

### 成功响应格式

```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2025-12-03T04:15:36.000Z",
  "data": {
    // 响应数据
  },
  "message": "操作成功（可选）"
}
```

### 错误响应示例

**401 Unauthorized:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "timestamp": "2025-12-03T04:15:36.000Z"
}
```

**402 Payment Required:**
```json
{
  "success": false,
  "statusCode": 402,
  "code": "INSUFFICIENT_FUNDS",
  "message": "Insufficient AI Coins",
  "timestamp": "2025-12-03T04:15:36.000Z"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Agent not found",
  "timestamp": "2025-12-03T04:15:36.000Z",
  "details": {
    "path": "/api/agents/invalid-id",
    "method": "GET"
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "statusCode": 500,
  "code": "INTERNAL_ERROR",
  "message": "Internal Server Error",
  "timestamp": "2025-12-03T04:15:36.000Z",
  "details": {
    "error": "详细错误信息（开发环境）"
  }
}
```

## 🛠️ 快速验证脚本

运行 `./verify_config.sh` 可以快速检查所有配置是否一致。

## 📋 配置检查清单

修改端口前，请确保以下文件都已更新：

- [ ] `docker-compose.yml` - 端口映射 `"8000:4000"`
- [ ] `backend/.env` - `PORT=4000`
- [ ] `backend/src/server.js` - 默认值 `4000`
- [ ] `backend/Dockerfile` - `EXPOSE 4000`
- [ ] `frontend/nginx.conf` - `proxy_pass http://backend:4000`
- [ ] 重启容器: `docker compose restart backend frontend`

