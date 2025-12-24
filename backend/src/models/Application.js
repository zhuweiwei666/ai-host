const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  appId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  secretKey: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  description: { type: String },
  // 渠道列表
  channels: [{
    channelId: String,
    name: String,
    status: { type: String, default: 'active' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Application', ApplicationSchema);
