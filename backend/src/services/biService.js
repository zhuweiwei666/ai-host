const mongoose = require('mongoose');
const User = require('../models/User');
const UserEvent = require('../models/UserEvent');
const WalletTransaction = require('../models/WalletTransaction');
const UsageLog = require('../models/UsageLog');

class BIService {
  /**
   * 计算指定应用的留存率
   * @param {string} appId - 应用ID
   * @param {string} startDate - 开始日期 (YYYY-MM-DD)
   * @param {number} days - 留存周期 (1, 7, 30)
   */
  async calculateRetention(appId, startDate, days = 1) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // 1. 找到在该日期注册的新用户
    const newUsers = await User.find({
      appId,
      createdAt: { $gte: start, $lt: end },
      userType: 'channel'
    }).select('_id');

    if (newUsers.length === 0) return 0;

    const newUserIds = newUsers.map(u => u._id.toString());

    // 2. 检查这些用户在 N 天后是否有活跃事件
    const targetStart = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);

    const activeUsers = await UserEvent.distinct('userId', {
      appId,
      userId: { $in: newUserIds },
      serverTimestamp: { $gte: targetStart, $lt: targetEnd }
    });

    return (activeUsers.length / newUserIds.length) * 100;
  }

  /**
   * 获取应用层级的财务报表
   */
  async getAppRevenueReport(appId, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const stats = await WalletTransaction.aggregate([
      {
        $match: {
          appId,
          type: 'consume',
          createdAt: { $gte: start, $lt: end }
        }
      },
      {
        $group: {
          _id: '$channelId', // 如果有按渠道分，可以在这里分
          totalRevenue: { $sum: { $abs: '$amount' } },
          consumeCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          channelId: '$_id',
          totalRevenue: 1,
          consumeCount: 1,
          userCount: { $size: '$uniqueUsers' },
          arpu: { $divide: ['$totalRevenue', { $size: '$uniqueUsers' }] }
        }
      }
    ]);

    return stats;
  }

  /**
   * 获取 ROI 报表 (营收 vs AI 成本)
   */
  async getAppROIReport(appId, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. 计算总营收 (Coins)
    const revenue = await WalletTransaction.aggregate([
      { $match: { appId, type: 'consume', createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);

    // 2. 计算总 AI 成本 (USD)
    const cost = await UsageLog.aggregate([
      { $match: { appId, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]);

    const totalRevenueCoins = revenue[0]?.total || 0;
    const totalCostUSD = cost[0]?.total || 0;

    // 假设汇率 100 coins = 1 USD
    const revenueUSD = totalRevenueCoins / 100;
    const roi = totalCostUSD > 0 ? (revenueUSD / totalCostUSD) : 0;

    return {
      revenueUSD,
      totalCostUSD,
      roi,
      totalRevenueCoins
    };
  }
}

module.exports = new BIService();
