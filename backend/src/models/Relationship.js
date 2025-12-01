const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  intimacy: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now },
  // Potential future fields: unlock status, memory summary, etc.
}, { timestamps: true });

// Ensure unique pair
relationshipSchema.index({ userId: 1, agentId: 1 }, { unique: true });

module.exports = mongoose.model('Relationship', relationshipSchema);

