const mongoose = require('mongoose');

const VoiceModelSchema = new mongoose.Schema(
  {
    remoteId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    type: { type: String, default: '' },
    trainMode: { type: String, default: '' },
    languages: [{ type: String }],
    tags: [{ type: String }],
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    visibility: { type: String, default: 'public' },
    state: { type: String, default: '' },
    likeCount: { type: Number, default: 0 },
    markCount: { type: Number, default: 0 },
    sharedCount: { type: Number, default: 0 },
    taskCount: { type: Number, default: 0 },
    author: {
      id: { type: String },
      nickname: { type: String },
      avatar: { type: String },
    },
    isFavorite: { type: Boolean, default: false },
    previewAudioUrl: { type: String, default: '' }, // Cached preview audio
  },
  { timestamps: true }
);

module.exports = mongoose.model('VoiceModel', VoiceModelSchema);
