# 🚨 重要：不需要客户端做抠图！

## 问题

看到 iOS 日志在用 Vision 框架做本地抠图：
```
iOS 17 抠图失败: Error Domain=com.apple.Vision Code=9 "Could not create inference context"
```

**这是错误的方向！**

1. iOS Vision 的抠图在模拟器上不工作（需要 Neural Engine）
2. 更重要的是：**服务端已经提供了抠好的图，不需要客户端再做！**

---

## ✅ 正确做法

### 服务端已经提供的 5 张图

```json
{
  "baseUrl": "https://.../base.png",      // ← 原图
  "depthUrl": "https://.../depth.png",    // ← 深度图（AI 生成）
  "normalUrl": "https://.../normal.png",  // ← 法线图（AI 生成）
  "cutoutUrl": "https://.../cutout.png",  // ← 抠图蒙版（AI 生成）⭐ 已经抠好了！
  "fxTextureUrl": "https://.../fx.png"    // ← FX 纹理
}
```

### cutoutUrl 就是抠好的图！

**直接下载 cutoutUrl，不需要客户端再做任何抠图操作！**

```swift
// ❌ 错误：用 Vision 本地抠图
let request = VNGenerateForegroundInstanceMaskRequest()
// ... 这会失败，而且没必要

// ✅ 正确：直接下载服务端提供的抠图
let cutoutUrl = URL(string: meta.cutoutUrl)!
let cutoutTexture = try await loadTexture(from: cutoutUrl)
```

---

## 📦 完整流程（正确版）

```swift
// 1. 获取 Agent
let agent = try await api.getAgent(id: agentId)

// 2. 检查是否有空间资产
guard let metaUrlString = agent.avatarSpatialMetaUrl,
      let metaUrl = URL(string: metaUrlString) else {
    // 降级到普通头像
    return
}

// 3. 下载 meta.json
let (metaData, _) = try await URLSession.shared.data(from: metaUrl)
let meta = try JSONDecoder().decode(SpatialMeta.self, from: metaData)

// 4. 直接下载 5 张图（全部由服务端 AI 生成，不需要客户端处理！）
async let base = loadTexture(URL(string: meta.baseUrl)!)
async let depth = loadTexture(URL(string: meta.depthUrl)!)
async let normal = loadTexture(URL(string: meta.normalUrl)!)
async let cutout = loadTexture(URL(string: meta.cutoutUrl)!)   // ⭐ 直接用！
async let fx = loadTexture(URL(string: meta.fxTextureUrl)!)

let textures = try await (base, depth, normal, cutout, fx)

// 5. 直接渲染，不需要任何本地 AI 处理
metalView.render(textures: textures, params: meta.shader)
```

---

## 🖼️ cutoutUrl 长什么样

cutoutUrl 是一张**黑白蒙版图**：
- **白色** = 人物主体
- **黑色** = 背景

```
┌─────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 黑色 = 背景
│  ░░░░░░██████████░░░░░░░░░░ │
│  ░░░░██████████████░░░░░░░░ │  ← 白色 = 人物
│  ░░██████████████████░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────┘
```

在 Shader 里直接用：
```metal
float mask = cutoutTexture.sample(sampler, uv).r;  // 1.0=人物, 0.0=背景

// 背景填充自定义颜色
float3 bgColor = float3(0.1, 0.1, 0.15);
finalColor = mix(bgColor, baseColor.rgb, mask);
```

---

## 🔗 测试：直接在浏览器打开看

这是 Ashley 的抠图蒙版，可以直接打开看：

```
https://pub-adb0752163614188a4c2683000518d5d.r2.dev/uploads/2025-12-13/1765601190057-1f14f72a.png
```

你会看到一张黑白图——**服务端已经抠好了！**

---

## 📝 总结

| 之前（错误） | 现在（正确） |
|------------|------------|
| 下载原图 → 用 Vision 抠图 | 直接下载 `cutoutUrl`，已经抠好 |
| 模拟器不支持，真机也慢 | 直接用，秒加载 |
| 客户端做 AI 推理 | 服务端已经用 AI 生成好 |

**删掉所有 Vision 抠图代码，直接用 meta.json 里的 cutoutUrl！**
