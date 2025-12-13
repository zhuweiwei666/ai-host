## Cling AI iOS App API 接口梳理（可直接对接）

- **Base URL**：`https://cling-ai.com`
- **API 前缀**：`/api`
- **鉴权**：除注明 Public 的接口外，默认需要
  - `Authorization: Bearer <JWT>`
- **响应包裹（统一格式）**

成功：
```json
{ "success": true, "statusCode": 200, "timestamp": "...", "data": {} }
```

失败：
```json
{ "success": false, "statusCode": 400, "code": "BAD_REQUEST", "message": "...", "timestamp": "...", "details": {} }
```

- **常见错误码建议处理**
  - **401 UNAUTHORIZED / INVALID_TOKEN / TOKEN_EXPIRED**：清理 token → 重新 `/users/sync`
  - **402 PAYMENT_REQUIRED（INSUFFICIENT_FUNDS）**：弹出充值/看广告入口
  - **429 TOO_MANY_REQUESTS**：退避重试

---

## 1) 认证（iOS 外部用户推荐）

### 1.1 Sync（创建/登录并拿 JWT）
- **POST** `/api/users/sync`
- **Body**：

```json
{
  "externalUserId": "u_123",
  "platform": "ios",
  "externalAppId": "optional",
  "email": "optional",
  "phone": "optional",
  "username": "optional"
}
```

- **Response.data**：
  - `token: string`（JWT）
  - `balance: number`
  - `isNew: boolean`
  - `user: { _id, externalUserId, username, platform, userType, role }`

**cURL**：
```bash
curl -sS -X POST "https://cling-ai.com/api/users/sync" \
  -H "Content-Type: application/json" \
  -d '{"externalUserId":"u_123","platform":"ios"}'
```

---

## 2) Agents（角色）

### 2.1 获取 Agent 列表（Public）
- **GET** `/api/agents`
- **Query（可选）**：
  - `status=online|offline`
  - `style=realistic|anime|all`

**cURL**：
```bash
curl -sS "https://cling-ai.com/api/agents?status=online&style=realistic"
```

### 2.2 获取 Agent 详情（Public）
- **GET** `/api/agents/:id`

**与 iOS/Avatar 相关关键字段**：
- `avatarUrl`（旧字段）
- `avatarUrls[]`（新字段）
- `privatePhotoUrl`（亲密度高时视频生成可能用）
- `avatarSpatialMetaUrl`（空间头像资产包 meta.json）
- `avatarSpatialShader`（全局覆盖参数：fx、眨眼、背景色等）

**cURL**：
```bash
curl -sS "https://cling-ai.com/api/agents/693ae1c1ff637cfaca595f44"
```

---

## 3) Chat（聊天）
> 说明：`backend/src/routes/chat.js` 里对整个 `/api/chat/*` 做了 `requireAuth`，所以都要带 `Authorization: Bearer`。

### 3.1 获取聊天历史
- **GET** `/api/chat/history/:agentId`
- **Response.data**：
  - `history: ChatMessage[]`（按时间正序）
  - `intimacy: number`
  - `greeting?: { content, withImage? }`（首次会话可能返回）

**cURL**：
```bash
curl -sS -X GET "https://cling-ai.com/api/chat/history/693ae1c1ff637cfaca595f44" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.2 发送消息（核心）
- **POST** `/api/chat`
- **Body**：

```json
{
  "agentId": "693ae1c1ff637cfaca595f44",
  "prompt": "你好呀",
  "history": [
    { "role": "user", "content": "hi" },
    { "role": "assistant", "content": "hello" }
  ],
  "skipImageGen": true
}
```

- **Response.data**：
  - `reply: string`（AI 回复文本，iOS 主要用这个字段）
  - `audioUrl?: string`
  - `imageUrl?: string`
  - `balance?: number`
  - `intimacy?: number`
  - `detection?: { round, userType, isComplete, replyOptions }`

**cURL**：
```bash
curl -sS -X POST "https://cling-ai.com/api/chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":"693ae1c1ff637cfaca595f44",
    "prompt":"你今天穿的是什么呀？",
    "history":[{"role":"user","content":"hi"}],
    "skipImageGen":true
  }'
```

### 3.3 TTS（把文本转语音）
- **POST** `/api/chat/tts`
- **Body**：`{ "agentId": "...", "text": "..." }`
- **Response.data**：`{ audioUrl, balance }`

**cURL**：
```bash
curl -sS -X POST "https://cling-ai.com/api/chat/tts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"693ae1c1ff637cfaca595f44","text":"你好呀"}'
```

### 3.4 用户画像（长期记忆）
- **GET** `/api/chat/profile/:agentId`
- **Response.data**：`{ profile }`

### 3.5 手动添加记忆
- **POST** `/api/chat/profile/:agentId/memory`
- **Body**：`{ content: string, category?: string }`

### 3.6 用户类型侦测状态
- **GET** `/api/chat/detection-status/:agentId`
- **Response.data**：`{ ...status, replyOptions: [{text,style}] }`

### 3.7 记录用户三选一选择
- **POST** `/api/chat/record-choice/:agentId`
- **Body**：`{ choiceIndex: 0|1|2 }`

### 3.8 回复建议（3 条）
- **POST** `/api/chat/suggest-replies/:agentId`
- **Body**：`{ lastAiMessage: string, intimacy?: number }`
- **Response.data**：`{ suggestions: [{text,style}] }`

---

## 4) Spatial Avatar（空间头像 / Metal 渲染输入）

### 4.1 meta.json（渲染入口）
- 从 `Agent.avatarSpatialMetaUrl` 下载（普通 GET）。
- 常见结构：
  - `baseUrl, depthUrl, normalUrl, cutoutUrl, fxTextureUrl`
  - `shader`（默认参数）

**参数优先级建议（iOS/Metal）**：
1. `Agent.avatarSpatialShader`（服务器全局覆盖）
2. `meta.shader`
3. 客户端默认值

### 4.2 生成空间资产包（AI）
- **POST** `/api/avatar-assets/generate`
- **Body**：

```json
{ "imageUrl": "https://.../avatar.png", "agentId": "optional", "bindToAgent": true }
```

- **Response.data**（重要字段）：
  - `metaUrl`（可保存到 Agent）
  - `meta`（meta.json 内容）
  - `depthUrl/normalUrl/cutoutUrl/fxTextureUrl/baseUrl`

> 注意：`bindToAgent=true` 需要管理员。

### 4.2.1 批量为所有主播生成空间资产包（Admin / 运维用）
- **POST** `/api/avatar-assets/generate-all`
- **Body**：
```json
{ "force": false }
```
- 说明：
  - `force=false`：只生成未绑定 `avatarSpatialMetaUrl` 的主播（推荐）
  - `force=true`：全部重新生成（高成本）
- **Response.data**：`{ total, ok, skipped, failed, results[] }`

### 4.3 绑定 metaUrl / 保存 shader（全局，Admin）
- **POST** `/api/agents/:id/avatar-spatial-meta`
- **Body**（二选一或同时传）：

绑定/更新 metaUrl：
```json
{ "metaUrl": "https://.../meta.json" }
```

只保存 shader 参数（不换 meta）：
```json
{
  "shader": {
    "bgColor": "#F2F2F2",
    "fxStrength": 0.6,
    "fxSpeed": 1.0,
    "fxScale": 1.35,
    "focusX": 0.5,
    "focusY": 0.7,
    "blinkStrength": 0.8
  }
}
```

清除：
```json
{ "metaUrl": "", "shader": null }
```

---

## 5) Wallet（余额 / 广告奖励 / IAP）
> `backend/src/routes/wallet.js`：整组 `router.use(requireAuth)`，都要 Bearer。

### 5.1 获取余额
- **GET** `/api/wallet/balance`
- **Response.data**：`{ balance: number }`

### 5.2 看广告奖励（防重复）
- **POST** `/api/wallet/reward/ad`
- **Body**：`{ traceId: string }`
- **Response.data**：`{ balance }`
- 可能错误：`DUPLICATE_REWARD`（409）

### 5.3 IAP 验签并发币
- **POST** `/api/wallet/verify-purchase`
- **Body（iOS）**：
```json
{ "platform":"ios", "receiptData":"<base64_receipt>" }
```
- **Body（Android）**：
```json
{ "platform":"android", "purchaseToken":"...", "productId":"...", "packageName":"optional" }
```
- **Response.data**：
  - `verified: true`
  - `alreadyProcessed: boolean`
  - `coins: number`
  - `balance: number`
  - `transactionId: string`

### 5.4 获取 IAP 商品列表
- **GET** `/api/wallet/products?platform=ios|android`

### 5.5 获取交易记录
- **GET** `/api/wallet/transactions?limit=20&page=1`

### 5.6 账本（Ledger）流水（用于客服/对账/审计）
- **GET** `/api/wallet/ledger?limit=50&cursor=<optional>`
- **Response.data**：
  - `rows: LedgerEntry[]`（按时间倒序）
  - `nextCursor?: string`

### 5.7 Billing 商品目录（后端定义，订阅/充值统一入口）
- **GET** `/api/billing/products?platform=ios|android|stripe|internal`
- **Response.data**：`{ products: Product[] }`

### 5.8 Billing 权益（是否订阅、套餐、折扣）
- **GET** `/api/billing/entitlements`
- **Response.data**：
  - `balance: number`
  - `isSubscriber: boolean`
  - `plan?: { provider, productId, status, currentPeriodStart, currentPeriodEnd, autoRenew, tier, monthlyCredits, discountPercent }`

### 5.9 Billing 充值验签并入账（推荐新接口）
- **POST** `/api/billing/purchase/verify`
- **Body（iOS）**：
```json
{ "platform":"ios", "receiptData":"<base64_receipt>" }
```
- **Body（Android）**：
```json
{ "platform":"android", "purchaseToken":"...", "productId":"...", "packageName":"optional" }
```
- **Response.data**：`{ verified, alreadyProcessed, coins, balance, transactionId }`

### 5.10 Billing 订阅恢复/绑定（iOS）
> iOS App 启动或用户点击“恢复购买”时调用，用于把订阅状态落到服务器，并按套餐发放月度额度（Ledger 幂等）。

- **POST** `/api/billing/subscription/restore`
- **Body**：
```json
{ "platform":"ios", "receiptData":"<base64_receipt>" }
```
- **Response.data**：
  - `subscription: { provider, providerSubId, productId, status, currentPeriodStart, currentPeriodEnd, autoRenew }`
  - `balance: number`

### 5.11 Billing Webhooks（服务端异步同步订阅/支付状态）
- **POST** `/api/billing/webhooks/apple`
  - **Body**：`{ "signedPayload": "<jws>" }`
  - 推荐加 Header：`x-webhook-secret: <APPLE_WEBHOOK_SECRET>`
- **POST** `/api/billing/webhooks/google`（占位）
- **POST** `/api/billing/webhooks/stripe`（占位）

### 5.12 Admin 发放/扣减（运营补偿）
- **POST** `/api/admin/wallet/grant`
- **Body**：
```json
{ "userId":"...", "delta": 500, "reason":"compensation", "idempotencyKey":"optional" }
```
- `delta` 可正可负（负数相当于扣减）

---

## 6) Gift（礼物）

### 6.1 礼物列表（Public）
- **GET** `/api/gift/list`
- **Response.data**：`{ gifts: Gift[] }`

### 6.2 送礼（扣费 + 亲密度）
- **POST** `/api/gift/send`
- **Body**：`{ agentId, giftId }`
- **Response.data**：`{ userMessage, aiResponse, balance, intimacy, intimacyBonus, gift }`

### 6.3 送礼历史
- **GET** `/api/gift/history/:agentId`
- **Response.data**：`{ logs, stats: { totalGifts, totalSpent } }`

---

## 7) Outfit（私房照/衣服/场景）

### 7.1 列表（含解锁状态）
- **GET** `/api/outfit/list/:agentId`
- **Response.data**：`{ outfits: [...], intimacy }`
- 说明：未解锁时 `imageUrls/videoUrls` 会返回空。

### 7.2 解锁
- **POST** `/api/outfit/unlock`
- **Body**：`{ agentId, outfitId }`
- **Response.data**：`{ outfit, balance?, message }`

### 7.3 获取已解锁
- **GET** `/api/outfit/unlocked/:agentId`

> outfit.js 中还有 admin/生成图片相关接口（`/generate-images/:outfitId`, `/generate-all/:agentId`, `/admin/list/:agentId`），iOS 客户端通常不需要对接。

---

## 8) Profile（昵称/关系）

### 8.1 获取用户画像
- **GET** `/api/profile/:agentId`
- **Response.data**：`{ profile, intimacy, daysTogether }`

### 8.2 设置专属昵称
- **POST** `/api/profile/:agentId/pet-name`
- **Body**：`{ petName?: string, userCallsMe?: string }`

### 8.3 获取关系概览
- **GET** `/api/profile/:agentId/relationship`
- **Response.data**：`{ intimacy, daysTogether, relationshipTitle, petName, userCallsMe, totalMessages, totalGiftCount, totalGiftCoins }`

---

## 9) 图片生成

### 9.1 生成图片（Img2Img）
- **POST** `/api/generate-image`
- **Body（必填）**：
  - `agentId: string`
  - `description: string`
- **Body（可选）**：
  - `count: number = 1`
  - `width: number = 768`
  - `height: number = 1152`
  - `skipBalanceCheck: boolean = false`
  - `userId?: string`（不建议客户端传，通常靠 token）

- **扣费**：`10 coins * count`（除非 `skipBalanceCheck`）
- **Response.data**：`{ url, urls, balance, intimacy }`

---

## 10) 视频生成（可能被开关禁用）

### 10.1 生成视频
- **POST** `/api/generate-video`
- **Body**：
  - `prompt?: string`
  - `imageUrl?: string`（可不传，会按 intimacy 选择 avatar/privatePhoto）
  - `agentId?: string`
  - `fastMode?: boolean`（true: 20 coins，false: 50 coins）

- **Response.data**：`{ url, balance, intimacy }`
- **注意**：如果 `ENABLE_VIDEO_FEATURE != true`，会返回 503。

---

## 11) 资源代理（Web 需要；iOS 通常不需要）
- **GET** `/api/oss/proxy?url=<encoded>`
- 作用：避免浏览器 CORS；iOS 原生可直接拉 R2/OSS 资源。

---

## Swift 对接模板（建议）

### 1) ApiEnvelope
```swift
struct ApiEnvelope<T: Decodable>: Decodable {
    let success: Bool
    let statusCode: Int
    let timestamp: String
    let data: T?
    let code: String?
    let message: String?
    let details: JSONValue?
}

enum JSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported JSON")
    }
}
```

### 2) URLSession 请求骨架（Bearer + 错误分流）
```swift
final class APIClient {
    let baseURL: URL
    var token: String?

    init(baseURL: URL, token: String? = nil) {
        self.baseURL = baseURL
        self.token = token
    }

    func request<T: Decodable>(_ path: String, method: String = "GET", body: Encodable? = nil, timeout: TimeInterval = 30) async throws -> T {
        var url = baseURL
        url.append(path: path)

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = timeout
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, resp) = try await URLSession.shared.data(for: req)
        let http = resp as? HTTPURLResponse

        let decoded = try JSONDecoder().decode(ApiEnvelope<T>.self, from: data)
        if decoded.success, let d = decoded.data {
            return d
        }

        // 统一错误：优先用服务端 envelope
        let status = decoded.statusCode
        let code = decoded.code ?? "UNKNOWN"
        let msg = decoded.message ?? "Request failed"

        // 你可以在这里按 status 做分流：401/402/429
        throw APIError(status: status, code: code, message: msg)
    }
}

struct APIError: Error {
    let status: Int
    let code: String
    let message: String
}

struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init(_ encodable: Encodable) {
        self.encodeFunc = encodable.encode
    }
    func encode(to encoder: Encoder) throws { try encodeFunc(encoder) }
}
```

---

## 12) Health Check（监控用）

### 12.1 健康检查
- **GET** `/api/health`
- **Public**（无需认证）
- **Response**：
```json
{
  "status": "ok",
  "timestamp": "2025-12-13T14:00:00.000Z",
  "uptime": 3600.5,
  "memory": { "rss": 123456789, "heapTotal": 98765432, "heapUsed": 87654321 }
}
```
- **用途**：Uptime 监控（如 UptimeRobot、Cloudflare Health Checks）

---

## 备注：最小可用清单（iOS MVP）
- `/api/users/sync` → 拿 token
- `/api/agents` + `/api/agents/:id`
- `/api/chat/history/:agentId` + `/api/chat`
- `/api/chat/tts`（可选）
- `/api/wallet/balance` + `/api/wallet/reward/ad`（可选）
- `avatarSpatialMetaUrl` + meta.json（Metal/渲染层）
