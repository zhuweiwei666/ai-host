const mongoose = require('mongoose');

// User schema for managing users
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true }, // sparse: allow multiple nulls
  password: { type: String }, // For channel users (web/android/iOS)
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  userType: { 
    type: String, 
    enum: ['operator', 'channel'], 
    default: 'channel',
    required: true 
  }, // 运营用户(operator) or 渠道用户(channel)
  platform: { 
    type: String, 
    enum: ['web', 'android', 'ios', 'admin'], 
    default: 'web' 
  }, // 渠道用户的平台类型
  phone: { type: String }, // 手机号（用于渠道用户）
  externalUserId: { type: String }, // 外部产品的用户ID（Android/iOS传入）
  externalAppId: { type: String }, // 外部应用ID（可选，用于区分不同的外部产品）
  isActive: { type: Boolean, default: true }, // 是否激活
  lastLoginAt: { type: Date }, // 最后登录时间
  
  // === Google Login Fields ===
  google_id: { type: String, unique: true, sparse: true }, // Google User ID
  avatar: { type: String, default: '' }, // User avatar URL
  
  // === Apple Sign In Fields ===
  apple_id: { type: String, unique: true, sparse: true }, // Apple User ID (sub from identityToken)
  
  // === Push Notification Fields ===
  deviceTokens: [{
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // We can link to UserAIBalance via userId (which matches _id or username here)
}, { timestamps: true });

// Index for faster queries
UserSchema.index({ userType: 1 });
UserSchema.index({ platform: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ google_id: 1 }); // Index for google_id
UserSchema.index({ apple_id: 1 }); // Index for apple_id
UserSchema.index({ externalUserId: 1, platform: 1, externalAppId: 1 }); // 复合索引，用于快速查找外部用户
UserSchema.index({ 'deviceTokens.token': 1 }); // Index for device tokens

module.exports = mongoose.model('User', UserSchema);

