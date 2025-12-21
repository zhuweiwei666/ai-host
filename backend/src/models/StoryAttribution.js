/**
 * Story Attribution Model
 * 每段一条：把“生成过程/骨架位置/校验/重试/付费/反馈/继续率”关联起来
 */
const mongoose = require('mongoose');

const StoryAttributionSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorySession', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    paragraphIndex: { type: Number, required: true, index: true },

    // context/process meta (store hashes only)
    workflowVersion: { type: String, default: '' },
    modelName: { type: String, default: '' },
    promptHash: { type: String, default: '' },
    contextHash: { type: String, default: '' },
    variantId: { type: String, default: '' },
    experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromptExperiment' },

    skeletonVersion: { type: String, default: '' },
    arcId: { type: String, default: '' },
    beat: { type: String, default: '' },
    eventType: { type: String, default: '' },

    validatePass: { type: Boolean, default: true },
    failReasons: [{ type: String }],
    retryCount: { type: Number, default: 0 },
    criticUsed: { type: Boolean, default: false },

    // signals
    thumb: { type: String, enum: ['up', 'down', ''], default: '' },
    continued: { type: Boolean }, // null/undefined means unknown
    dwellMs: { type: Number },
    payEvent: {
      type: { type: String }, // milestone_unlock/chapter_unlock/subscription/photo
      cost: { type: Number },
      at: { type: Date },
    },
  },
  { timestamps: true }
);

StoryAttributionSchema.index({ sessionId: 1, paragraphIndex: 1 }, { unique: true });

module.exports = mongoose.model('StoryAttribution', StoryAttributionSchema);

