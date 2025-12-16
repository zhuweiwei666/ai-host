/**
 * UserGallery 模型
 * 
 * 用户画廊 - 存储用户交互过程中生成的所有图片/视频
 * 支持点赞、转发等互动统计
 */

const mongoose = require('mongoose');

const UserGallerySchema = new mongoose.Schema({
  // 所属用户
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // 关联角色
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true,
    index: true
  },
  
  // 媒体类型
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image',
    index: true
  },
  
  // 媒体 URL
  mediaUrl: { 
    type: String, 
    required: true 
  },
  
  // 缩略图 URL（视频用）
  thumbnailUrl: { 
    type: String 
  },
  
  // 生成来源
  source: {
    type: String,
    enum: ['story', 'chat', 'photo'],  // story=剧情配图, chat=聊天生图, photo=写真
    default: 'story',
    index: true
  },
  
  // 关联的故事会话
  storySessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'StorySession'
  },
  
  // 生成时的 prompt
  prompt: { 
    type: String, 
    default: '' 
  },
  
  // 生成时的上下文（故事内容片段）
  context: { 
    type: String, 
    default: '' 
  },
  
  // ========== 互动统计 ==========
  stats: {
    // 点赞数
    likes: { type: Number, default: 0 },
    // 转发数
    shares: { type: Number, default: 0 },
    // 收藏数
    favorites: { type: Number, default: 0 },
    // 查看数
    views: { type: Number, default: 0 },
  },
  
  // 点赞用户列表（用于判断是否已点赞）
  likedByUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // 收藏用户列表
  favoritedByUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // 是否公开（用户可选择隐藏）
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // 是否 NSFW
  isNsfw: {
    type: Boolean,
    default: false
  },
  
  // 是否可用（管理员可禁用）
  isActive: {
    type: Boolean,
    default: true
  },

}, { timestamps: true });

// 复合索引：用户画廊列表
UserGallerySchema.index({ userId: 1, createdAt: -1 });
UserGallerySchema.index({ userId: 1, mediaType: 1, createdAt: -1 });

// 热门图片索引
UserGallerySchema.index({ 'stats.likes': -1, createdAt: -1 });

// 角色图片索引
UserGallerySchema.index({ agentId: 1, isPublic: 1, createdAt: -1 });

// ========== 静态方法 ==========

// 添加到画廊
UserGallerySchema.statics.addToGallery = async function(data) {
  const item = new this(data);
  await item.save();
  return item;
};

// 点赞/取消点赞
UserGallerySchema.statics.toggleLike = async function(galleryId, userId) {
  const item = await this.findById(galleryId);
  if (!item) throw new Error('图片不存在');
  
  const userIdStr = userId.toString();
  const likedIndex = item.likedByUsers.findIndex(id => id.toString() === userIdStr);
  
  if (likedIndex >= 0) {
    // 取消点赞
    item.likedByUsers.splice(likedIndex, 1);
    item.stats.likes = Math.max(0, item.stats.likes - 1);
  } else {
    // 点赞
    item.likedByUsers.push(userId);
    item.stats.likes += 1;
  }
  
  await item.save();
  return { liked: likedIndex < 0, likes: item.stats.likes };
};

// 收藏/取消收藏
UserGallerySchema.statics.toggleFavorite = async function(galleryId, userId) {
  const item = await this.findById(galleryId);
  if (!item) throw new Error('图片不存在');
  
  const userIdStr = userId.toString();
  const favIndex = item.favoritedByUsers.findIndex(id => id.toString() === userIdStr);
  
  if (favIndex >= 0) {
    item.favoritedByUsers.splice(favIndex, 1);
    item.stats.favorites = Math.max(0, item.stats.favorites - 1);
  } else {
    item.favoritedByUsers.push(userId);
    item.stats.favorites += 1;
  }
  
  await item.save();
  return { favorited: favIndex < 0, favorites: item.stats.favorites };
};

// 增加转发数
UserGallerySchema.statics.incrementShare = async function(galleryId) {
  return this.updateOne(
    { _id: galleryId },
    { $inc: { 'stats.shares': 1 } }
  );
};

// 增加查看数
UserGallerySchema.statics.incrementView = async function(galleryId) {
  return this.updateOne(
    { _id: galleryId },
    { $inc: { 'stats.views': 1 } }
  );
};

module.exports = mongoose.model('UserGallery', UserGallerySchema);
