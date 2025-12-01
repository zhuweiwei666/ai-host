const mongoose = require('mongoose');

const UsageLogSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  userId: { type: String, required: true }, // String to match other models
  type: { 
    type: String, 
    enum: ['llm', 'tts', 'image', 'video'], 
    required: true 
  },
  provider: { type: String, required: true }, // e.g. 'openrouter', 'fal', 'fish'
  model: { type: String, required: true }, // e.g. 'sao10k/l3.1-euryale-70b'
  
  // Detailed usage metrics
  inputUnits: { type: Number, default: 0 }, // Tokens (LLM) or Chars (TTS)
  outputUnits: { type: Number, default: 0 }, // Tokens (LLM) or 1 (Image/Video count)
  
  cost: { type: Number, default: 0 }, // Estimated USD cost
  
  meta: { type: Object } // Any extra info
}, { timestamps: true });

// Indexes for faster aggregation
UsageLogSchema.index({ agentId: 1, type: 1 });
UsageLogSchema.index({ createdAt: 1 });

module.exports = mongoose.model('UsageLog', UsageLogSchema);

