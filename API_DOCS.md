# AI Host API 接口文档

> 更新时间: 2025-12-04
> 版本: v2.0

## 目录

1. [认证说明](#认证说明)
2. [Agent 管理](#1-agent-管理)
3. [用户管理](#2-用户管理)
4. [文件上传 (OSS/R2)](#3-文件上传-ossr2)
5. [聊天功能](#4-聊天功能)
6. [语音模型](#5-语音模型)
7. [图片生成](#6-图片生成)
8. [视频生成](#7-视频生成)
9. [钱包系统](#8-钱包系统)
10. [统计数据](#9-统计数据)

---

## 认证说明

### JWT Token 认证
大部分 API 需要在请求头中携带 JWT Token：
```
Authorization: Bearer <token>
```

### Mock 认证 (开发环境)
当 `ENABLE_MOCK_AUTH=true` 时，支持以下 Header 模拟认证：
```
x-mock-user-id: <userId>
x-mock-user-role: admin | user
```

### 响应格式
所有 API 统一返回格式：
```json
// 成功
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2025-12-04T06:00:00.000Z",
  "data": { ... }
}

// 错误
{
  "message": "错误描述",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

---

## 1. Agent 管理

### 获取所有主播
```
GET /api/agents
```
**Query 参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 筛选状态: online/offline |
| style | string | 否 | 筛选风格: realistic/anime/all |

**认证:** 可选

---

### 获取单个主播
```
GET /api/agents/:id
```
**认证:** 可选

**响应示例:**
```json
{
  "success": true,
  "data": {
    "_id": "xxx",
    "name": "Ali",
    "gender": "female",
    "style": "anime",
    "avatarUrl": "https://...",
    "avatarUrls": ["https://..."],
    "coverVideoUrl": "https://...",
    "coverVideoUrls": ["https://...", "https://..."],
    "privatePhotoUrl": "",
    "privatePhotoUrls": [],
    "description": "...",
    "modelName": "grok-4-1-fast-reasoning",
    "temperature": 0.7,
    "corePrompt": "...",
    "stage1Prompt": "...",
    "stage2Prompt": "...",
    "stage3Prompt": "...",
    "stage1Threshold": 20,
    "stage2Threshold": 60,
    "systemPrompt": "...",
    "voiceId": "xxx",
    "status": "online"
  }
}
```

---

### 创建主播
```
POST /api/agents
```
**认证:** 必须 (Admin)

**请求体:**
```json
{
  "name": "主播名称",
  "gender": "female",
  "style": "anime",
  "avatarUrl": "https://...",
  "avatarUrls": ["https://...", "https://..."],
  "coverVideoUrl": "https://...",
  "coverVideoUrls": ["https://...", "https://..."],
  "privatePhotoUrls": [],
  "description": "描述",
  "modelName": "grok-4-1-fast-reasoning",
  "temperature": 0.7,
  "corePrompt": "核心提示词",
  "stage1Prompt": "...",
  "stage2Prompt": "...",
  "stage3Prompt": "...",
  "systemPrompt": "系统提示词",
  "voiceId": "Fish Audio Voice ID",
  "status": "online"
}
```

---

### 更新主播
```
PUT /api/agents/:id
```
**认证:** 必须 (Admin)

**请求体:** 同创建接口，额外支持:
| 参数 | 类型 | 说明 |
|------|------|------|
| updateGlobalCore | boolean | 是否将 corePrompt 应用到同模型的所有主播 |

---

### 删除主播
```
DELETE /api/agents/:id
```
**认证:** 必须 (Admin)

---

### 复制主播
```
POST /api/agents/:id/duplicate
```
**认证:** 必须 (Admin)

**说明:** 复制指定主播，名称后自动添加 "(副本)"

---

### 爬取主播
```
POST /api/agents/scrape
```
**认证:** 必须 (Admin)

**说明:** 后台启动爬虫任务

---

## 2. 用户管理

### 用户同步 (Android/iOS)
```
POST /api/users/sync
```
**认证:** 无需

**请求体:**
```json
{
  "externalUserId": "外部用户ID",
  "platform": "android | ios",
  "externalAppId": "可选-外部应用ID",
  "email": "可选",
  "phone": "可选",
  "username": "可选"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "内部用户ID",
      "externalUserId": "外部用户ID",
      "username": "...",
      "platform": "android",
      "userType": "channel",
      "role": "user"
    },
    "token": "JWT Token",
    "balance": 100,
    "isNew": true
  }
}
```

---

### 用户注册 (Web)
```
POST /api/users/register
```
**认证:** 无需

**请求体:**
```json
{
  "username": "用户名",
  "password": "密码 (至少6位)",
  "email": "可选",
  "phone": "可选"
}
```

---

### 用户登录
```
POST /api/users/login
```
**认证:** 无需

**请求体 (Web):**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

**请求体 (Android/iOS):**
```json
{
  "externalUserId": "外部用户ID",
  "platform": "android | ios"
}
```

---

### Google 登录
```
POST /api/users/google-login
```
**认证:** 无需

**请求体:**
```json
{
  "google_id": "Google用户ID",
  "email": "邮箱",
  "name": "可选-昵称",
  "picture": "可选-头像URL"
}
```

---

### 初始化管理员
```
POST /api/users/init-admin
```
**认证:** 首次可无需认证，之后需要 Admin

**请求体:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

---

### 获取用户列表
```
GET /api/users
```
**认证:** 必须 (Admin)

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| userType | string | operator/channel |
| platform | string | web/android/ios/admin |
| isActive | boolean | 是否启用 |

---

### 创建用户
```
POST /api/users
```
**认证:** 必须 (Admin)

---

### 修改密码
```
POST /api/users/change-password
```
**认证:** 必须

**请求体:**
```json
{
  "oldPassword": "旧密码",
  "newPassword": "新密码"
}
```

---

### 创建管理员
```
POST /api/users/create-admin
```
**认证:** 必须 (Admin)

**请求体:**
```json
{
  "username": "管理员用户名",
  "password": "密码",
  "email": "可选"
}
```

---

### 获取管理员列表
```
GET /api/users/admins
```
**认证:** 必须 (Admin)

---

### 删除管理员
```
DELETE /api/users/admins/:id
```
**认证:** 必须 (Admin)

**说明:** 不能删除自己

---

### 用户充值
```
POST /api/users/:id/recharge
```
**认证:** 必须 (Admin 或自己)

**请求体:**
```json
{
  "amount": 100
}
```

---

## 3. 文件上传 (OSS/R2)

### 获取存储配置
```
GET /api/oss/config
```
**认证:** 可选

**响应 (R2):**
```json
{
  "type": "r2",
  "bucket": "clingai",
  "basePath": "uploads",
  "publicUrl": "https://pub-xxx.r2.dev"
}
```

---

### 获取 STS 凭证 (仅 OSS)
```
GET /api/oss/sts
```
**认证:** 可选

**说明:** R2 不支持 STS，请使用 `/api/oss/upload`

---

### 文件上传 ⭐
```
POST /api/oss/upload
```
**认证:** 可选

**Content-Type:** multipart/form-data

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| folder | string | 上传目录，默认 uploads |

**请求体:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 文件，最大 500MB |

**响应:**
```json
{
  "success": true,
  "data": {
    "url": "https://pub-xxx.r2.dev/uploads/2025-12-04/uuid.jpg",
    "key": "uploads/2025-12-04/uuid.jpg",
    "name": "uploads/2025-12-04/uuid.jpg",
    "storageType": "r2"
  }
}
```

---

## 4. 聊天功能

### 发送消息
```
POST /api/chat
```
**认证:** 必须

**请求体:**
```json
{
  "agentId": "主播ID",
  "prompt": "用户消息",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "skipImageGen": false
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "reply": "AI回复内容",
    "imageUrl": "生成的图片URL (如果有)",
    "intimacyLevel": 2,
    "model": "grok-4-1-fast-reasoning",
    "usage": { ... },
    "cost": { ... }
  }
}
```

---

### 获取聊天历史
```
GET /api/chat/history/:agentId
```
**认证:** 必须

---

### 生成语音 (TTS)
```
POST /api/chat/tts
```
**认证:** 必须

**请求体:**
```json
{
  "agentId": "主播ID",
  "text": "要转换的文本"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "audioUrl": "https://..."
  }
}
```

---

## 5. 语音模型

### 同步语音模型
```
POST /api/voice-models/sync
```
**认证:** 必须 (Admin)

---

### 获取语音模型列表
```
GET /api/voice-models
```
**认证:** 可选

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| isFavorite | boolean | 筛选收藏 |
| gender | string | 筛选性别 |
| language | string | 筛选语言 |

---

### 更新收藏状态
```
PATCH /api/voice-models/:id/favorite
```
**认证:** 必须

**请求体:**
```json
{
  "isFavorite": true
}
```

---

### 更新语音模型
```
PATCH /api/voice-models/:id
```
**认证:** 必须 (Admin)

---

### 删除语音模型
```
DELETE /api/voice-models/:id
```
**认证:** 必须 (Admin)

---

### 批量删除
```
DELETE /api/voice-models/batch
```
**认证:** 必须 (Admin)

**请求体:**
```json
{
  "ids": ["id1", "id2", "id3"]
}
```

---

### 获取语音预览
```
POST /api/voice-models/:id/preview
```
**认证:** 必须

---

### 提取语音ID
```
POST /api/voice-models/extract
```
**认证:** 必须

**请求体:**
```json
{
  "sourceUrl": "Fish Audio URL"
}
```

---

### 手动创建语音模型
```
POST /api/voice-models/create
```
**认证:** 必须 (Admin)

---

### 创建语音模板
```
POST /api/voice-models
```
**认证:** 必须 (Admin)

---

## 6. 图片生成

### 生成图片
```
POST /api/generate-image
```
**认证:** 必须

**请求体:**
```json
{
  "description": "图片描述",
  "count": 1,
  "width": 1024,
  "height": 1024,
  "provider": "fal | volcengine"
}
```

---

## 7. 视频生成

### 生成视频
```
POST /api/generate-video
```
**认证:** 必须

**请求体:**
```json
{
  "agentId": "主播ID",
  "prompt": "视频描述",
  "imageUrl": "参考图片URL (可选)",
  "fastMode": false
}
```

---

## 8. 钱包系统

### 获取余额
```
GET /api/wallet/balance
```
**认证:** 必须

**响应:**
```json
{
  "success": true,
  "data": {
    "balance": 1000
  }
}
```

---

### 广告奖励
```
POST /api/wallet/reward/ad
```
**认证:** 必须

**请求体:**
```json
{
  "traceId": "唯一追踪ID (防重复)"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "balance": 1050
  },
  "message": "Ad reward received! +50 Coins"
}
```

---

## 9. 统计数据

### 获取 ROI 统计
```
GET /api/stats/agents
```
**认证:** 必须 (Admin)

---

## 环境变量配置

### 存储配置
```env
# 存储类型: r2 或 oss
STORAGE_TYPE=r2

# Cloudflare R2 配置
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=clingai
R2_BASE_PATH=uploads
R2_DEV_URL=https://pub-xxx.r2.dev

# 阿里云 OSS 配置 (备选)
OSS_ACCESS_KEY_ID=xxx
OSS_ACCESS_KEY_SECRET=xxx
OSS_BUCKET=xxx
OSS_REGION=xxx
OSS_ENDPOINT=xxx
```

### Fish Audio 配置
```env
FISH_AUDIO_API_KEY=xxx
FISH_AUDIO_API_TOKEN=xxx
```

### 认证配置
```env
JWT_SECRET=your-secret-key
ENABLE_MOCK_AUTH=true  # 开发环境启用
```

---

## 错误码说明

| Code | 说明 |
|------|------|
| UNAUTHORIZED | 未认证 |
| FORBIDDEN | 无权限 |
| ADMIN_REQUIRED | 需要管理员权限 |
| NOT_FOUND | 资源不存在 |
| BAD_REQUEST | 请求参数错误 |
| CONFLICT | 资源冲突 |
| INTERNAL_ERROR | 服务器内部错误 |
| USER_EXISTS | 用户已存在 |
| INVALID_CREDENTIALS | 凭证无效 |
| WEAK_PASSWORD | 密码太弱 |
| DUPLICATE_REWARD | 重复领取奖励 |


