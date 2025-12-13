# 🎬 视频优先（Video-first）“动态皮肤”方案：比 2.5D 更像“活人”

> 结论：如果每个角色已有 8–10 个短视频（且图片是视频首帧），**最酷的路线不是继续死磕 2.5D 视差**，而是做“视频为底 + Metal 特效/镜头语言 + 语音/字幕同步”的 **LiveSkin**。

---

## 1) 服务端已经能提供什么（iOS 直接用）

### 1.1 角色视频列表 API（已上线）

- **GET** `https://cling-ai.com/api/preview/videos/:agentId`
  - 返回该角色的 `previewVideos`（优先）或兼容 `coverVideoUrls`
  - 支持 query：
    - `maxScale`（尺度等级过滤 1–5）
    - `tag`（按标签过滤）
    - `limit`

返回结构（简化）：

```json
{
  "success": true,
  "data": {
    "agentId": "...",
    "videos": [
      {
        "id": "...",
        "url": "https://...mp4",
        "thumbnailUrl": "https://...jpg",
        "duration": 3.2,
        "width": 1080,
        "height": 1920,
        "isVertical": true,
        "tags": ["idle", "soft"],
        "scaleLevel": 2,
        "index": 0
      }
    ],
    "defaultIndex": 0
  }
}
```

### 1.2 Agent 里也有视频字段（兼容）

- `coverVideoUrl` / `coverVideoUrls`（旧字段）
- `previewVideos`（新字段，带 tags/尺度/排序）

> 你现在不需要再做 iOS 端“本地抠图 / Vision 推理”。视频直接播，服务端已经给足素材。

---

## 2) 为什么“视频优先”会更酷

2.5D（深度图/法线图）更适合“静态照片增强”。但你现在手上有 **真动作素材**（头发飘、手势、肢体姿态），这就是“王者荣耀动态皮肤”的核心。

**LiveSkin = 真实动作（视频） + 电影镜头语言（缩放/推拉/景深） + 特效（粒子/光斑/雨雪） + 语音/字幕同步**。

---

## 3) iOS 端应该怎么实现（最小可行到王者级）

### 3.1 MVP（最快出“动态皮肤”感）

目标：用户不晃手机，静看 3 秒，也觉得“她是活的”。

- **全屏竖屏视频**做角色主体（不要圆形头像框）
- **无缝循环**（AVPlayerLooper）
- **轻微镜头运动**（缓慢推近/微抖）
- **字幕**替代气泡：透明字幕浮在底部，说完淡出
- **TTS 默认播放**（语音是主输出）

实现建议：
- `AVQueuePlayer + AVPlayerLooper` 做无缝 loop
- 上层用 SwiftUI/UIView 叠字幕与输入框
- 视频上做一个轻微 `transform`（slow zoom 1.02x + 微 drift）

### 3.2 Pro（状态机 + 多视频切换）

把 8–10 个视频变成“皮肤动作库”：

- `idle`：默认待机循环（1–2 个）
- `react_*`：情绪/反应（开心/害羞/生气/惊讶）
- `spicy/cute/dance`：风格动作（可选）

**关键：切换必须“像游戏皮肤”一样丝滑**
- 两层 player 交叉淡入淡出（crossfade 150–250ms）
- 或者用 Metal 做 frame blend

状态机：
- IDLE：循环 idle
- LISTEN：微推近（1.04x）+ 降低特效
- SPEAK（TTS 播放中）：切到 `react_talk` 或最接近的 `react_*`
- END：回到 idle，字幕淡出

### 3.3 王者级（视频 + Metal 特效渲染管线）

如果要做到“动态皮肤 + 3D 图片质感”，建议把视频帧接进 Metal：

两种方式：
1) **简单**：`AVPlayerLayer` 播视频 + `MTKView` 叠加粒子/光斑/雨雪（很快）
2) **高级**：`AVPlayerItemVideoOutput` 把视频帧取出来，在 Metal 里做：
   - 电影级调色（曲线/对比/肤色保护）
   - Bloom/Glare（高光泛光）
   - Film grain（轻微胶片颗粒）
   - Vignette（暗角）
   - Depth-of-field（景深）——可用“首帧深度图”做近似（不追求每帧准确）

> 这里的“3D 图片质感”更多来自 **镜头语言 + 光学特效**，不是纯视差。

---

## 4) 需要你们（iOS）立刻停止的错误方向

- ❌ 用 Vision 在客户端做抠图
  - 模拟器会失败（你们日志已经证明）
  - 也没必要：我们服务端有更稳定的素材策略

---

## 5) 服务端我们还能额外提供什么（让 iOS 做得更稳更酷）

现有 `previewVideos.tags` 已经能承载“动作语义”。建议统一标签约定：

### 5.1 建议标签（直接写进 previewVideos.tags）

- `idle`：可循环待机
- `talk`：说话/口型更明显的片段（如果有）
- `react_happy` / `react_shy` / `react_angry` / `react_surprised` / `react_sad`
- `loopable`：可无缝循环
- `closeup` / `halfbody` / `fullbody`：镜头类型

iOS 选择策略：
- SPEAK：优先 `talk`，没有就用与 emotion 最匹配的 `react_*`
- IDLE：只从 `idle + loopable` 里挑

### 5.2 （可选）服务端新增一个“角色场景清单”接口

避免 iOS 做复杂策略，我们可以提供：

- **GET** `/api/agents/:id/live-skin-manifest`

返回：
- 哪些视频是 idle
- 哪些是 react
- 默认字幕位置/安全区
- 推荐滤镜参数（bloom/grain/vignette）

> 这不是必须，但能显著加速 iOS 实现，并保证不同角色风格一致。

---

## 6) 验收标准（你要的“王者荣耀动态皮肤”）

用户不触摸、不晃手机，盯着看 5 秒：

- 能感到“她在动”（视频天然达成）
- 画面有“皮肤质感”（调色 + bloom + 粒子/雨雪）
- 说话时氛围变化（字幕节奏 + 轻推近 + 反应片段切换）

如果做到这些，主观体验会直接从“2.5D 粗糙”跃迁到“游戏级动态皮肤”。

---

## 7) iOS 开发第一步怎么做（非常具体）

1. 调用 `GET /api/preview/videos/:agentId`
2. 取 `defaultIndex` 对应的 `url` 做 idle loop
3. 叠加：字幕（透明）+ 输入框
4. 实现 crossfade：两层 player 交叉淡入
5. 按 `tags` 做最简单的状态机切换

> 有问题直接发：你当前绑定的 agentId、你拿到的视频列表、你播放的 url、你切换策略。
