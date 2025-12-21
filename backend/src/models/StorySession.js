/**
 * StorySession 模型
 * 
 * 存储用户与角色的"故事线"状态，用于论坛式剧情模式
 */

const mongoose = require('mongoose');

const StorySessionSchema = new mongoose.Schema({
  // 用户 ID
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  // 角色 ID
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true, 
    index: true 
  },
  
  // 剧情进度 (0-100)
  progress: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100
  },
  
  // 好感度系统
  affection: {
    level: { type: Number, default: 0, min: 0, max: 100 },  // 好感度 0-100
    stage: { 
      type: String, 
      enum: ['陌生', '熟悉', '暧昧', '热恋', '深爱'], 
      default: '陌生' 
    },
    lastChange: { type: Number, default: 0 },  // 上次变化值（用于显示 +5 等）
  },
  
  // 当前场景状态
  state: {
    scene: { type: String, default: '初始场景' },     // 当前场景
    time: { type: String, default: '傍晚' },          // 时间
    mood: { type: String, default: '害羞' },          // 角色心情
    action: { type: String, default: '' },            // 角色当前动作
    clothes: { type: String, default: '' },           // 角色当前穿着
    expression: { type: String, default: '' },        // 角色表情
    lastAction: { type: String, default: '' },        // 上一段结尾（用于承接）

    // ===== v2: 结构化剧情状态（上下文工程） =====
    workflow: { type: String, default: 'v1' },        // v1/v2
    beat: {
      type: String,
      enum: ['opening', 'escalation', 'reveal', 'crisis', 'payoff'],
      default: 'opening'
    },
    conflict: { type: String, default: '' },          // 当前冲突焦点
    stakes: { type: String, default: '' },            // 当前代价/风险
    secrets: [{ type: String }],                      // 已知秘密/线索（可增长）
    openLoops: [{ type: String }],                    // 未收束伏笔（3-7条）
    canonFacts: [{ type: String }],                   // 不可违背事实（简短）
    summary: { type: String, default: '' },           // 滚动摘要（短）

    // v3: 主线推进器（轻量）
    objective: {
      title: { type: String, default: '' },            // 本章目标（短）
      detail: { type: String, default: '' },           // 目标补充（短）
      updatedAt: { type: Date },                       // 目标更新时间
    },
    locationHistory: [{
      scene: { type: String },                          // 最近场景（短）
      at: { type: Date, default: Date.now },
    }],
    eventTypeHistory: [{ type: String }],               // 最近事件类型（用于防模板化）

    // 章节与付费触发（混合变现）
    chapter: {
      index: { type: Number, default: 0 },            // 当前章编号（从0开始）
      size: { type: Number, default: 20 },            // 每章段落数（默认20）
    },
    pay: {
      pending: {
        type: { type: String },                       // chapter_unlock/photo
        chapterIndex: { type: Number },
        reason: { type: String },                     // 付费点文案（短）
        createdAt: { type: Date },
      },
      unlockedChapterIndex: { type: Number, default: 0 }, // 已解锁到的章节（包含）
    },
  },
  
  // 已发生的关键事件（用于一致性）
  events: [{
    type: String
  }],
  
  // 历史段落（存储最近 N 段用于上下文）
  paragraphs: [{
    content: { type: String, required: true },
    imageUrl: { type: String },   // 每层楼的配图 URL
    imagePrompt: { type: String }, // 图片生成使用的 prompt（旧版兼容）
    imageCharge: { type: Number, default: 0 },        // 写真模式额外扣费（用于失败补偿）
    imageChargeRefunded: { type: Boolean, default: false },
    imageGenerating: { type: Boolean, default: false }, // 图片是否正在生成
    imageFailed: { type: Boolean, default: false },     // 图片生成是否失败
    sceneData: {                   // 场景数据（用于 GPT Image 1.5 生成）
      clothing: { type: String },
      pose: { type: String },
      expression: { type: String },
      background: { type: String },
      lighting: { type: String },
      mood: { type: String },
    },
    // v2: 低阅读门槛的按钮式分支（可选）
    choices: [{
      text: { type: String },
      value: { type: String },
      kind: { type: String, enum: ['choice', 'cta'], default: 'choice' },
    }],
    source: { type: String, enum: ['ai', 'user_input'], default: 'ai' }, // 段落来源
    userInput: { type: String },  // 如果是响应用户输入，记录用户说的话
    createdAt: { type: Date, default: Date.now },
  }],

  // v2: 结构化记忆事件（轻量检索用）
  memoryEvents: [{
    tags: [{ type: String }],
    people: [{ type: String }],
    place: { type: String },
    stakes: { type: String },
    secret: { type: String },
    intensity: { type: Number, min: 0, max: 10, default: 0 },
    paragraphIndex: { type: Number },
    createdAt: { type: Date, default: Date.now },
  }],
  
  // 最大存储段落数（超过会删除最早的）
  maxParagraphs: { type: Number, default: 50 },
  
  // 统计
  totalParagraphs: { type: Number, default: 0 },
  totalUserInputs: { type: Number, default: 0 },
  
  // 故事状态
  status: { 
    type: String, 
    enum: ['active', 'completed', 'abandoned'], 
    default: 'active',
    index: true
  },
  
  // 完成时间（如果已完成）
  completedAt: { type: Date },
  
}, { timestamps: true });

// 复合唯一索引：每个用户对每个角色只有一个活跃的故事
StorySessionSchema.index({ userId: 1, agentId: 1, status: 1 });

// 添加段落的方法（v2 支持 meta，如 choices/sceneData）
StorySessionSchema.methods.addParagraph = function(
  content,
  source = 'ai',
  userInput = null,
  imageUrl = null,
  imagePrompt = null,
  meta = null
) {
  this.paragraphs.push({
    content,
    imageUrl,
    imagePrompt,
    ...(meta && typeof meta === 'object' ? meta : {}),
    source,
    userInput,
    createdAt: new Date(),
  });
  
  this.totalParagraphs += 1;
  if (source === 'user_input') {
    this.totalUserInputs += 1;
  }
  
  // 如果超过最大段落数，删除最早的
  while (this.paragraphs.length > this.maxParagraphs) {
    this.paragraphs.shift();
  }
  
  return this;
};

// 获取最近 N 段内容（用于构建上下文）
StorySessionSchema.methods.getRecentParagraphs = function(n = 3) {
  return this.paragraphs.slice(-n);
};

// 更新状态
StorySessionSchema.methods.updateState = function(newState) {
  if (newState.scene) this.state.scene = newState.scene;
  if (newState.time) this.state.time = newState.time;
  if (newState.mood) this.state.mood = newState.mood;
  if (newState.clothes) this.state.clothes = newState.clothes;
  if (newState.lastAction) this.state.lastAction = newState.lastAction;
  if (newState.action) this.state.action = newState.action;
  if (newState.expression) this.state.expression = newState.expression;

  // v2 fields (optional)
  if (newState.workflow) this.state.workflow = newState.workflow;
  if (newState.beat) this.state.beat = newState.beat;
  if (newState.conflict) this.state.conflict = newState.conflict;
  if (newState.stakes) this.state.stakes = newState.stakes;
  if (newState.summary) this.state.summary = newState.summary;
  if (Array.isArray(newState.secrets)) this.state.secrets = newState.secrets;
  if (Array.isArray(newState.openLoops)) this.state.openLoops = newState.openLoops;
  if (Array.isArray(newState.canonFacts)) this.state.canonFacts = newState.canonFacts;

  // v3 fields (optional)
  if (newState.objective && typeof newState.objective === 'object') {
    this.state.objective = this.state.objective || {};
    if (typeof newState.objective.title === 'string') this.state.objective.title = newState.objective.title;
    if (typeof newState.objective.detail === 'string') this.state.objective.detail = newState.objective.detail;
    this.state.objective.updatedAt = new Date();
  }
  return this;
};

// 添加事件
StorySessionSchema.methods.addEvent = function(event) {
  if (event && !this.events.includes(event)) {
    this.events.push(event);
  }
  return this;
};

// 推进进度（永不结束，循环剧情）
StorySessionSchema.methods.advanceProgress = function(amount = 3) {
  this.progress = this.progress + amount;
  // 剧情循环：超过100后重新从一定进度开始，模拟剧情发展
  if (this.progress >= 100) {
    this.progress = 20 + Math.random() * 30; // 回到 20-50% 之间，开启新章节
  }
  return this;
};

// 更新好感度
StorySessionSchema.methods.updateAffection = function(change) {
  const oldLevel = this.affection.level;
  this.affection.level = Math.max(0, Math.min(100, oldLevel + change));
  this.affection.lastChange = change;
  
  // 根据好感度更新阶段
  const level = this.affection.level;
  if (level >= 80) {
    this.affection.stage = '深爱';
  } else if (level >= 60) {
    this.affection.stage = '热恋';
  } else if (level >= 40) {
    this.affection.stage = '暧昧';
  } else if (level >= 20) {
    this.affection.stage = '熟悉';
  } else {
    this.affection.stage = '陌生';
  }
  
  return this;
};

module.exports = mongoose.model('StorySession', StorySessionSchema);
