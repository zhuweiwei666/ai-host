const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'female' },
  style: { type: String, enum: ['realistic', 'anime'], default: 'realistic' }, // New Style Field
  avatarUrl: { type: String, default: '' },
  coverVideoUrl: { type: String, default: '' }, // Video preview on hover
  privatePhotoUrl: { type: String, default: '' }, // NSFW/Paid Variant
  description: { type: String, default: '' },
  modelName: { type: String, required: true, default: 'gpt-4o-mini' },
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
}, { timestamps: true });

module.exports = mongoose.model('Agent', AgentSchema);
