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
  
  // ========== 用户类型侦测 ==========
  // 前5轮对话用于侦测用户类型
  detectionRound: { type: Number, default: 0 },     // 当前侦测轮数 (0-5)
  detectionChoices: [{                               // 用户的选择记录
    round: Number,                                   // 第几轮
    choiceIndex: Number,                             // 选择了哪个 (0=含蓄, 1=中等, 2=直接)
    createdAt: { type: Date, default: Date.now }
  }],
  
  // 用户类型 (5轮后确定)
  userType: { 
    type: String, 
    enum: ['unknown', 'slow_burn', 'direct'],       // unknown=未确定, slow_burn=闷骚型, direct=直接型
    default: 'unknown'
  },
  userTypeScore: { type: Number, default: 0 },      // 累计分数: 选项0=1分, 选项1=2分, 选项2=3分
  userTypeConfirmedAt: { type: Date },              // 类型确定时间           // 设置时间
  
  // ========== 专属昵称系统 ==========
  petName: { type: String, default: '' },           // AI 对用户的专属称呼（如"老公"、"宝贝"）
  petNameSetAt: { type: Date },                     // 设置时间
  userCallsMe: { type: String, default: '' },       // 用户对 AI 的称呼
  
  // ========== 关系数据 ==========
  firstMetAt: { type: Date },                       // 第一次见面时间
  
  // ========== 解锁内容 ==========
  unlockedOutfits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Outfit' }],  // 已解锁的衣服/场景
  
  // ========== 礼物统计 ==========
  totalGiftCoins: { type: Number, default: 0 },     // 累计送出金币
  totalGiftCount: { type: Number, default: 0 },     // 累计送出礼物数
  
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
  
  // 专属称呼（最重要）
  if (this.petName) parts.push(`你要叫用户「${this.petName}」，这是你们之间的专属称呼`);
  if (this.userCallsMe) parts.push(`用户喜欢叫你「${this.userCallsMe}」`);
  
  // 关系时长
  if (this.firstMetAt) {
    const days = Math.floor((Date.now() - this.firstMetAt.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 0) parts.push(`你们已经认识 ${days} 天了`);
  }
  
  // 礼物统计（让AI知道用户对她好）
  if (this.totalGiftCount > 0) {
    parts.push(`用户已经送了你 ${this.totalGiftCount} 份礼物，花了 ${this.totalGiftCoins} 金币`);
  }
  
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
