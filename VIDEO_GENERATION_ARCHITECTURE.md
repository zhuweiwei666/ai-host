# 🎬 AI 角色视频生成系统 - 技术架构文档

## 📋 概述

用户上传一张图片（角色首帧/头像），服务端自动生成多段“动态皮肤”视频（idle、talk、react_*），写入 `Agent.previewVideos(tags=...)` 并通过 `LiveSkin Manifest` 提供给 iOS。

iOS 使用 `AVPlayerLayer` 做全屏视频渲染，并根据 `/api/chat` 返回的 `immersive.cues` 进行状态机切换（idle/listen/speak）与 crossfade。

---

## 🏗️ 系统架构（当前实现）

```
iOS (AVPlayerLayer)
  ├─ GET /api/agents/:id/live-skin-manifest   (动作库)
  └─ POST /api/chat { immersive:true, requestTTS:true } (回复 + cues)

Backend (Node.js)
  ├─ /api/admin/live-skin/generate/:agentId   (管理员触发生成)
  ├─ liveSkinService (生成多段 clips)
  │    ├─ RunPod /generate 生成 MP4
  │    └─ 上传到 R2 (videos/YYYY-MM-DD/<agentId>/...mp4)
  └─ 写回 MongoDB: Agent.previewVideos[] + tags

RunPod GPU (H100)
  ├─ GET  /health
  ├─ POST /generate (multipart)
  └─ GET  /docs (Swagger)

CDN/Storage (Cloudflare R2)
  └─ 公网 URL: R2_DEV_URL / R2_PUBLIC_URL
```

---

## ✅ RunPod 端点（重要：小写 L 不是数字 1）

| 用途 | URL |
|------|-----|
| 健康检查 | `https://wedafdlyb86l9u-8000.proxy.runpod.net/health` |
| 生成视频 | `POST https://wedafdlyb86l9u-8000.proxy.runpod.net/generate` |
| API 文档 | `https://wedafdlyb86l9u-8000.proxy.runpod.net/docs` |

---

## 🔧 服务端配置（Backend .env）

必须配置：

```bash
# RunPod
RUNPOD_VIDEO_API=https://wedafdlyb86l9u-8000.proxy.runpod.net
RUNPOD_VIDEO_GENERATE_PATH=/generate

# R2（已存在则无需改）
STORAGE_TYPE=r2
R2_ACCOUNT_ID=...
R2_BUCKET=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
# 公开访问二选一
R2_PUBLIC_URL=https://<custom-domain>
# or
R2_DEV_URL=https://<pub-xxx>.r2.dev
```

---

## 🧩 数据落库（MongoDB）

视频生成完成后写入：

- `Agent.previewVideos[]`：每条包含 `url/tags/duration/sortOrder/...`
- `Agent.defaultPreviewIndex`：默认 idle
- `Agent.coverVideoUrls[]`：兼容旧字段（按 previewVideos.url 同步）
- `Agent.liveSkinStatus`：`pending | generating | ready | failed`

---

## 🚀 如何触发生成（管理员）

> 这是后端已经实现的 MVP：异步触发生成，多段视频自动上传并打 tags。

- `POST /api/admin/live-skin/generate/:agentId`
- Body 可选：

```json
{ "imageUrl": "https://.../avatar.jpg" }
```

---

## 🧪 本地/服务器快速验证

### 1) 验证 RunPod

```bash
curl -sS https://wedafdlyb86l9u-8000.proxy.runpod.net/health
```

预期：
```json
{"status":"ok","model_loaded":true,"gpu":true}
```

### 2) 触发生成（需要管理员 token）

```bash
curl -X POST "https://cling-ai.com/api/admin/live-skin/generate/<agentId>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3) iOS 拉取 manifest

```bash
curl https://cling-ai.com/api/agents/<agentId>/live-skin-manifest
```

---

## 备注

- 当前生成任务是 “fire-and-forget” 的 MVP。后续可升级为持久化队列（BullMQ/Redis）以支持大批量稳定生产。
