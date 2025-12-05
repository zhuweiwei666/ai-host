/**
 * 用户行为事件模型 - AI自进化系统核心数据
 * 记录所有用户行为，用于分析、优化和个性化
 */
const mongoose = require('mongoose');

const UserEventSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', index: true },
  
  // ========== 事件类型 ==========
  eventType: { 
    type: String, 
    required: true,
    index: true,
    enum: [
      // 会话相关
      'session_start',           // 开始会话
      'session_end',             // 结束会话
      'session_heartbeat',       // 心跳（每分钟）
      
      // 聊天相关
      'message_sent',            // 用户发消息
      'message_received',        // 收到AI回复
      'message_reaction',        // 对消息的反应（点赞/不喜欢）
      'reply_option_selected',   // 选择了哪个回复选项（类型检测期间）
      
      // 内容相关
      'image_viewed',            // 查看图片
      'image_saved',             // 保存图片
      'image_shared',            // 分享图片
      'video_played',            // 播放视频
      'video_completed',         // 视频看完
      'content_liked',           // 点赞内容
      'content_disliked',        // 不喜欢内容
      
      // 商业相关
      'gift_sent',               // 送礼
      'outfit_viewed',           // 查看私房照
      'outfit_unlocked',         // 解锁私房照
      'coins_purchased',         // 充值
      'coins_spent',             // 消费金币
      
      // 关系相关
      'pet_name_set',            // 设置昵称
      'relationship_viewed',     // 查看关系面板
      
      // 用户状态
      'returned',                // 回流用户
      'churned',                 // 流失（长时间未访问）
    ]
  },
  
  // ========== 事件详情 ==========
  data: {
    // 消息相关
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    messageLength: Number,         // 消息长度
    messageType: String,           // text/image/voice
    replyStyle: String,            // shy/normal/bold（类型检测选项）
    
    // 内容相关
    contentId: String,             // 图片/视频/Outfit ID
    contentType: String,           // image/video/outfit
    contentLevel: Number,          // 内容尺度等级 1-5
    duration: Number,              // 停留/观看时长(秒)
    progress: Number,              // 视频播放进度 0-100
    
    // 反馈相关
    reaction: String,              // like/dislike/none
    rating: Number,                // 1-5星评分
    
    // 商业相关
    amount: Number,                // 金额
    giftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift' },
    outfitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outfit' },
    
    // 其他
    source: String,                // 来源（chat/gallery/push/home）
    position: Number,              // 在列表中的位置
    searchQuery: String,           // 搜索词
  },
  
  // ========== 上下文信息 ==========
  context: {
    // 用户状态
    intimacy: Number,              // 当时的亲密度
    userType: String,              // direct/slow_burn/unknown
    detectionRound: Number,        // 类型检测轮次
    
    // 会话状态
    sessionId: String,             // 会话ID
    sessionDuration: Number,       // 会话已进行时长(秒)
    messageCount: Number,          // 当前会话消息数
    
    // 设备信息
    deviceType: String,            // mobile/desktop/tablet
    platform: String,              // ios/android/web
    screenSize: String,            // 屏幕尺寸
    
    // 时间信息
    timeOfDay: String,             // morning/afternoon/evening/night
    dayOfWeek: Number,             // 0-6
    isWeekend: Boolean,
    
    // 前序事件
    previousEvent: String,         // 上一个事件类型
    previousEventTime: Date,       // 上一个事件时间
  },
  
  // ========== 元数据 ==========
  clientTimestamp: Date,           // 客户端时间
  serverTimestamp: { type: Date, default: Date.now },
  ip: String,                      // IP地址（脱敏）
  userAgent: String,               // User Agent
  
}, { 
  timestamps: true,
  // 使用时间序列优化存储（MongoDB 5.0+）
  timeseries: {
    timeField: 'serverTimestamp',
    metaField: 'userId',
    granularity: 'seconds'
  }
});

// ========== 索引优化 ==========
// 复合索引：按用户+时间查询
UserEventSchema.index({ userId: 1, serverTimestamp: -1 });
// 复合索引：按主播+事件类型查询
UserEventSchema.index({ agentId: 1, eventType: 1, serverTimestamp: -1 });
// 复合索引：按用户+主播查询
UserEventSchema.index({ userId: 1, agentId: 1, serverTimestamp: -1 });
// 内容表现分析索引
UserEventSchema.index({ 'data.contentId': 1, eventType: 1 });
// TTL索引：90天后自动删除
UserEventSchema.index({ serverTimestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ========== 静态方法 ==========

/**
 * 快速记录事件
 */
UserEventSchema.statics.track = async function(userId, agentId, eventType, data = {}, context = {}) {
  try {
    const event = new this({
      userId,
      agentId,
      eventType,
      data,
      context: {
        ...context,
        timeOfDay: getTimeOfDay(),
        dayOfWeek: new Date().getDay(),
        isWeekend: [0, 6].includes(new Date().getDay()),
      },
      serverTimestamp: new Date()
    });
    
    // 异步保存，不阻塞主流程
    event.save().catch(err => console.error('Event tracking error:', err));
    
    return event;
  } catch (err) {
    console.error('Event creation error:', err);
    return null;
  }
};

/**
 * 获取用户最近的事件
 */
UserEventSchema.statics.getRecentEvents = async function(userId, agentId, limit = 100) {
  return this.find({ userId, agentId })
    .sort({ serverTimestamp: -1 })
    .limit(limit)
    .lean();
};

/**
 * 获取用户今日活动统计
 */
UserEventSchema.statics.getTodayStats = async function(userId, agentId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId,
        agentId: new mongoose.Types.ObjectId(agentId),
        serverTimestamp: { $gte: today }
      }
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return stats.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {});
};

// 辅助函数
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

module.exports = mongoose.model('UserEvent', UserEventSchema);
