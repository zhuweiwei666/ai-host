# 📖 剧情模式 iOS 客户端接入指南

> 短剧式互动剧情玩法 - 替代传统对话式交互

---

## 🎯 核心概念

### 与传统对话模式的区别

| 维度 | 传统对话模式 | 剧情模式 |
|------|-------------|---------|
| **交互形式** | 一问一答的聊天气泡 | 论坛帖子式的剧情段落 |
| **内容呈现** | 纯文字为主 | 纯文字剧情 + 按需生成写真 |
| **推进方式** | 用户必须输入才能继续 | 可点击"继续"自动推进 |
| **情感系统** | 无 | 好感度系统 + 关系阶段 |
| **剧情结构** | 无结构 | 10段式节拍（钩子→高潮） |
| **付费设计** | 按条收费 | 按段收费 + 关键节点悬念 |

### 剧情节拍系统

```
进度 0-5%   → 钩子期   （开场冲突，抓住注意力）
进度 5-15%  → 升温期   （暧昧张力，欲拒还迎）
进度 15-25% → 揭示期   （揭露秘密，制造震惊）
进度 25-35% → 冲突期   （矛盾激化，情绪峰值）
进度 35-45% → 亲密期   （和解或升级，肢体接触）
进度 45-55% → 危机期   （外部威胁，可能被发现）
进度 55-65% → 告白期   （情感爆发，戳心台词）
进度 65-75% → 热恋期   （大胆亲密，尺度升级）
进度 75-85% → 考验期   （最终考验，虐中带甜）
进度 85-100%→ 高潮期   （极致释放，强烈满足）
```

### 付费点位置（制造解锁欲望）
- 20% - 身份揭示前
- 40% - 第一次亲密前
- 55% - 危机最紧张时
- 70% - 激情场景前
- 85% - 结局揭晓前

---

## 📡 API 接口文档

### Base URL
```
https://your-domain.com/api/story
```

### 通用响应格式

**成功响应：**
```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2025-12-16T15:30:00.000Z",
  "data": { ... }
}
```

**iOS 客户端注意**：如果 User-Agent 包含 `CFNetwork` 或 `Darwin`，或添加 Header `x-client: ios`，服务端会直接返回 `data` 内容（不带外层包装）。

---

### 1️⃣ 开始故事

**POST** `/start`

开始或恢复与某个角色的故事。如果已有进行中的故事会返回现有进度。

**请求：**
```json
{
  "agentId": "角色ID"
}
```

**响应：**
```json
{
  "sessionId": "故事会话ID",
  "opening": "「你...是谁？」\n\n她的眼神复杂，仿佛在看一个不该出现的人——",
  "openingImageUrl": null,
  "progress": 0,
  "state": {
    "scene": "初始场景",
    "time": "傍晚",
    "mood": "害羞",
    "clothes": "日常装扮",
    "expression": "",
    "lastAction": ""
  },
  "affection": {
    "level": 0,
    "stage": "陌生",
    "lastChange": 0
  },
  "paragraphs": [
    {
      "content": "开场文字...",
      "imageUrl": null,
      "imagePrompt": "dramatic first meeting...",
      "source": "ai",
      "createdAt": "2025-12-16T15:30:00.000Z"
    }
  ],
  "isExisting": false,
  "imageGenerating": true
}
```

**字段说明：**
- `sessionId` - 故事会话ID，后续所有操作都需要
- `opening` - 开场白文字
- `progress` - 剧情进度 0-100%
- `affection.level` - 好感度 0-100
- `affection.stage` - 关系阶段：陌生/熟悉/暧昧/热恋/深爱
- `isExisting` - true 表示恢复已有故事，false 表示新开始
- `imageGenerating` - true 表示图片正在异步生成，需要轮询

---

### 2️⃣ 继续剧情（AI自动推进）

**POST** `/continue`

让 AI 自动推进剧情，消耗 2 代币。**只返回文字，不生成图片**（图片需单独点击写真生成）。

**请求：**
```json
{
  "sessionId": "故事会话ID"
}
```

**响应：**
```json
{
  "content": "「从今天起，你是我的。」\n\n他一把抓住她的手腕，将她抵在墙角，眼神危险又缠绵。\n\n（心跳漏了一拍...这个男人...）",
  "paragraphIndex": 5,
  "progress": 28,
  "state": {
    "scene": "走廊角落",
    "mood": "紧张暧昧",
    "expression": "震惊",
    "action": "被抵在墙角"
  },
  "affection": {
    "level": 25,
    "stage": "熟悉",
    "lastChange": 5
  },
  "balance": 98,
  "cost": 2
}
```

**字段说明：**
- `content` - 本段剧情文字（已格式化，包含对话「」、动作描写、内心独白（））
- `paragraphIndex` - 段落索引
- `affection.lastChange` - 本次好感度变化（显示 +5 或 -3）
- `balance` - 扣费后剩余代币
- `cost` - 本次消耗

> ⚠️ **注意**：继续剧情不再自动生成图片，用户需点击"写真"按钮单独生成

---

### 3️⃣ 用户输入推进

**POST** `/input`

用户输入内容推进剧情，消耗 2 代币。

**请求：**
```json
{
  "sessionId": "故事会话ID",
  "userInput": "我抓住她的手不让她走"
}
```

**响应：**（格式同 `/continue`）

---

### 4️⃣ 获取故事状态

**GET** `/:sessionId`

获取完整故事状态，用于恢复页面。

**响应：**
```json
{
  "sessionId": "...",
  "agentId": "...",
  "agentName": "Yuna",
  "agentAvatar": "https://...",
  "progress": 45,
  "state": { ... },
  "paragraphs": [
    {
      "content": "段落1文字...",
      "imageUrl": "https://...",
      "source": "ai",
      "createdAt": "..."
    },
    {
      "content": "段落2文字...",
      "imageUrl": "https://...",
      "source": "user_input",
      "userInput": "用户说的话",
      "createdAt": "..."
    }
  ],
  "totalParagraphs": 12,
  "status": "active"
}
```

---

### 5️⃣ ~~轮询段落图片~~（已废弃）

> ⚠️ 剧情推进不再自动生成图片，此接口可忽略。图片通过 `/photo` 接口同步生成。

---

### 6️⃣ 生成写真（主要图片生成方式）

**POST** `/photo`

根据当前好感度和剧情状态生成角色写真，消耗 5 代币。

> ✨ **这是获取图片的主要方式**。剧情推进只返回文字，用户想看图时点击此按钮。

**请求：**
```json
{
  "sessionId": "故事会话ID"
}
```

**响应：**
```json
{
  "imageUrl": "https://...",
  "prompt": "生成使用的提示词",
  "balance": 93,
  "cost": 5
}
```

**图片风格说明：**
- 0-20% 好感度：正式、保持距离
- 20-40%：友好、放松
- 40-60%：害羞、好奇、暧昧
- 60-80%：撩人、挑逗、大胆
- 80-100%：亲密、性感、深情

---

### 7️⃣ 重新开始

**POST** `/restart`

放弃当前进度，重新开始故事。

**请求：**
```json
{
  "agentId": "角色ID"
}
```

---

### 8️⃣ 获取用户所有故事

**GET** `/user/sessions`

获取用户所有进行中的故事列表。

**响应：**
```json
[
  {
    "_id": "sessionId",
    "agentId": {
      "_id": "...",
      "name": "Yuna",
      "avatarUrls": ["https://..."]
    },
    "progress": 45,
    "totalParagraphs": 12,
    "updatedAt": "2025-12-16T15:30:00.000Z"
  }
]
```

---

## 📱 iOS UI 设计指南

### 1. 整体布局

```
┌─────────────────────────────────┐
│  ← 返回    Yuna    ⚙️ 设置      │  ← 导航栏
├─────────────────────────────────┤
│  ❤️ 好感度 45% [熟悉]  💎 98    │  ← 状态栏
│  ████████░░░░░░░░░░░           │  ← 好感度进度条
├─────────────────────────────────┤
│                                 │
│  「你...是谁？」               │  ← 角色对话
│                                 │
│  她的眼神复杂，仿佛在看一个    │  ← 动作描写
│  不该出现的人。                 │
│                                 │
│  （这个人...好像在哪见过）     │  ← 内心独白
│                                 │
│  ───────────────────────       │
│                                 │
│  「从今天起，你是我的。」      │
│                                 │
│  他一把抓住她的手腕，将她抵在  │
│  墙角，眼神危险又缠绵。        │
│                                 │
│  （心跳漏了一拍...这个男人...）│
│  ...                           │
│                                 │
├─────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌─────┐ │  ← 底部操作区
│  │ 继续 ▶ │ │ 输入 ✏️│ │ 📷 │ │
│  │  -2💎  │ │  -2💎  │ │-5💎 │ │
│  └────────┘ └────────┘ └─────┘ │
│                                 │
│  [────────────输入框──────────] │  ← 可选输入
│                                 │
└─────────────────────────────────┘

📷 = 生成写真按钮（根据当前好感度和剧情状态生成角色图片）
```

> **设计说明**：剧情推进只返回文字，速度快、体验流畅。用户想看图时点击"写真"按钮单独生成高质量图片。

### 2. 段落卡片设计

```swift
struct ParagraphCard: View {
    let paragraph: Paragraph
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 文字内容（需要解析格式）
            StoryContentView(content: paragraph.content)
            
            // 时间戳
            Text(paragraph.createdAt.relative)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(radius: 2)
    }
}

// 注意：段落不再包含图片，图片通过"写真"功能单独生成
```

### 3. 文字格式解析

剧情文字包含特殊格式，需要解析并渲染：

```swift
// 对话：用「」包裹 → 显示为较大字号 + 对话气泡样式
// 动作：普通文字 → 正常显示
// 内心独白：用（）包裹 → 斜体 + 灰色

func parseStoryContent(_ content: String) -> [StoryElement] {
    var elements: [StoryElement] = []
    let lines = content.components(separatedBy: "\n\n")
    
    for line in lines {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { continue }
        
        if trimmed.hasPrefix("「") && trimmed.hasSuffix("」") {
            // 对话
            let dialogue = String(trimmed.dropFirst().dropLast())
            elements.append(.dialogue(dialogue))
        } else if trimmed.hasPrefix("（") && trimmed.hasSuffix("）") {
            // 内心独白
            let thought = String(trimmed.dropFirst().dropLast())
            elements.append(.thought(thought))
        } else {
            // 动作/描写
            elements.append(.narration(trimmed))
        }
    }
    
    return elements
}

enum StoryElement {
    case dialogue(String)   // 对话
    case narration(String)  // 动作描写
    case thought(String)    // 内心独白
}
```

**渲染样式：**

```swift
struct StoryContentView: View {
    let elements: [StoryElement]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(elements, id: \.self) { element in
                switch element {
                case .dialogue(let text):
                    // 对话：大字号 + 引号样式
                    HStack(alignment: .top) {
                        Text("「")
                            .font(.title2)
                            .foregroundColor(.pink)
                        Text(text)
                            .font(.title3)
                            .fontWeight(.medium)
                        Text("」")
                            .font(.title2)
                            .foregroundColor(.pink)
                    }
                    
                case .narration(let text):
                    // 动作描写：正常样式
                    Text(text)
                        .font(.body)
                        .foregroundColor(.primary)
                    
                case .thought(let text):
                    // 内心独白：斜体 + 灰色
                    Text("（\(text)）")
                        .font(.body)
                        .italic()
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}
```

### 4. 好感度显示

```swift
struct AffectionView: View {
    let affection: Affection
    
    var stageColor: Color {
        switch affection.stage {
        case "陌生": return .gray
        case "熟悉": return .blue
        case "暧昧": return .pink
        case "热恋": return .red
        case "深爱": return .purple
        default: return .gray
        }
    }
    
    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Image(systemName: "heart.fill")
                    .foregroundColor(stageColor)
                Text("\(affection.level)%")
                    .fontWeight(.bold)
                Text("[\(affection.stage)]")
                    .foregroundColor(stageColor)
                
                // 变化提示
                if affection.lastChange != 0 {
                    Text(affection.lastChange > 0 ? "+\(affection.lastChange)" : "\(affection.lastChange)")
                        .font(.caption)
                        .foregroundColor(affection.lastChange > 0 ? .green : .red)
                        .animation(.easeOut)
                }
            }
            
            // 进度条
            ProgressView(value: Double(affection.level), total: 100)
                .tint(stageColor)
        }
    }
}
```

### 5. 写真展示弹窗

```swift
struct PhotoSheet: View {
    let imageUrl: String?
    let isLoading: Bool
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("写真生成中...")
                            .foregroundColor(.secondary)
                    }
                } else if let url = imageUrl {
                    AsyncImage(url: URL(string: url)) { image in
                        image.resizable()
                            .aspectRatio(contentMode: .fit)
                    } placeholder: {
                        ProgressView()
                    }
                }
            }
            .navigationTitle("写真")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
}
```

### 6. 操作按钮设计

```swift
struct ActionButtonsView: View {
    let balance: Int
    let isLoading: Bool
    let onContinue: () -> Void
    let onInput: () -> Void
    let onPhoto: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // 继续按钮
            Button(action: onContinue) {
                VStack(spacing: 4) {
                    HStack {
                        Image(systemName: "play.fill")
                        Text("继续")
                    }
                    .font(.headline)
                    
                    HStack(spacing: 2) {
                        Text("-2")
                        Image(systemName: "diamond.fill")
                            .font(.caption)
                    }
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.pink)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(isLoading || balance < 2)
            
            // 输入按钮
            Button(action: onInput) {
                VStack(spacing: 4) {
                    HStack {
                        Image(systemName: "pencil")
                        Text("输入")
                    }
                    .font(.headline)
                    
                    HStack(spacing: 2) {
                        Text("-2")
                        Image(systemName: "diamond.fill")
                            .font(.caption)
                    }
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.purple)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(isLoading || balance < 2)
            
            // 写真按钮
            Button(action: onPhoto) {
                VStack(spacing: 4) {
                    Image(systemName: "camera.fill")
                        .font(.headline)
                    
                    HStack(spacing: 2) {
                        Text("-5")
                        Image(systemName: "diamond.fill")
                            .font(.caption)
                    }
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
                .background(
                    LinearGradient(
                        colors: [.orange, .pink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(isLoading || balance < 5)
        }
    }
}
```

### 7. 写真生成逻辑

```swift
class StoryViewModel: ObservableObject {
    @Published var paragraphs: [Paragraph] = []
    @Published var currentPhoto: String?
    @Published var isGeneratingPhoto = false
    
    func generatePhoto(sessionId: String) async {
        await MainActor.run {
            isGeneratingPhoto = true
        }
        
        do {
            let result = try await api.generatePhoto(sessionId: sessionId)
            await MainActor.run {
                currentPhoto = result.imageUrl
                balance = result.balance
                isGeneratingPhoto = false
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isGeneratingPhoto = false
            }
        }
    }
}
```

> **注意**：写真是同步生成的，调用后等待返回即可，无需轮询。生成时间约 5-15 秒。

---

## 🎨 视觉设计建议

### 1. 整体风格

- **沉浸式阅读体验**：暗色/浅色主题切换
- **卡片式布局**：每段一个卡片，上图下文
- **流畅滚动**：自动滚动到最新段落
- **渐变装饰**：使用粉紫渐变作为强调色

### 2. 色彩方案

```swift
extension Color {
    static let storyPink = Color(hex: "#FF6B9D")
    static let storyPurple = Color(hex: "#C44DFF")
    static let storyGradient = LinearGradient(
        colors: [.storyPink, .storyPurple],
        startPoint: .leading,
        endPoint: .trailing
    )
}

// 关系阶段颜色
let stageColors: [String: Color] = [
    "陌生": .gray,
    "熟悉": .blue,
    "暧昧": .pink,
    "热恋": .red,
    "深爱": .purple
]
```

### 3. 动画效果

```swift
// 好感度变化动画
withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
    affection = newAffection
}

// 新段落出现动画
.transition(.asymmetric(
    insertion: .move(edge: .bottom).combined(with: .opacity),
    removal: .opacity
))

// 图片加载完成动画
.transition(.scale.combined(with: .opacity))
```

### 4. 触觉反馈

```swift
// 好感度增加
if affection.lastChange > 0 {
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
}

// 剧情高潮点
if progress >= 85 {
    UINotificationFeedbackGenerator().notificationOccurred(.success)
}
```

---

## 🔄 状态管理

### 推荐使用 MVVM + Combine

```swift
class StoryViewModel: ObservableObject {
    @Published var session: StorySession?
    @Published var paragraphs: [Paragraph] = []
    @Published var affection: Affection = .init()
    @Published var progress: Int = 0
    @Published var isLoading: Bool = false
    @Published var balance: Int = 0
    @Published var error: String?
    
    // 写真相关
    @Published var currentPhoto: String?
    @Published var isGeneratingPhoto: Bool = false
    @Published var showPhotoSheet: Bool = false
    
    private let api: StoryAPI
    
    func startStory(agentId: String) async {
        isLoading = true
        do {
            let result = try await api.startStory(agentId: agentId)
            await MainActor.run {
                session = result
                paragraphs = result.paragraphs
                affection = result.affection
                progress = result.progress
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isLoading = false
            }
        }
    }
    
    func continueStory() async {
        guard let sessionId = session?.sessionId else { return }
        isLoading = true
        
        do {
            let result = try await api.continueStory(sessionId: sessionId)
            await MainActor.run {
                // 添加新段落（纯文字，无图片）
                let newParagraph = Paragraph(
                    content: result.content,
                    source: "ai",
                    userInput: nil,
                    createdAt: Date()
                )
                paragraphs.append(newParagraph)
                
                // 更新状态
                affection = result.affection
                progress = result.progress
                balance = result.balance
                isLoading = false
                
                // 自动滚动到底部
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isLoading = false
            }
        }
    }
    
    func generatePhoto() async {
        guard let sessionId = session?.sessionId else { return }
        
        await MainActor.run {
            isGeneratingPhoto = true
            showPhotoSheet = true
            currentPhoto = nil
        }
        
        do {
            let result = try await api.generatePhoto(sessionId: sessionId)
            await MainActor.run {
                currentPhoto = result.imageUrl
                balance = result.balance
                isGeneratingPhoto = false
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isGeneratingPhoto = false
            }
        }
    }
}
```

---

## ⚠️ 注意事项

### 1. 写真生成

- 写真是同步生成的，调用后等待返回即可
- 生成时间约 5-15 秒，显示加载状态
- 失败时显示"生成失败，点击重试"

### 2. 余额不足处理

```swift
if balance < 2 {
    // 显示充值引导
    showRechargeSheet = true
}
```

### 3. 网络错误处理

- 显示友好错误提示
- 提供重试按钮
- 保存本地草稿（用户输入）

### 4. 内容缓存

- 段落内容本地缓存
- 图片使用 URLCache
- 离线时显示已加载内容

---

## 📊 数据模型

```swift
// MARK: - Models

struct StorySession: Codable {
    let sessionId: String
    let opening: String
    let progress: Int
    let state: StoryState
    let affection: Affection
    let paragraphs: [Paragraph]
    let isExisting: Bool
    let imageGenerating: Bool?
}

struct StoryState: Codable {
    let scene: String
    let time: String
    let mood: String
    let clothes: String?
    let expression: String?
    let lastAction: String?
}

struct Affection: Codable {
    var level: Int = 0
    var stage: String = "陌生"
    var lastChange: Int = 0
}

struct Paragraph: Codable, Identifiable {
    var id: String { "\(createdAt?.timeIntervalSince1970 ?? 0)" }
    let content: String
    let source: String  // "ai" or "user_input"
    let userInput: String?
    let createdAt: Date?
}

struct ContinueResponse: Codable {
    let content: String
    let paragraphIndex: Int
    let progress: Int
    let state: StoryState
    let affection: Affection
    let balance: Int
    let cost: Int
}

struct PhotoResponse: Codable {
    let imageUrl: String
    let prompt: String
    let balance: Int
    let cost: Int
}
```

---

## 🚀 快速开始清单

- [ ] 创建 `StoryAPI` 网络层
- [ ] 创建 `StoryViewModel` 状态管理
- [ ] 实现段落列表 UI（纯文字）
- [ ] 实现文字格式解析器（对话/动作/内心）
- [ ] 实现好感度显示组件
- [ ] 实现操作按钮（继续/输入/写真）
- [ ] 实现写真生成弹窗
- [ ] 实现用户输入功能
- [ ] 添加加载/错误状态
- [ ] 测试完整流程

---

如有问题，请联系后端开发。
