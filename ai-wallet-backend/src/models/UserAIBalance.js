const mongoose = require('mongoose');

/**
 * 用户 AI 钱包余额
 * userId：来自主业务系统（字符串形式，避免 JS Number 精度问题）
 */
const UserAIBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('UserAIBalance', UserAIBalanceSchema);