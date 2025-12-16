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
  
  // 当前场景状态
  state: {
    scene: { type: String, default: '初始场景' },     // 当前场景
    time: { type: String, default: '傍晚' },          // 时间
    mood: { type: String, default: '平静' },          // 氛围
    clothes: { type: String, default: '' },           // 角色当前穿着
    lastAction: { type: String, default: '' },        // 上一段结尾（用于承接）
  },
  
  // 已发生的关键事件（用于一致性）
  events: [{
    type: String
  }],
  
  // 历史段落（存储最近 N 段用于上下文）
  paragraphs: [{
    content: { type: String, required: true },
    imageUrl: { type: String },   // 每层楼的配图 URL
    imagePrompt: { type: String }, // 图片生成使用的 prompt
    source: { type: String, enum: ['ai', 'user_input'], default: 'ai' }, // 段落来源
    userInput: { type: String },  // 如果是响应用户输入，记录用户说的话
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

// 添加段落的方法
StorySessionSchema.methods.addParagraph = function(content, source = 'ai', userInput = null, imageUrl = null, imagePrompt = null) {
  this.paragraphs.push({
    content,
    imageUrl,
    imagePrompt,
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

module.exports = mongoose.model('StorySession', StorySessionSchema);
