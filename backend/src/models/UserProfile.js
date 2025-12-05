/**
 * 用户画像模型
 * 
 * 存储每个用户与每个 AI 主播之间的长期记忆信息
 * 这些信息会被注入到 AI 的系统提示中，实现真正的"记忆"
 */

const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true, 
    index: true 
  },
  
  // ========== 基本信息 ==========
  nickname: { type: String, default: '' },        // 用户的昵称/称呼
  realName: { type: String, default: '' },        // 真实姓名
  gender: { type: String, default: '' },          // 性别
  age: { type: String, default: '' },             // 年龄
  birthday: { type: String, default: '' },        // 生日
  location: { type: String, default: '' },        // 所在地
  occupation: { type: String, default: '' },      // 职业
  
  // ========== 喜好信息 ==========
  favoriteFood: [{ type: String }],               // 喜欢的食物
  favoriteMusic: [{ type: String }],              // 喜欢的音乐
  favoriteMovie: [{ type: String }],              // 喜欢的电影
  hobbies: [{ type: String }],                    // 兴趣爱好
  dislikes: [{ type: String }],                   // 不喜欢的东西
  
  // ========== 关系信息 ==========
  relationshipStatus: { type: String, default: '' },  // 感情状态
  pets: [{ type: String }],                           // 宠物
  
  // ========== 重要事件/记忆 ==========
  importantMemories: [{
    content: String,                              // 记忆内容
    category: String,                             // 分类：personal, preference, event, etc.
    createdAt: { type: Date, default: Date.now }
  }],
  
  // ========== 自定义标签 ==========
  customTags: [{
    key: String,
    value: String
  }],
  
  // ========== 对话摘要 ==========
  conversationSummary: { type: String, default: '' },  // AI 生成的对话摘要
  lastSummaryAt: { type: Date },                       // 上次摘要时间
  
  // ========== 交互偏好 ==========
  // 用户选择的交互模式，决定 AI 的行为风格
  interactionMode: { 
    type: String, 
    enum: ['not_set', 'friendly', 'romantic', 'flirty', 'intimate'],
    default: 'not_set'
  },
  // friendly: 纯聊天，像朋友一样，不暧昧
  // romantic: 浪漫甜蜜，像恋人一样，但不露骨
  // flirty: 暧昧调情，有暗示但不直接
  // intimate: 亲密深入，可以更大胆
  
  interactionModeSetAt: { type: Date },           // 设置时间
  
  // ========== 元数据 ==========
  totalMessages: { type: Number, default: 0 },    // 总消息数
  lastActiveAt: { type: Date, default: Date.now } // 最后活跃时间
  
}, { timestamps: true });

// 复合唯一索引：一个用户对一个主播只有一个画像
UserProfileSchema.index({ userId: 1, agentId: 1 }, { unique: true });

/**
 * 生成用于注入 AI 系统提示的画像文本
 */
UserProfileSchema.methods.toPromptText = function() {
  const parts = [];
  
  // 基本信息
  if (this.nickname) parts.push(`用户希望被称为「${this.nickname}」`);
  if (this.realName) parts.push(`用户的真名是 ${this.realName}`);
  if (this.gender) parts.push(`用户是${this.gender}性`);
  if (this.age) parts.push(`用户 ${this.age} 岁`);
  if (this.birthday) parts.push(`用户的生日是 ${this.birthday}`);
  if (this.location) parts.push(`用户在 ${this.location}`);
  if (this.occupation) parts.push(`用户的职业是 ${this.occupation}`);
  
  // 喜好
  if (this.favoriteFood?.length) parts.push(`用户喜欢吃：${this.favoriteFood.join('、')}`);
  if (this.favoriteMusic?.length) parts.push(`用户喜欢的音乐：${this.favoriteMusic.join('、')}`);
  if (this.favoriteMovie?.length) parts.push(`用户喜欢的电影：${this.favoriteMovie.join('、')}`);
  if (this.hobbies?.length) parts.push(`用户的爱好：${this.hobbies.join('、')}`);
  if (this.dislikes?.length) parts.push(`用户不喜欢：${this.dislikes.join('、')}`);
  
  // 关系
  if (this.relationshipStatus) parts.push(`用户的感情状态：${this.relationshipStatus}`);
  if (this.pets?.length) parts.push(`用户养了：${this.pets.join('、')}`);
  
  // 重要记忆（最近 10 条）
  if (this.importantMemories?.length) {
    const recentMemories = this.importantMemories.slice(-10);
    parts.push(`重要记忆：${recentMemories.map(m => m.content).join('；')}`);
  }
  
  // 自定义标签
  if (this.customTags?.length) {
    this.customTags.forEach(tag => {
      parts.push(`${tag.key}：${tag.value}`);
    });
  }
  
  if (parts.length === 0) return '';
  
  return `\n**[用户画像 - 长期记忆]**\n你已经了解这个用户的以下信息，请在对话中自然地体现出来：\n- ${parts.join('\n- ')}\n`;
};

module.exports = mongoose.model('UserProfile', UserProfileSchema);
