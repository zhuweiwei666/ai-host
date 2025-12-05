const mongoose = require('mongoose');

// 视频预览配置 Schema
const PreviewVideoSchema = new mongoose.Schema({
  url: { type: String, required: true },           // 视频 URL
  thumbnailUrl: { type: String, default: '' },     // 缩略图/封面图 URL
  duration: { type: Number, default: 0 },          // 视频时长（秒）
  width: { type: Number, default: 0 },             // 视频宽度
  height: { type: Number, default: 0 },            // 视频高度
  fileSize: { type: Number, default: 0 },          // 文件大小（字节）
  format: { type: String, default: 'mp4' },        // 视频格式
  isVertical: { type: Boolean, default: true },    // 是否竖屏
  sortOrder: { type: Number, default: 0 },         // 排序顺序
  tags: [String],                                   // 标签：如 'sexy', 'cute', 'dance'
  scaleLevel: { type: Number, default: 1, min: 1, max: 5 }, // 尺度等级 1-5
}, { _id: true });

const AgentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'female' },
  style: { type: String, enum: ['realistic', 'anime'], default: 'realistic' }, // New Style Field
  avatarUrl: { type: String, default: '' }, // Deprecated: use avatarUrls[0] instead
  coverVideoUrl: { type: String, default: '' }, // Deprecated: use coverVideoUrls[0] instead
  privatePhotoUrl: { type: String, default: '' }, // Deprecated: use privatePhotoUrls[0] instead
  // New: Support multiple media files
  avatarUrls: { type: [String], default: [] }, // Array of image URLs
  coverVideoUrls: { type: [String], default: [] }, // Array of video URLs
  privatePhotoUrls: { type: [String], default: [] }, // Array of NSFW/Paid image URLs
  
  // ========== 视频预览系统 ==========
  previewVideos: [PreviewVideoSchema],              // 预览视频列表（带元数据）
  defaultPreviewIndex: { type: Number, default: 0 }, // 默认播放的视频索引
  description: { type: String, default: '' },
  modelName: { type: String, required: true, default: 'grok-4-1-fast-reasoning' },
  temperature: { type: Number, default: 0.7 },
  
  // Deprecated but kept for compatibility or as a base fallback
  corePrompt: { type: String, default: '' }, 
  
  // New 3-Stage Prompts
  stage1Prompt: { type: String, default: '' },
  stage2Prompt: { type: String, default: '' },
  stage3Prompt: { type: String, default: '' },

  // Intimacy Thresholds
  stage1Threshold: { type: Number, default: 20 }, // 0 to 20
  stage2Threshold: { type: Number, default: 60 }, // 21 to 60, then 61+ is Stage 3

  systemPrompt: { type: String, default: 'You are a helpful AI assistant.' }, // Custom/user layer
  voiceId: { type: String, default: '' }, // Fish Audio Reference ID
  status: { type: String, enum: ['online', 'offline'], default: 'online' },
  
  // ========== 主动开场消息 ==========
  greetingMessages: [{
    content: { type: String, required: true },      // 消息内容
    timeRange: { 
      type: String, 
      enum: ['any', 'morning', 'afternoon', 'evening', 'night'],
      default: 'any'
    },
    mood: { 
      type: String, 
      enum: ['normal', 'miss_you', 'flirty', 'lonely', 'excited'],
      default: 'normal'
    },
    // 是否附带图片
    withImage: { type: Boolean, default: false },
    imageHint: { type: String, default: '' },       // 图片描述提示
  }],
  
  // ========== 默认开场（如果没有配置 greetingMessages）==========
  defaultGreeting: { type: String, default: '' },
  
}, { timestamps: true });

module.exports = mongoose.model('Agent', AgentSchema);
