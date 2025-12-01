const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    audioUrl: { type: String }, // Optional, for assistant voice
    imageUrl: { type: String }, // Optional, for assistant generated image
    inputTokens: { type: Number, default: 0 }, // Token usage tracking
    outputTokens: { type: Number, default: 0 }, // Token usage tracking
    createdAt: { type: Date, default: Date.now }
  }
);

// Index for fast retrieval by agent
MessageSchema.index({ agentId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
