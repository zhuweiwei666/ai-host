# 用户创建 AI 角色 - 设计方案

## 一、现有架构分析

### 1.1 当前角色创建流程

```
运营人员 → 前端控制台 → POST /api/agents (requireAdmin) → 数据库
```

**现有权限控制**：
- 所有角色管理 API 都需要 `requireAuth` + `requireAdmin`
- 只有 `role: 'admin'` 的用户可以创建/编辑角色

### 1.2 现有 Agent 模型关键字段

```javascript
{
  name: String,           // 角色名称
  gender: String,         // 性别
  style: String,          // 风格 (realistic/anime)
  avatarUrls: [String],   // 头像图片
  coverVideoUrls: [String], // 封面视频
  previewVideos: [...],   // 预览视频（LiveSkin）
  description: String,    // 描述
  systemPrompt: String,   // 系统提示词
  voiceId: String,        // 语音 ID
  status: String,         // 状态 (online/offline)
  // ... 其他字段
}
```

---

## 二、扩展设计方案

### 2.1 Agent 模型扩展

新增字段以区分官方角色和用户创建角色：

```javascript
// 新增字段
{
  // ========== 创建者信息 ==========
  creatorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null  // null 表示官方创建
  },
  creatorType: { 
    type: String, 
    enum: ['official', 'user'], 
    default: 'official' 
  },
  
  // ========== 可见性与审核 ==========
  visibility: { 
    type: String, 
    enum: ['private', 'pending', 'public', 'rejected'], 
    default: 'private'
  },
  // private: 仅创建者可见
  // pending: 待审核（用户申请公开后）
  // public: 审核通过，所有人可见
  // rejected: 审核拒绝
  
  reviewStatus: {
    submittedAt: Date,      // 提交审核时间
    reviewedAt: Date,       // 审核完成时间
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectReason: String,   // 拒绝原因
    reviewHistory: [{       // 审核历史
      action: String,       // submit/approve/reject
      at: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String
    }]
  },
  
  // ========== 用户创建限制 ==========
  isEditable: { type: Boolean, default: true }, // 是否可编辑
  
  // ========== 统计（用于推荐排序）==========
  stats: {
    totalChats: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 }
  }
}
```

### 2.2 API 设计

#### A. 用户创建角色 API

```
POST /api/agents/user-create
Authorization: Bearer <token>  // 普通用户即可

Body:
{
  name: "我的AI角色",
  gender: "female",
  style: "realistic",
  description: "角色描述...",
  avatarUrls: ["https://..."],
  systemPrompt: "你是一个...",
  // 用户创建时限制某些字段
}

Response:
{
  success: true,
  data: {
    _id: "...",
    creatorType: "user",
    visibility: "private",  // 默认私有
    ...
  }
}
```

#### B. 用户编辑自己的角色

```
PUT /api/agents/user/:id
Authorization: Bearer <token>

// 只能编辑自己创建的角色
// 限制可编辑字段
```

#### C. 用户获取自己的角色列表

```
GET /api/agents/my-agents
Authorization: Bearer <token>

Response:
{
  data: [
    { _id, name, visibility, stats, ... }
  ]
}
```

#### D. 提交审核

```
POST /api/agents/:id/submit-review
Authorization: Bearer <token>

// 将 visibility 从 private 改为 pending
```

#### E. 管理员审核 API

```
GET /api/admin/agents/pending-review
// 获取待审核列表

POST /api/admin/agents/:id/approve
// 审核通过，visibility 改为 public

POST /api/admin/agents/:id/reject
Body: { reason: "拒绝原因" }
// 审核拒绝，visibility 改为 rejected
```

### 2.3 获取角色列表 API 改造

```javascript
// GET /api/agents
// 根据用户身份返回不同内容

// 未登录/普通用户：只返回 public 的角色
{
  visibility: 'public',
  status: 'online'
}

// 管理员：返回所有角色（可筛选）
// 加上 creatorType, visibility 筛选参数
```

---

## 三、权限矩阵

| 操作 | 未登录 | 普通用户 | 创建者 | 管理员 |
|------|--------|----------|--------|--------|
| 查看 public 角色 | ✅ | ✅ | ✅ | ✅ |
| 查看 private 角色 | ❌ | ❌ | ✅(自己的) | ✅ |
| 创建角色 | ❌ | ✅ | ✅ | ✅ |
| 编辑角色 | ❌ | ❌ | ✅(自己的) | ✅ |
| 删除角色 | ❌ | ❌ | ✅(自己的) | ✅ |
| 提交审核 | ❌ | ❌ | ✅(自己的) | - |
| 审核操作 | ❌ | ❌ | ❌ | ✅ |
| 与角色对话 | ❌ | ✅(public) | ✅(自己的+public) | ✅ |

---

## 四、审核流程

```
┌─────────────┐     提交审核     ┌─────────────┐
│   private   │ ───────────────► │   pending   │
│  (仅创建者)  │                  │  (待审核)   │
└─────────────┘                  └──────┬──────┘
       ▲                                │
       │                         ┌──────┴──────┐
       │                         ▼             ▼
       │                  ┌──────────┐  ┌──────────┐
       │                  │ approved │  │ rejected │
       │                  │ (public) │  │ (拒绝)   │
       │                  └──────────┘  └────┬─────┘
       │                                     │
       └─────────────────────────────────────┘
                    修改后重新提交
```

### 4.1 审核规则

**自动预审**（可选）：
- 敏感词检测
- 图片内容审核（调用阿里云/腾讯云审核 API）
- 提示词安全检查

**人工审核**：
- 角色名称是否合规
- 头像/视频是否合规
- 描述内容是否合规
- 系统提示词是否有风险

---

## 五、实现步骤

### Phase 1: 基础功能（1-2天）

1. **扩展 Agent 模型**
   - 添加 creatorId, creatorType, visibility, reviewStatus 字段
   - 添加数据库索引

2. **新增用户创建 API**
   - `POST /api/agents/user-create`
   - `PUT /api/agents/user/:id`
   - `DELETE /api/agents/user/:id`
   - `GET /api/agents/my-agents`

3. **修改获取列表 API**
   - 根据 visibility 过滤
   - 管理员可查看全部

### Phase 2: 审核功能（1天）

1. **提交审核 API**
   - `POST /api/agents/:id/submit-review`

2. **管理员审核 API**
   - `GET /api/admin/agents/pending-review`
   - `POST /api/admin/agents/:id/approve`
   - `POST /api/admin/agents/:id/reject`

3. **审核通知**
   - 审核通过/拒绝时推送通知

### Phase 3: 前端页面（2-3天）

1. **用户端页面**
   - 创建角色表单
   - 我的角色列表
   - 编辑角色
   - 提交审核

2. **管理端页面**
   - 待审核列表
   - 审核操作

---

## 六、代码示例

### 6.1 Agent 模型更新

```javascript
// backend/src/models/Agent.js - 新增字段

// ========== 创建者与可见性 ==========
creatorId: { 
  type: mongoose.Schema.Types.ObjectId, 
  ref: 'User',
  default: null,
  index: true
},
creatorType: { 
  type: String, 
  enum: ['official', 'user'], 
  default: 'official',
  index: true
},
visibility: { 
  type: String, 
  enum: ['private', 'pending', 'public', 'rejected'], 
  default: 'public', // 官方创建默认 public，用户创建会设为 private
  index: true
},
reviewStatus: {
  submittedAt: Date,
  reviewedAt: Date,
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectReason: String,
  reviewHistory: [{
    action: { type: String, enum: ['submit', 'approve', 'reject'] },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }]
},
```

### 6.2 用户创建角色 API

```javascript
// backend/src/routes/userAgents.js

const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const { requireAuth } = require('../middleware/auth');

// 用户创建角色
router.post('/user-create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 限制用户可以设置的字段
    const allowedFields = [
      'name', 'gender', 'style', 'description',
      'avatarUrls', 'systemPrompt', 'voiceId'
    ];
    
    const agentData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        agentData[field] = req.body[field];
      }
    });
    
    // 设置用户创建标识
    agentData.creatorId = userId;
    agentData.creatorType = 'user';
    agentData.visibility = 'private'; // 默认私有
    agentData.status = 'online';
    
    const agent = new Agent(agentData);
    await agent.save();
    
    res.json({ success: true, data: agent });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 获取我的角色列表
router.get('/my-agents', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agents = await Agent.find({ creatorId: userId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: agents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 编辑我的角色
router.put('/user/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agent = await Agent.findOne({ 
      _id: req.params.id, 
      creatorId: userId 
    });
    
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found or not yours' });
    }
    
    // 如果正在审核中，不允许编辑
    if (agent.visibility === 'pending') {
      return res.status(400).json({ success: false, message: 'Cannot edit while pending review' });
    }
    
    // 限制可编辑字段
    const allowedFields = [
      'name', 'gender', 'style', 'description',
      'avatarUrls', 'systemPrompt', 'voiceId'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        agent[field] = req.body[field];
      }
    });
    
    // 如果之前被拒绝，修改后重置为 private
    if (agent.visibility === 'rejected') {
      agent.visibility = 'private';
    }
    
    await agent.save();
    res.json({ success: true, data: agent });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 提交审核
router.post('/:id/submit-review', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agent = await Agent.findOne({ 
      _id: req.params.id, 
      creatorId: userId 
    });
    
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found or not yours' });
    }
    
    if (agent.visibility !== 'private' && agent.visibility !== 'rejected') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only submit private or rejected agents for review' 
      });
    }
    
    agent.visibility = 'pending';
    agent.reviewStatus = agent.reviewStatus || {};
    agent.reviewStatus.submittedAt = new Date();
    agent.reviewStatus.reviewHistory = agent.reviewStatus.reviewHistory || [];
    agent.reviewStatus.reviewHistory.push({
      action: 'submit',
      at: new Date(),
      by: userId
    });
    
    await agent.save();
    
    // TODO: 发送通知给管理员
    
    res.json({ success: true, data: agent });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 删除我的角色
router.delete('/user/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agent = await Agent.findOneAndDelete({ 
      _id: req.params.id, 
      creatorId: userId 
    });
    
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found or not yours' });
    }
    
    res.json({ success: true, message: 'Agent deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
```

### 6.3 管理员审核 API

```javascript
// backend/src/routes/adminAgents.js

// 获取待审核列表
router.get('/pending-review', requireAuth, requireAdmin, async (req, res) => {
  const agents = await Agent.find({ visibility: 'pending' })
    .populate('creatorId', 'username email')
    .sort({ 'reviewStatus.submittedAt': 1 }); // 先提交的优先
  res.json({ success: true, data: agents });
});

// 审核通过
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const agent = await Agent.findById(req.params.id);
  if (!agent || agent.visibility !== 'pending') {
    return res.status(404).json({ success: false, message: 'No pending agent found' });
  }
  
  agent.visibility = 'public';
  agent.reviewStatus.reviewedAt = new Date();
  agent.reviewStatus.reviewerId = req.user.id;
  agent.reviewStatus.reviewHistory.push({
    action: 'approve',
    at: new Date(),
    by: req.user.id
  });
  
  await agent.save();
  
  // TODO: 发送通知给创建者
  
  res.json({ success: true, data: agent });
});

// 审核拒绝
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { reason } = req.body;
  
  const agent = await Agent.findById(req.params.id);
  if (!agent || agent.visibility !== 'pending') {
    return res.status(404).json({ success: false, message: 'No pending agent found' });
  }
  
  agent.visibility = 'rejected';
  agent.reviewStatus.reviewedAt = new Date();
  agent.reviewStatus.reviewerId = req.user.id;
  agent.reviewStatus.rejectReason = reason;
  agent.reviewStatus.reviewHistory.push({
    action: 'reject',
    at: new Date(),
    by: req.user.id,
    reason
  });
  
  await agent.save();
  
  // TODO: 发送通知给创建者（包含拒绝原因）
  
  res.json({ success: true, data: agent });
});
```

---

## 七、注意事项

### 7.1 安全考虑

1. **提示词注入防护**：用户设置的 systemPrompt 需要过滤危险内容
2. **图片审核**：用户上传的头像/视频需要内容审核
3. **频率限制**：限制用户创建角色数量（如每人最多 5 个）
4. **敏感词过滤**：角色名称、描述需要敏感词检测

### 7.2 数据隔离

1. **对话记录隔离**：用户创建的角色，其他用户与之对话的记录只有对话用户可见
2. **收益分成（可选）**：如果用户角色产生付费，可设计分成机制

### 7.3 运营考虑

1. **推荐排序**：用户创建的热门角色可以获得推荐位
2. **标签分类**：用户创建时选择分类标签
3. **举报机制**：其他用户可举报不当角色

---

## 八、数据库迁移

```javascript
// 迁移脚本：为现有角色添加默认值
db.agents.updateMany(
  { creatorType: { $exists: false } },
  { 
    $set: { 
      creatorType: 'official',
      visibility: 'public',
      creatorId: null
    } 
  }
);

// 添加索引
db.agents.createIndex({ creatorId: 1 });
db.agents.createIndex({ creatorType: 1 });
db.agents.createIndex({ visibility: 1 });
db.agents.createIndex({ visibility: 1, status: 1, creatorType: 1 });
```

---

## 九、总结

| 功能 | 官方角色 | 用户角色 |
|------|----------|----------|
| 创建者 | 管理员 | 普通用户 |
| 默认可见性 | public | private |
| 需要审核 | 否 | 是（申请公开时）|
| 可编辑者 | 管理员 | 创建者 + 管理员 |
| 高级字段 | 全部 | 部分限制 |
| 推荐权重 | 高 | 基于数据 |

这个方案可以实现：
1. ✅ 区分官方角色和用户创建角色
2. ✅ 用户创建的角色默认私有
3. ✅ 审核后才能公开
4. ✅ 权限控制清晰
5. ✅ 向后兼容现有系统
