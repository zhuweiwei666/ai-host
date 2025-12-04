# 前端 API 调用与后端接口映射对照表

## 1. Agent 管理

### 前端调用 (`frontend/src/api/index.ts`)
- `getAgents(params?)` → `GET /api/agents`
- `getAgent(id)` → `GET /api/agents/:id`
- `createAgent(data)` → `POST /api/agents`
- `updateAgent(id, data)` → `PUT /api/agents/:id`
- `deleteAgent(id)` → `DELETE /api/agents/:id`
- `duplicateAgent(id)` → `POST /api/agents/:id/duplicate`
- `scrapeAgents(url?)` → `POST /api/agents/scrape`

### 后端接口 (`backend/src/routes/agents.js`)
- ✅ `GET /api/agents` - 获取所有主播
- ✅ `GET /api/agents/:id` - 获取单个主播
- ✅ `POST /api/agents` - 创建主播
- ✅ `PUT /api/agents/:id` - 更新主播
- ✅ `DELETE /api/agents/:id` - 删除主播
- ✅ `POST /api/agents/:id/duplicate` - 复制主播
- ✅ `POST /api/agents/scrape` - 爬取主播

**状态**: ✅ 完全匹配

---

## 2. 文件上传 (OSS)

### 前端调用 (`frontend/src/api/index.ts` & `frontend/src/utils/ossUpload.ts`)
- `uploadImage(file)` → 内部调用 `uploadToOSS(file)`
- `uploadFile(file)` → 内部调用 `uploadToOSS(file)`
- `uploadToOSS(file)` → `GET /api/oss/sts` (获取STS凭证) → 直接上传到OSS

### 后端接口 (`backend/src/routes/oss.js`)
- ✅ `GET /api/oss/sts` - 获取OSS临时凭证

**状态**: ✅ 完全匹配

---

## 3. 图片生成

### 前端调用 (`frontend/src/api/index.ts`)
- `generateImage(description, options)` → `POST /api/generate-image`
- `generateAvatarImage(...)` → `POST /api/generate-image` (别名)

### 后端接口 (`backend/src/routes/imageGen.js`)
- ✅ `POST /api/generate-image` - 生成图片

**状态**: ✅ 完全匹配

---

## 4. 视频生成

### 前端调用 (`frontend/src/api/index.ts`)
- `generateVideo(agentId, prompt, imageUrl?, fastMode?)` → `POST /api/generate-video`

### 后端接口 (`backend/src/routes/videoGen.js`)
- ✅ `POST /api/generate-video` - 生成视频

**状态**: ✅ 完全匹配

---

## 5. 聊天功能

### 前端调用 (`frontend/src/api/index.ts`)
- `chatWithAgent(agentId, prompt, history?, skipImageGen?)` → `POST /api/chat`
- `getChatHistory(agentId)` → `GET /api/chat/history/:agentId`
- `generateTTS(agentId, text)` → `POST /api/chat/tts`

### 后端接口 (`backend/src/routes/chat.js`)
- ✅ `POST /api/chat` - 发送消息
- ✅ `GET /api/chat/history/:agentId` - 获取聊天历史
- ✅ `POST /api/chat/tts` - 生成语音

**状态**: ✅ 完全匹配

---

## 6. 语音模型

### 前端调用 (`frontend/src/api/index.ts`)
- `syncVoiceModels()` → `POST /api/voice-models/sync`
- `getVoiceModels(params?)` → `GET /api/voice-models`
- `updateVoiceModelFavorite(id, isFavorite)` → `PATCH /api/voice-models/:id/favorite`
- `updateVoiceModel(id, data)` → `PATCH /api/voice-models/:id`
- `deleteVoiceModel(id)` → `DELETE /api/voice-models/:id`
- `batchDeleteVoiceModels(ids)` → `DELETE /api/voice-models/batch`
- `getVoicePreview(id)` → `POST /api/voice-models/:id/preview`
- `extractVoiceId(sourceUrl)` → `POST /api/voice-models/extract`
- `createVoiceModelManual(data)` → `POST /api/voice-models/create`
- `createVoiceTemplate(sourceUrl)` → `POST /api/voice-models`

### 后端接口 (`backend/src/routes/voiceModels.js`)
- ✅ `POST /api/voice-models/sync` - 同步语音模型
- ✅ `GET /api/voice-models` - 获取语音模型列表
- ✅ `PATCH /api/voice-models/:id/favorite` - 更新收藏状态
- ✅ `PATCH /api/voice-models/:id` - 更新语音模型
- ✅ `DELETE /api/voice-models/:id` - 删除语音模型
- ✅ `DELETE /api/voice-models/batch` - 批量删除
- ✅ `POST /api/voice-models/:id/preview` - 获取预览
- ✅ `POST /api/voice-models/extract` - 提取语音ID
- ✅ `POST /api/voice-models/create` - 手动创建
- ✅ `POST /api/voice-models` - 创建模板

**状态**: ✅ 完全匹配

---

## 7. 用户管理

### 前端调用 (`frontend/src/api/index.ts`)
- `getUsers(params?)` → `GET /api/users`
- `createUser(data)` → `POST /api/users`
- `rechargeUser(userId, amount)` → `POST /api/users/:userId/recharge`
- `initAdminUser()` → `POST /api/users/init-admin`
- `syncExternalUser(data)` → `POST /api/users/sync`
- `registerChannelUser(data)` → `POST /api/users/register`
- `loginChannelUser(data)` → `POST /api/users/login`

### 后端接口 (`backend/src/routes/users.js`)
- ✅ `GET /api/users` - 获取用户列表
- ✅ `POST /api/users` - 创建用户
- ✅ `POST /api/users/:userId/recharge` - 充值
- ✅ `POST /api/users/init-admin` - 初始化管理员
- ✅ `POST /api/users/sync` - 同步外部用户
- ✅ `POST /api/users/register` - 注册
- ✅ `POST /api/users/login` - 登录

**状态**: ✅ 完全匹配

---

## 8. 钱包

### 前端调用 (`frontend/src/api/index.ts`)
- 无直接调用，通过 `ChatPage.tsx` 内部调用:
  - `GET /api/wallet/balance` - 获取余额
  - `POST /api/wallet/reward/ad` - 观看广告奖励

### 后端接口 (`backend/src/routes/wallet.js`)
- ✅ `GET /api/wallet/balance` - 获取余额
- ✅ `POST /api/wallet/reward/ad` - 广告奖励

**状态**: ✅ 完全匹配

---

## 9. 统计数据

### 前端调用 (`frontend/src/pages/AgentStats.tsx`)
- `GET /api/stats/agents` - 获取ROI统计

### 后端接口 (`backend/src/routes/stats.js`)
- ✅ `GET /api/stats/agents` - 获取ROI统计

**状态**: ✅ 完全匹配

---

## 总结

所有前端 API 调用与后端接口完全匹配，没有发现不匹配的情况。

### 注意事项:
1. 所有接口都需要认证（除了 `/api/users/init-admin` 和部分公开接口）
2. 文件上传使用 OSS 直接上传，不经过后端
3. 所有响应格式已统一为 `{ success: true, data: {...} }` 或 `{ message: '...', code: '...' }`

