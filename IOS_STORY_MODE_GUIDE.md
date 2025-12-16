# 📖 剧情模式 iOS 客户端接入指南

> 短剧式互动剧情玩法 - 替代传统对话式交互

---

## 🎯 核心概念

### 与传统对话模式的区别

| 维度 | 传统对话模式 | 剧情模式 |
|------|-------------|---------|
| **交互形式** | 一问一答的聊天气泡 | 论坛帖子式的图文段落 |
| **内容呈现** | 纯文字为主 | 每段配图，视觉化叙事 |
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

让 AI 自动推进剧情，消耗 2 代币。

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
  "imageUrl": null,
  "imagePrompt": "intense eye contact, man cornering woman against wall, dramatic lighting",
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
  "isEnding": false,
  "imageGenerating": true,
  "balance": 98,
  "cost": 2
}
```

**字段说明：**
- `content` - 本段剧情文字（已格式化，包含对话「」、动作描写、内心独白（））
- `paragraphIndex` - 段落索引，用于轮询图片
- `affection.lastChange` - 本次好感度变化（显示 +5 或 -3）
- `balance` - 扣费后剩余代币
- `cost` - 本次消耗

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

### 5️⃣ 轮询段落图片

**GET** `/:sessionId/image/:index`

图片异步生成，需要轮询获取。建议间隔 2 秒，最多轮询 30 次。

**响应：**
```json
{
  "imageUrl": "https://...",
  "imageReady": true
}
```

或：
```json
{
  "imageUrl": null,
  "imageReady": false
}
```

---

### 6️⃣ 生成写真

**POST** `/photo`

根据当前好感度生成角色写真，消耗 5 代币。

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
│  ┌─────────────────────────┐   │
│  │      [段落配图]          │   │  ← 可滚动的
│  │                         │   │     段落列表
│  └─────────────────────────┘   │
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
│  ┌─────────────────────────┐   │
│  │      [下一段配图]        │   │
│  │      (加载中...)         │   │
│  └─────────────────────────┘   │
│                                 │
│  「从今天起，你是我的。」      │
│  ...                           │
│                                 │
├─────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐    │  ← 底部操作区
│  │  继续 ▶  │  │  输入 ✏️ │    │
│  │   -2💎   │  │   -2💎   │    │
│  └──────────┘  └──────────┘    │
│                                 │
│  [────────────输入框──────────] │  ← 可选输入
│                                 │
└─────────────────────────────────┘
```

### 2. 段落卡片设计

```swift
struct ParagraphCard: View {
    let paragraph: Paragraph
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 配图（16:9 或 3:4）
            if let imageUrl = paragraph.imageUrl {
                AsyncImage(url: URL(string: imageUrl)) { image in
                    image.resizable()
                        .aspectRatio(3/4, contentMode: .fit)
                        .cornerRadius(12)
                } placeholder: {
                    // 加载中占位
                    ShimmerView()
                        .aspectRatio(3/4, contentMode: .fit)
                        .cornerRadius(12)
                }
            } else if paragraph.imageGenerating {
                // 图片生成中
                GeneratingPlaceholder()
            }
            
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

### 5. 图片加载状态

```swift
struct ImageLoadingView: View {
    @State private var dotCount = 1
    
    var body: some View {
        ZStack {
            // 渐变背景
            LinearGradient(
                colors: [.pink.opacity(0.3), .purple.opacity(0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            VStack(spacing: 12) {
                // 加载动画
                ProgressView()
                    .scaleEffect(1.5)
                
                Text("画面生成中" + String(repeating: ".", count: dotCount))
                    .foregroundColor(.white)
            }
        }
        .aspectRatio(3/4, contentMode: .fit)
        .cornerRadius(12)
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                dotCount = (dotCount % 3) + 1
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
    
    var body: some View {
        HStack(spacing: 16) {
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
                    .foregroundColor(.secondary)
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
                    .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.purple)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(isLoading || balance < 2)
        }
    }
}
```

### 7. 图片轮询逻辑

```swift
class StoryViewModel: ObservableObject {
    @Published var paragraphs: [Paragraph] = []
    
    private var pollingTasks: [Int: Task<Void, Never>] = [:]
    
    func startImagePolling(sessionId: String, paragraphIndex: Int) {
        // 取消已有的轮询任务
        pollingTasks[paragraphIndex]?.cancel()
        
        pollingTasks[paragraphIndex] = Task {
            var attempts = 0
            let maxAttempts = 30
            
            while attempts < maxAttempts && !Task.isCancelled {
                do {
                    let result = try await api.getParagraphImage(
                        sessionId: sessionId,
                        index: paragraphIndex
                    )
                    
                    if result.imageReady, let url = result.imageUrl {
                        await MainActor.run {
                            // 更新段落图片
                            if paragraphIndex < paragraphs.count {
                                paragraphs[paragraphIndex].imageUrl = url
                                paragraphs[paragraphIndex].imageGenerating = false
                            }
                        }
                        return
                    }
                    
                    // 等待 2 秒后重试
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                    attempts += 1
                    
                } catch {
                    print("Polling error: \(error)")
                    break
                }
            }
            
            // 超时处理
            await MainActor.run {
                if paragraphIndex < paragraphs.count {
                    paragraphs[paragraphIndex].imageGenerating = false
                    paragraphs[paragraphIndex].imageFailed = true
                }
            }
        }
    }
}
```

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
    
    private let api: StoryAPI
    private var cancellables = Set<AnyCancellable>()
    
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
            
            // 如果有图片正在生成，开始轮询
            if let first = result.paragraphs.first, result.imageGenerating {
                startImagePolling(sessionId: result.sessionId, paragraphIndex: 0)
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
                // 添加新段落
                let newParagraph = Paragraph(
                    content: result.content,
                    imageUrl: nil,
                    imageGenerating: result.imageGenerating
                )
                paragraphs.append(newParagraph)
                
                // 更新状态
                affection = result.affection
                progress = result.progress
                balance = result.balance
                isLoading = false
            }
            
            // 开始轮询图片
            if result.imageGenerating {
                startImagePolling(
                    sessionId: sessionId,
                    paragraphIndex: result.paragraphIndex
                )
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isLoading = false
            }
        }
    }
}
```

---

## ⚠️ 注意事项

### 1. 图片加载

- 图片异步生成，通常需要 5-15 秒
- 建议使用占位图 + 轮询
- 轮询间隔 2 秒，最多 30 次
- 超时后显示"加载失败，点击重试"

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
    var imageUrl: String?
    let imagePrompt: String?
    let source: String  // "ai" or "user_input"
    let userInput: String?
    let createdAt: Date?
    
    // 本地状态
    var imageGenerating: Bool = false
    var imageFailed: Bool = false
}

struct ContinueResponse: Codable {
    let content: String
    let imageUrl: String?
    let imagePrompt: String?
    let paragraphIndex: Int
    let progress: Int
    let state: StoryState
    let affection: Affection
    let isEnding: Bool
    let imageGenerating: Bool
    let balance: Int
    let cost: Int
}

struct ImageStatusResponse: Codable {
    let imageUrl: String?
    let imageReady: Bool
}
```

---

## 🚀 快速开始清单

- [ ] 创建 `StoryAPI` 网络层
- [ ] 创建 `StoryViewModel` 状态管理
- [ ] 实现段落列表 UI
- [ ] 实现文字格式解析器
- [ ] 实现好感度显示组件
- [ ] 实现图片轮询逻辑
- [ ] 实现操作按钮
- [ ] 实现用户输入功能
- [ ] 添加加载/错误状态
- [ ] 测试完整流程

---

如有问题，请联系后端开发。
