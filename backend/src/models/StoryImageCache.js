/**
 * StoryImageCache 模型
 * 
 * 缓存故事图片，用于复用节约 API 成本
 * 根据角色 + 场景/情绪关键词 匹配复用
 */

const mongoose = require('mongoose');

const StoryImageCacheSchema = new mongoose.Schema({
  // 角色 ID
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true, 
    index: true 
  },
  
  // 图片 URL
  imageUrl: { 
    type: String, 
    required: true 
  },
  
  // 生成时使用的 prompt
  prompt: { 
    type: String, 
    required: true 
  },
  
  // 提取的关键词标签（用于匹配复用）
  tags: [{
    type: String,
    index: true
  }],
  
  // 情绪分类
  mood: {
    type: String,
    enum: ['neutral', 'shy', 'flirty', 'passionate', 'happy', 'sad', 'angry'],
    default: 'neutral',
    index: true
  },
  
  // 尺度分类
  rating: {
    type: String,
    enum: ['sfw', 'suggestive', 'nsfw'],
    default: 'sfw',
    index: true
  },
  
  // 使用次数
  usageCount: {
    type: Number,
    default: 0
  },
  
  // 最后使用时间
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  
  // 是否可用
  isActive: {
    type: Boolean,
    default: true
  },

}, { timestamps: true });

// 复合索引：角色 + 情绪 + 尺度
StoryImageCacheSchema.index({ agentId: 1, mood: 1, rating: 1 });

// 查找可复用的图片
StoryImageCacheSchema.statics.findReusable = async function(agentId, tags, mood, rating) {
  // 优先精确匹配，其次模糊匹配
  const query = {
    agentId,
    rating,
    isActive: true,
  };
  
  if (mood) {
    query.mood = mood;
  }
  
  // 查找包含任意一个标签的图片
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  
  // 按使用次数升序，优先使用用得少的
  const cached = await this.findOne(query)
    .sort({ usageCount: 1, lastUsedAt: 1 })
    .lean();
  
  if (cached) {
    // 更新使用次数
    await this.updateOne(
      { _id: cached._id },
      { $inc: { usageCount: 1 }, lastUsedAt: new Date() }
    );
  }
  
  return cached;
};

// 保存新生成的图片到缓存
StoryImageCacheSchema.statics.saveToCache = async function(agentId, imageUrl, prompt, tags, mood, rating) {
  // 检查是否已存在相同 URL
  const existing = await this.findOne({ imageUrl });
  if (existing) {
    return existing;
  }
  
  const cached = new this({
    agentId,
    imageUrl,
    prompt,
    tags: tags || [],
    mood: mood || 'neutral',
    rating: rating || 'sfw',
  });
  
  await cached.save();
  return cached;
};

module.exports = mongoose.model('StoryImageCache', StoryImageCacheSchema);
