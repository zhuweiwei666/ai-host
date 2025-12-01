const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const Message = require('../models/Message');
const WalletTransaction = require('../models/WalletTransaction');
const UsageLog = require('../models/UsageLog'); // Import UsageLog
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/stats/agents - Get agent statistics (Admin only)
router.get('/agents', requireAdmin, async (req, res) => {
  try {
    // 1. Get all agents to ensure we list even those with no activity
    const agents = await Agent.find({}, 'name modelName avatarUrl');

    // Parse Date Filter
    const { startDate, endDate } = req.query;
    let matchStage = {};
    if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // 2. Aggregate COST from UsageLog with Date Filter
    const costStats = await UsageLog.aggregate([
      { $match: Object.keys(matchStage).length > 0 ? matchStage : {} },
      {
        $group: {
          _id: '$agentId',
          totalCost: { $sum: '$cost' },
          llmCost: { $sum: { $cond: [{ $eq: ['$type', 'llm'] }, '$cost', 0] } },
          ttsCost: { $sum: { $cond: [{ $eq: ['$type', 'tts'] }, '$cost', 0] } },
          imageCost: { $sum: { $cond: [{ $eq: ['$type', 'image'] }, '$cost', 0] } },
          videoCost: { $sum: { $cond: [{ $eq: ['$type', 'video'] }, '$cost', 0] } },
          
          // Token/Unit sums
          llmTokens: { $sum: { $cond: [{ $eq: ['$type', 'llm'] }, { $add: ['$inputUnits', '$outputUnits'] }, 0] } },
          ttsChars: { $sum: { $cond: [{ $eq: ['$type', 'tts'] }, '$inputUnits', 0] } },
          imageCount: { $sum: { $cond: [{ $eq: ['$type', 'image'] }, '$outputUnits', 0] } },
        }
      }
    ]);

    // 3. Aggregate Revenue from Wallet Transactions with Date Filter
    // Note: Transactions match by createdAt as well
    const revenueStats = await WalletTransaction.aggregate([
      {
        $match: {
          type: 'consume',
          refId: { $exists: true, $ne: null },
          ...(Object.keys(matchStage).length > 0 ? matchStage : {})
        }
      },
      {
        $group: {
          _id: '$refId',
          totalRevenue: { $sum: { $abs: '$amount' } },
          messageCount: { $sum: 1 } // Approximate message count from transactions
        }
      }
    ]);

    // 4. Merge Data
    const stats = agents.map(agent => {
      const agentIdStr = agent._id.toString();
      
      const cStat = costStats.find(s => s._id.toString() === agentIdStr) || { 
        totalCost: 0, llmCost: 0, ttsCost: 0, imageCost: 0, videoCost: 0,
        llmTokens: 0, ttsChars: 0, imageCount: 0 
      };
      const rStat = revenueStats.find(s => s._id === agentIdStr) || { totalRevenue: 0, messageCount: 0 };

      const profit = rStat.totalRevenue - (cStat.totalCost * 1); // Need conversion if Revenue is Coin and Cost is USD. 
      // Wait! Revenue is in "AI Coins". Cost is in "USD".
      // We need an exchange rate. 
      // Assumption: 1 Coin = $0.01 USD (Example rate, usually 100 coins = $1).
      const COIN_TO_USD_RATE = 0.01; 
      
      const revenueUSD = rStat.totalRevenue * COIN_TO_USD_RATE;
      const netProfitUSD = revenueUSD - cStat.totalCost;
      const roi = cStat.totalCost > 0 ? (netProfitUSD / cStat.totalCost) * 100 : 0;

      return {
        agentId: agentIdStr,
        name: agent.name,
        modelName: agent.modelName,
        avatarUrl: agent.avatarUrl,
        
        messageCount: rStat.messageCount,
        
        // Costs Breakdown
        totalCost: cStat.totalCost,
        llmCost: cStat.llmCost,
        ttsCost: cStat.ttsCost,
        imageCost: cStat.imageCost,
        videoCost: cStat.videoCost,
        
        // Usage Breakdown
        llmTokens: cStat.llmTokens,
        ttsChars: cStat.ttsChars,
        imageCount: cStat.imageCount,
        
        // Financials
        revenueCoins: rStat.totalRevenue,
        revenueUSD: revenueUSD,
        profitUSD: netProfitUSD,
        roi: roi
      };
    });

    // Sort logic handled by frontend or explicitly requested here?
    // Default sort by ROI desc if not specified
    // stats.sort((a, b) => b.roi - a.roi); // We let frontend decide, or default here.
    // Let's keep default ROI sort for consistency if frontend doesn't sort immediately.
    stats.sort((a, b) => b.roi - a.roi);

    res.json(stats);
  } catch (err) {
    console.error('Stats Error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

module.exports = router;

