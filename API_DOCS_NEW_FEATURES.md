# AI Host 新功能 API 文档

> 更新时间: 2025-12-05
> 版本: v3.0

本文档涵盖最新开发的功能模块，包括礼物系统、衣服/场景解锁、用户画像、AI主动消息、建议回复等。

---

## 目录

1. [礼物系统](#1-礼物系统)
2. [衣服/场景系统](#2-衣服场景系统)
3. [用户画像/昵称系统](#3-用户画像昵称系统)
4. [用户类型检测系统](#4-用户类型检测系统)
5. [建议回复系统](#5-建议回复系统)
6. [AI主动消息系统](#6-ai主动消息系统)
7. [AI自进化分析系统](#7-ai自进化分析系统)
8. [告警系统](#8-告警系统)
9. [平台接入指南](#9-平台接入指南)

---

## 1. 礼物系统

### 1.1 获取礼物列表
```
GET /api/gift/list
```
**认证:** 无需

**响应:**
```json
{
  "success": true,
  "data": {
    "gifts": [
      {
        "_id": "gift_id",
        "name": "玫瑰花",
        "emoji": "🌹",
        "price": 50,
        "intimacyBonus": 5,
        "description": "一朵娇艳欲滴的玫瑰",
        "rarity": "common",
        "sortOrder": 1,
        "isActive": true
      }
    ]
  }
}
```

---

### 1.2 送礼物 ⭐
```
POST /api/gift/send
```
**认证:** 必须

**请求体:**
```json
{
  "agentId": "主播ID",
  "giftId": "礼物ID"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "gift": {
      "name": "玫瑰花",
      "emoji": "🌹",
      "price": 50
    },
    "userMessage": "[送出礼物] 🌹 玫瑰花",
    "aiResponse": "哇！🌹 谢谢你送我玫瑰花！好开心~",
    "balance": 950,
    "intimacy": 55,
    "intimacyBonus": 5
  }
}
```

**说明:**
- 自动扣除金币
- 自动增加亲密度
- AI 会根据礼物生成感谢回复
- `userMessage` 和 `aiResponse` 会自动保存到聊天记录，但不会作为 AI 上下文（避免重复提及）

---

### 1.3 获取送礼历史
```
GET /api/gift/history/:agentId
```
**认证:** 必须

**响应:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "giftName": "玫瑰花",
        "giftEmoji": "🌹",
        "price": 50,
        "intimacyBonus": 5,
        "aiResponse": "...",
        "createdAt": "2025-12-05T10:00:00.000Z"
      }
    ],
    "stats": {
      "totalGifts": 10,
      "totalSpent": 500
    }
  }
}
```

---

## 2. 衣服/场景系统

### 2.1 获取衣服列表
```
GET /api/outfit/list/:agentId
```
**认证:** 必须

**响应:**
```json
{
  "success": true,
  "data": {
    "outfits": [
      {
        "_id": "outfit_id",
        "name": "日常便装",
        "description": "简单舒适的居家服装",
        "scaleLevel": 1,
        "previewUrl": "https://...",
        "imageUrls": ["https://..."],
        "unlockType": "free",
        "unlockValue": 0,
        "isUnlocked": true
      },
      {
        "_id": "outfit_id_2",
        "name": "性感内衣",
        "description": "蕾丝黑色内衣套装",
        "scaleLevel": 4,
        "previewUrl": "https://... (模糊预览)",
        "imageUrls": ["https://..."],
        "unlockType": "intimacy",
        "unlockValue": 80,
        "isUnlocked": false
      }
    ],
    "currentOutfit": "outfit_id"
  }
}
```

**尺度等级 (scaleLevel):**
| 等级 | 说明 |
|------|------|
| 1 | 日常 - 普通服装 |
| 2 | 微露 - 短裙/吊带 |
| 3 | 性感 - 泳装/低胸 |
| 4 | 暴露 - 内衣/情趣 |
| 5 | 极限 - 完全暴露 |

**解锁类型 (unlockType):**
| 类型 | 说明 |
|------|------|
| free | 免费，默认解锁 |
| intimacy | 需达到指定亲密度 |
| coin | 需花费金币购买 |
| gift | 需累计送礼达到指定金额 |

---

### 2.2 解锁衣服
```
POST /api/outfit/unlock
```
**认证:** 必须

**请求体:**
```json
{
  "agentId": "主播ID",
  "outfitId": "衣服ID"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "outfit": { ... },
    "balance": 900,
    "intimacy": 85
  }
}
```

---

### 2.3 获取已解锁衣服
```
GET /api/outfit/unlocked/:agentId
```
**认证:** 必须

---

## 3. 用户画像/昵称系统

### 3.1 获取用户画像
```
GET /api/profile/:agentId
```
**认证:** 必须

**响应:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "userId": "...",
      "agentId": "...",
      "petName": "宝贝",
      "detectedUserType": "slow_burn",
      "intimacyScore": 75,
      "totalMessageCount": 150,
      "totalGiftCoins": 500,
      "preferredTopics": ["romance", "daily"],
      "lastActiveAt": "2025-12-05T10:00:00.000Z"
    }
  }
}
```

---

### 3.2 设置昵称
```
POST /api/profile/:agentId/pet-name
```
**认证:** 必须

**请求体:**
```json
{
  "petName": "小甜心"
}
```

**说明:** 设置后，AI 会在对话中使用这个昵称称呼用户

---

### 3.3 获取关系状态
```
GET /api/profile/:agentId/relationship
```
**认证:** 必须

**响应:**
```json
{
  "success": true,
  "data": {
    "intimacy": 75,
    "level": "亲密",
    "nextLevel": "恋人",
    "progressToNext": 75,
    "totalGifts": 10,
    "totalSpent": 500,
    "daysKnown": 7
  }
}
```

---

## 4. 用户类型检测系统

### 4.1 工作原理

在用户与 AI 前 5 轮对话中，系统会提供 3 个回复选项供用户选择：
- **选项 1 (shy)**: 含蓄、慢热
- **选项 2 (normal)**: 正常、适中
- **选项 3 (bold)**: 直接、大胆

根据用户的选择模式，系统自动判断用户类型：
- **direct**: 直接型，喜欢快速推进
- **slow_burn**: 循序渐进型，喜欢慢慢升温

### 4.2 记录用户选择
```
POST /api/chat/choice
```
**认证:** 必须

**请求体:**
```json
{
  "agentId": "主播ID",
  "choiceIndex": 2
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "round": 3,
    "isComplete": false,
    "replyOptions": [
      { "text": "嗯嗯，说得真好~", "style": "shy" },
      { "text": "然后呢？我想听更多", "style": "normal" },
      { "text": "你说得我心痒痒的~", "style": "bold" }
    ]
  }
}
```

### 4.3 在聊天响应中的体现

`POST /api/chat` 响应中会包含检测信息：
```json
{
  "success": true,
  "data": {
    "reply": "...",
    "detection": {
      "round": 3,
      "isComplete": false,
      "replyOptions": [...]
    }
  }
}
```

---

## 5. 建议回复系统

### 5.1 获取建议回复 ⭐
```
POST /api/chat/suggest-replies/:agentId
```
**认证:** 必须

**请求体:**
```json
{
  "lastAiMessage": "AI刚刚发送的消息内容",
  "intimacy": 75
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      { "text": "嗯嗯~", "style": "shy" },
      { "text": "然后呢？继续说~", "style": "normal" },
      { "text": "你说得我好心动哦~", "style": "bold" }
    ]
  }
}
```

**说明:**
- 基于 AI 上一条消息，使用 LLM 动态生成 3 个回复建议
- 建议风格会根据当前亲密度和用户类型调整
- 用户可开启/关闭此功能（前端控制）

---

## 6. AI主动消息系统

### 6.1 工作原理

AI 会在特定时机主动向用户发送消息，包括：
- **greeting**: 问候消息（早安/午安/晚安）
- **missing**: 想念消息（用户长时间未活跃）
- **life_share**: 生活分享（随机日常）
- **tease**: 撩拨消息（亲密度足够时）
- **recall**: 召回消息（流失用户）

### 6.2 在聊天历史中的体现

`GET /api/chat/history/:agentId` 响应中，主动消息会有特殊标记：
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "role": "assistant",
        "content": "早安呀~起床了吗？想你了~",
        "isProactive": true,
        "proactiveType": "greeting"
      },
      {
        "role": "user",
        "content": "早安~",
        "isProactive": false
      }
    ]
  }
}
```

### 6.3 前端显示建议

主动消息建议以不同样式显示，例如：
- 粉色背景 + 标签 "💭 来自她的问候"
- 或其他区分普通消息的视觉效果

---

## 7. AI自进化分析系统

### 7.1 获取仪表盘概览
```
GET /api/analytics/dashboard
```
**认证:** 必须 (Admin)

**响应:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 1000,
      "activeUsers": 500,
      "totalMessages": 50000,
      "avgIntimacy": 45,
      "totalRevenue": 100000
    },
    "trends": { ... }
  }
}
```

---

### 7.2 用户分析
```
GET /api/analytics/users
```
**认证:** 必须 (Admin)

---

### 7.3 A/B 测试管理
```
GET /api/analytics/ab-tests
POST /api/analytics/ab-tests
GET /api/analytics/ab-tests/:id/report
```
**认证:** 必须 (Admin)

---

### 7.4 手动触发任务
```
POST /api/analytics/tasks/run
```
**认证:** 必须 (Admin)

**请求体:**
```json
{
  "taskName": "analyzeConversations"
}
```

**可用任务:**
| 任务名 | 说明 |
|--------|------|
| analyzeConversations | 分析对话质量 |
| updateContentScores | 更新内容评分 |
| processContentLifecycle | 内容生命周期管理 |
| updateUserProfiles | 更新用户画像 |
| generateRecommendations | 生成推荐 |
| evaluateExperiments | 评估 A/B 测试 |
| updatePersonalizedThresholds | 更新个性化阈值 |
| executeRecall | 执行用户召回 |
| checkAlerts | 检查告警 |
| generateProactiveMessages | 生成主动消息 |
| cleanupProactiveMessages | 清理过期消息 |

---

## 8. 告警系统

### 8.1 获取告警列表
```
GET /api/alert/list
```
**认证:** 必须 (Admin)

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | pending/acknowledged/resolved |
| severity | string | critical/warning/info |
| limit | number | 数量限制 |

---

### 8.2 确认告警
```
POST /api/alert/:id/acknowledge
```
**认证:** 必须 (Admin)

---

### 8.3 解决告警
```
POST /api/alert/:id/resolve
```
**认证:** 必须 (Admin)

---

### 8.4 告警规则管理
```
GET /api/alert/rules
POST /api/alert/rules
PUT /api/alert/rules/:id
DELETE /api/alert/rules/:id
```
**认证:** 必须 (Admin)

---

## 9. 平台接入指南

### 9.1 Android 接入

#### 认证流程
```kotlin
// 1. 用户同步（获取 token）
val response = api.syncUser(
    externalUserId = "android_user_123",
    platform = "android"
)
val token = response.data.token

// 2. 后续请求携带 token
val request = Request.Builder()
    .url("$BASE_URL/api/chat")
    .addHeader("Authorization", "Bearer $token")
    .build()
```

#### 礼物系统接入
```kotlin
// 获取礼物列表
val gifts = api.getGiftList()

// 送礼物
val result = api.sendGift(
    agentId = "agent_id",
    giftId = "gift_id"
)

// 更新 UI
updateBalance(result.data.balance)
updateIntimacy(result.data.intimacy)
addChatMessage(result.data.userMessage, "user")
addChatMessage(result.data.aiResponse, "assistant")
```

#### 建议回复接入
```kotlin
// AI 回复后获取建议
val suggestions = api.getSuggestReplies(
    agentId = "agent_id",
    lastAiMessage = aiMessage,
    intimacy = currentIntimacy
)

// 显示建议按钮
suggestions.forEach { suggestion ->
    val button = Button(context).apply {
        text = suggestion.text
        setOnClickListener { sendMessage(suggestion.text) }
    }
    suggestionContainer.addView(button)
}
```

#### 主动消息处理
```kotlin
// 获取聊天历史时检查主动消息
val history = api.getChatHistory(agentId)

history.forEach { message ->
    if (message.isProactive) {
        // 显示特殊样式
        displayProactiveMessage(message)
    } else {
        displayNormalMessage(message)
    }
}
```

---

### 9.2 iOS 接入

#### 认证流程
```swift
// 1. 用户同步（获取 token）
let params: [String: Any] = [
    "externalUserId": "ios_user_123",
    "platform": "ios"
]

AF.request("\(BASE_URL)/api/users/sync", method: .post, parameters: params)
    .responseDecodable(of: SyncResponse.self) { response in
        if let token = response.value?.data.token {
            UserDefaults.standard.set(token, forKey: "authToken")
        }
    }

// 2. 后续请求携带 token
let headers: HTTPHeaders = [
    "Authorization": "Bearer \(token)"
]
```

#### 礼物系统接入
```swift
// 获取礼物列表
func fetchGifts() {
    AF.request("\(BASE_URL)/api/gift/list")
        .responseDecodable(of: GiftListResponse.self) { response in
            self.gifts = response.value?.data.gifts ?? []
        }
}

// 送礼物
func sendGift(agentId: String, giftId: String) {
    let params: [String: Any] = [
        "agentId": agentId,
        "giftId": giftId
    ]
    
    AF.request("\(BASE_URL)/api/gift/send", method: .post, 
               parameters: params, headers: headers)
        .responseDecodable(of: SendGiftResponse.self) { response in
            guard let data = response.value?.data else { return }
            
            self.balance = data.balance
            self.intimacy = data.intimacy
            
            // 添加消息到聊天
            self.messages.append(ChatMessage(
                role: "user", 
                content: data.userMessage,
                messageType: "gift"
            ))
            self.messages.append(ChatMessage(
                role: "assistant", 
                content: data.aiResponse,
                messageType: "gift_response"
            ))
        }
}
```

#### 建议回复接入
```swift
// AI 回复后获取建议
func fetchSuggestions(lastAiMessage: String) {
    let params: [String: Any] = [
        "lastAiMessage": lastAiMessage,
        "intimacy": self.intimacy
    ]
    
    AF.request("\(BASE_URL)/api/chat/suggest-replies/\(agentId)", 
               method: .post, parameters: params, headers: headers)
        .responseDecodable(of: SuggestionsResponse.self) { response in
            self.suggestions = response.value?.data.suggestions ?? []
        }
}

// SwiftUI 显示建议
ForEach(suggestions, id: \.text) { suggestion in
    Button(suggestion.text) {
        sendMessage(suggestion.text)
        suggestions = []
    }
    .buttonStyle(SuggestionButtonStyle(style: suggestion.style))
}
```

#### 主动消息处理
```swift
// 消息模型
struct ChatMessage: Codable {
    let role: String
    let content: String
    var isProactive: Bool?
    var proactiveType: String?
    var messageType: String?
}

// 根据消息类型显示不同样式
func messageBackground(_ message: ChatMessage) -> Color {
    if message.isProactive == true {
        return Color.pink.opacity(0.1)
    } else if message.messageType == "gift" || message.messageType == "gift_response" {
        return Color.yellow.opacity(0.1)
    }
    return Color.clear
}
```

---

### 9.3 Web 接入

#### 认证流程
```typescript
// api/index.ts
import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// 请求拦截器 - 添加 token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 用户登录
export const login = (username: string, password: string) => {
  return http.post('/api/users/login', { username, password });
};

// Google 登录
export const googleLogin = (googleId: string, email: string, name?: string) => {
  return http.post('/api/users/google-login', { google_id: googleId, email, name });
};
```

#### 礼物系统接入
```typescript
// api/gift.ts
export const getGiftList = () => http.get('/api/gift/list');

export const sendGift = (agentId: string, giftId: string) => 
  http.post('/api/gift/send', { agentId, giftId });

export const getGiftHistory = (agentId: string) => 
  http.get(`/api/gift/history/${agentId}`);

// 组件中使用
const GiftPanel: React.FC<Props> = ({ agentId, onGiftSent }) => {
  const [gifts, setGifts] = useState<Gift[]>([]);
  
  useEffect(() => {
    getGiftList().then(res => setGifts(res.data.gifts));
  }, []);
  
  const handleSendGift = async (giftId: string) => {
    const res = await sendGift(agentId, giftId);
    onGiftSent({
      userMessage: res.data.userMessage,
      aiResponse: res.data.aiResponse,
      balance: res.data.balance,
      intimacy: res.data.intimacy
    });
  };
  
  return (
    <div className="gift-panel">
      {gifts.map(gift => (
        <button key={gift._id} onClick={() => handleSendGift(gift._id)}>
          {gift.emoji} {gift.name} ({gift.price} 💎)
        </button>
      ))}
    </div>
  );
};
```

#### 建议回复接入
```typescript
// api/chat.ts
export const getSuggestReplies = (agentId: string, lastAiMessage: string, intimacy: number) =>
  http.post(`/api/chat/suggest-replies/${agentId}`, { lastAiMessage, intimacy });

// ChatPage.tsx
interface ReplyOption {
  text: string;
  style: string; // 'shy' | 'normal' | 'bold'
}

const [suggestMode, setSuggestMode] = useState(() => 
  localStorage.getItem('suggestMode') === 'true'
);
const [suggestions, setSuggestions] = useState<ReplyOption[]>([]);

// AI 回复后获取建议
const fetchSuggestions = async (lastAiMessage: string) => {
  if (!suggestMode) return;
  
  try {
    const res = await getSuggestReplies(agentId, lastAiMessage, intimacy);
    setSuggestions(res.data.suggestions);
  } catch (err) {
    console.error('Failed to fetch suggestions', err);
  }
};

// 渲染建议按钮
{suggestions.length > 0 && (
  <div className="suggestions">
    <span>选择一个建议回复：</span>
    {suggestions.map((s, i) => (
      <button 
        key={i}
        className={`suggestion-btn suggestion-${s.style}`}
        onClick={() => {
          setChatPrompt(s.text);
          handleChat();
          setSuggestions([]);
        }}
      >
        {s.text}
      </button>
    ))}
  </div>
)}
```

#### 主动消息处理
```typescript
// ChatPage.tsx
interface ChatMessage {
  role: string;
  content: string;
  audioUrl?: string;
  imageUrl?: string;
  isProactive?: boolean;
  proactiveType?: string;
  messageType?: string;
  excludeFromContext?: boolean;
}

// 获取历史时处理主动消息
useEffect(() => {
  getChatHistory(agentId).then(res => {
    setMessages(res.data.history);
  });
}, [agentId]);

// 发送消息时过滤掉礼物消息
const handleChat = async () => {
  // 过滤掉不需要作为 AI 上下文的消息
  const apiHistory = messages
    .filter(m => !m.excludeFromContext)
    .map(m => ({ role: m.role, content: m.content }));
    
  const res = await chatWithAgent(agentId, prompt, apiHistory);
  // ...
};

// 渲染消息时显示特殊样式
const renderMessage = (msg: ChatMessage) => {
  const isProactive = msg.isProactive;
  const isGift = msg.messageType === 'gift' || msg.messageType === 'gift_response';
  
  return (
    <div className={`message ${msg.role} ${isProactive ? 'proactive' : ''} ${isGift ? 'gift' : ''}`}>
      {isProactive && (
        <span className="proactive-label">
          💭 {getProactiveLabel(msg.proactiveType)}
        </span>
      )}
      <p>{msg.content}</p>
    </div>
  );
};

const getProactiveLabel = (type?: string) => {
  switch (type) {
    case 'greeting': return '来自她的问候';
    case 'missing': return '她在想你';
    case 'life_share': return '她的日常';
    case 'tease': return '撩你一下';
    default: return '主动消息';
  }
};
```

---

## 10. 视频预览系统（悬停播放）

### 10.1 获取主播预览视频列表
```
GET /api/preview/videos/:agentId
```
**认证:** 无需

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| maxScale | number | 最大尺度等级（1-5），筛选 |
| tag | string | 筛选特定标签 |
| limit | number | 返回数量限制 |

**响应:**
```json
{
  "success": true,
  "data": {
    "agentId": "xxx",
    "agentName": "Harper Lux",
    "videos": [
      {
        "id": "video_id",
        "url": "https://...",
        "thumbnailUrl": "https://...",
        "duration": 15,
        "width": 720,
        "height": 1280,
        "fileSize": 1024000,
        "format": "mp4",
        "isVertical": true,
        "sortOrder": 0,
        "tags": ["cute", "dance"],
        "scaleLevel": 1,
        "index": 0
      }
    ],
    "defaultIndex": 0,
    "totalCount": 5
  }
}
```

---

### 10.2 获取单个预览视频
```
GET /api/preview/video/:agentId/:index
```
**认证:** 无需

---

### 10.3 获取随机预览视频
```
GET /api/preview/random/:agentId
```
**认证:** 无需

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| maxScale | number | 最大尺度等级 |

---

### 10.4 获取所有主播的预览视频（列表页）
```
GET /api/preview/all
```
**认证:** 无需

**Query 参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| maxScale | number | 最大尺度等级 |
| limit | number | 返回主播数量限制 |

**响应:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "agentId": "xxx",
        "agentName": "Harper Lux",
        "avatarUrl": "https://...",
        "video": {
          "url": "https://...",
          "thumbnailUrl": "https://...",
          "duration": 15,
          "isVertical": true
        }
      }
    ],
    "totalCount": 10
  }
}
```

---

### 10.5 添加预览视频（管理员）
```
POST /api/preview/videos/:agentId
```
**认证:** 必须 (Admin)

**请求体:**
```json
{
  "url": "https://...",
  "thumbnailUrl": "https://...",
  "duration": 15,
  "width": 720,
  "height": 1280,
  "fileSize": 1024000,
  "format": "mp4",
  "isVertical": true,
  "tags": ["cute", "dance"],
  "scaleLevel": 1
}
```

---

### 10.6 更新预览视频（管理员）
```
PUT /api/preview/videos/:agentId/:videoId
```
**认证:** 必须 (Admin)

---

### 10.7 删除预览视频（管理员）
```
DELETE /api/preview/videos/:agentId/:videoId
```
**认证:** 必须 (Admin)

---

### 10.8 重新排序视频（管理员）
```
POST /api/preview/videos/:agentId/reorder
```
**认证:** 必须 (Admin)

**请求体:**
```json
{
  "videoIds": ["id1", "id2", "id3"]
}
```

---

### 10.9 迁移旧数据（管理员）
```
POST /api/preview/videos/:agentId/migrate
```
**认证:** 必须 (Admin)

**说明:** 将 `coverVideoUrls` 迁移到新的 `previewVideos` 结构

---

### 10.10 批量迁移所有主播（管理员）
```
POST /api/preview/videos/migrate-all
```
**认证:** 必须 (Admin)

---

### 10.11 平台接入示例

#### Android 悬停播放
```kotlin
// 数据类
data class PreviewVideo(
    val url: String,
    val thumbnailUrl: String,
    val duration: Int,
    val isVertical: Boolean
)

// 获取视频列表
fun getPreviewVideos(agentId: String): List<PreviewVideo> {
    val response = api.get("/api/preview/videos/$agentId")
    return response.data.videos
}

// RecyclerView ViewHolder
class AgentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val thumbnail: ImageView = itemView.findViewById(R.id.thumbnail)
    private val videoPlayer: ExoPlayer
    
    fun bind(agent: Agent, video: PreviewVideo) {
        // 显示缩略图
        Glide.with(thumbnail).load(video.thumbnailUrl).into(thumbnail)
        
        // 鼠标/触摸悬停监听
        itemView.setOnHoverListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_HOVER_ENTER -> {
                    // 开始播放视频
                    playVideo(video.url)
                }
                MotionEvent.ACTION_HOVER_EXIT -> {
                    // 停止播放，显示缩略图
                    stopVideo()
                }
            }
            true
        }
    }
    
    private fun playVideo(url: String) {
        val mediaItem = MediaItem.fromUri(url)
        videoPlayer.setMediaItem(mediaItem)
        videoPlayer.prepare()
        videoPlayer.play()
        videoPlayer.repeatMode = Player.REPEAT_MODE_ONE
    }
}
```

#### iOS 悬停播放
```swift
import AVKit

struct AgentCard: View {
    let agent: Agent
    let previewVideo: PreviewVideo?
    
    @State private var isHovering = false
    @State private var player: AVPlayer?
    
    var body: some View {
        ZStack {
            // 缩略图
            AsyncImage(url: URL(string: previewVideo?.thumbnailUrl ?? agent.avatarUrl)) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.gray
            }
            
            // 视频播放器（悬停时显示）
            if isHovering, let videoUrl = previewVideo?.url {
                VideoPlayer(player: player)
                    .onAppear {
                        player = AVPlayer(url: URL(string: videoUrl)!)
                        player?.play()
                        // 循环播放
                        NotificationCenter.default.addObserver(
                            forName: .AVPlayerItemDidPlayToEndTime,
                            object: player?.currentItem,
                            queue: .main
                        ) { _ in
                            player?.seek(to: .zero)
                            player?.play()
                        }
                    }
                    .onDisappear {
                        player?.pause()
                        player = nil
                    }
            }
        }
        .onHover { hovering in
            isHovering = hovering
        }
        // 触摸设备长按
        .onLongPressGesture(minimumDuration: 0.3) {
            isHovering = true
        } onPressingChanged: { pressing in
            if !pressing {
                isHovering = false
            }
        }
    }
}

// 获取预览视频
func fetchPreviewVideos(agentId: String) async throws -> [PreviewVideo] {
    let response = try await AF.request("\(baseURL)/api/preview/videos/\(agentId)")
        .serializingDecodable(PreviewVideosResponse.self)
        .value
    return response.data.videos
}
```

#### Web 悬停播放
```typescript
// React 组件
import React, { useState, useRef, useEffect } from 'react';

interface PreviewVideo {
  url: string;
  thumbnailUrl: string;
  duration: number;
  isVertical: boolean;
}

interface AgentCardProps {
  agentId: string;
  agentName: string;
  avatarUrl: string;
  previewVideo?: PreviewVideo;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agentId, agentName, avatarUrl, previewVideo 
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (isHovering && videoRef.current && previewVideo) {
      videoRef.current.play().catch(console.error);
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering, previewVideo]);
  
  return (
    <div 
      className="agent-card"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      // 移动端长按
      onTouchStart={() => setIsHovering(true)}
      onTouchEnd={() => setIsHovering(false)}
    >
      {/* 缩略图 */}
      <img 
        src={previewVideo?.thumbnailUrl || avatarUrl}
        alt={agentName}
        className={`thumbnail ${isHovering ? 'hidden' : ''}`}
      />
      
      {/* 视频 */}
      {previewVideo && (
        <video
          ref={videoRef}
          src={previewVideo.url}
          className={`preview-video ${isHovering ? 'visible' : ''}`}
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
      
      <div className="agent-name">{agentName}</div>
    </div>
  );
};

// 获取所有主播的预览视频
export const getAllPreviewVideos = async (maxScale?: number) => {
  const params = maxScale ? `?maxScale=${maxScale}` : '';
  return http.get(`/api/preview/all${params}`);
};

// 获取单个主播的预览视频列表
export const getAgentPreviewVideos = (agentId: string) => 
  http.get(`/api/preview/videos/${agentId}`);

// 列表页使用
const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<AgentCardProps[]>([]);
  
  useEffect(() => {
    getAllPreviewVideos(3).then(res => { // 最大尺度 3
      setAgents(res.data.agents.map(a => ({
        agentId: a.agentId,
        agentName: a.agentName,
        avatarUrl: a.avatarUrl,
        previewVideo: a.video
      })));
    });
  }, []);
  
  return (
    <div className="agent-grid">
      {agents.map(agent => (
        <AgentCard key={agent.agentId} {...agent} />
      ))}
    </div>
  );
};
```

**CSS 样式:**
```css
.agent-card {
  position: relative;
  width: 200px;
  height: 300px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
}

.thumbnail.hidden {
  opacity: 0;
}

.preview-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.preview-video.visible {
  opacity: 1;
}

.agent-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  color: white;
  font-weight: bold;
}
```

---

## 数据模型参考

### Message 消息模型
```javascript
{
  agentId: ObjectId,       // AI 主播 ID
  userId: String,          // 用户 ID
  role: 'user' | 'assistant' | 'system',
  content: String,
  audioUrl: String,        // 语音 URL
  imageUrl: String,        // 图片 URL
  
  // 消息类型
  messageType: 'normal' | 'gift' | 'gift_response' | 'system',
  excludeFromContext: Boolean,  // 是否排除出 AI 上下文
  
  // 主动消息
  isProactive: Boolean,
  proactiveType: 'greeting' | 'missing' | 'life_share' | 'anniversary' | 'recall' | 'mood' | 'tease',
  
  // A/B 测试
  experimentId: ObjectId,
  variantId: String,
  
  createdAt: Date
}
```

### UserProfile 用户画像模型
```javascript
{
  userId: String,
  agentId: ObjectId,
  
  // 昵称系统
  petName: String,              // 用户给 AI 起的昵称
  aiNicknameForUser: String,    // AI 给用户起的昵称
  
  // 用户类型检测
  detectedUserType: 'direct' | 'slow_burn' | 'unknown',
  choiceHistory: [Number],      // 选择历史 [0, 1, 2, ...]
  detectionRound: Number,       // 当前检测轮数
  isDetectionComplete: Boolean, // 是否完成检测
  
  // 统计
  intimacyScore: Number,
  totalMessageCount: Number,
  totalGiftCoins: Number,
  totalGiftCount: Number,
  
  // 偏好分析
  preferredTopics: [String],
  preferredContentScale: Number,
  preferredResponseLength: String,
  
  // 行为模式
  avgSessionDuration: Number,
  avgMessagesPerSession: Number,
  peakActiveHours: [Number],
  
  // 流失预测
  churnRiskScore: Number,
  lastChurnPrediction: Date,
  
  lastActiveAt: Date,
  createdAt: Date
}
```

### Gift 礼物模型
```javascript
{
  name: String,
  emoji: String,
  price: Number,
  intimacyBonus: Number,
  description: String,
  rarity: 'common' | 'rare' | 'epic' | 'legendary',
  responseTemplates: [String],  // AI 回复模板
  sortOrder: Number,
  isActive: Boolean
}
```

### Outfit 衣服/场景模型
```javascript
{
  agentId: ObjectId,
  name: String,
  description: String,
  scaleLevel: Number,           // 1-5 尺度等级
  previewUrl: String,           // 预览图（可模糊）
  imageUrls: [String],          // 完整图片
  unlockType: 'free' | 'intimacy' | 'coin' | 'gift',
  unlockValue: Number,
  sortOrder: Number,
  isActive: Boolean
}
```

### PreviewVideo 预览视频模型
```javascript
{
  url: String,                  // 视频 URL
  thumbnailUrl: String,         // 缩略图/封面图 URL
  duration: Number,             // 视频时长（秒）
  width: Number,                // 视频宽度
  height: Number,               // 视频高度
  fileSize: Number,             // 文件大小（字节）
  format: String,               // 视频格式，默认 'mp4'
  isVertical: Boolean,          // 是否竖屏，默认 true
  sortOrder: Number,            // 排序顺序
  tags: [String],               // 标签：如 'sexy', 'cute', 'dance'
  scaleLevel: Number            // 尺度等级 1-5
}
```

---

## 错误码补充

| Code | 说明 |
|------|------|
| INSUFFICIENT_FUNDS | 余额不足 |
| GIFT_NOT_FOUND | 礼物不存在 |
| OUTFIT_NOT_FOUND | 衣服不存在 |
| ALREADY_UNLOCKED | 已经解锁 |
| UNLOCK_REQUIREMENT_NOT_MET | 未满足解锁条件 |
| SUGGESTION_FAILED | 建议生成失败 |

---

## 更新日志

### v3.0 (2025-12-05)
- 新增礼物系统
- 新增衣服/场景解锁系统
- 新增用户画像/昵称系统
- 新增用户类型检测（5轮检测）
- 新增建议回复系统（LLM 动态生成）
- 新增 AI 主动消息系统
- 新增 AI 自进化分析系统
- 新增告警系统
- 修复礼物消息导致 AI 无限循环问题
- 修复纯黑图片检测过滤
