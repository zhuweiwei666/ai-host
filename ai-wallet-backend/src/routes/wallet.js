const express = require('express');
const UserAIBalance = require('../models/UserAIBalance');
const WalletTransaction = require('../models/WalletTransaction');
const AdRewardLog = require('../models/AdRewardLog');

const router = express.Router();

function ok(res, data = null, msg = 'success') {
  res.json({ code: 200, msg, data });
}

function badRequest(res, msg) {
  res.status(400).json({ code: 400, msg });
}

/**
 * 工具：获取或创建用户钱包
 */
async function getOrCreateWallet(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }
  let wallet = await UserAIBalance.findOne({ userId });
  if (!wallet) {
    wallet = await UserAIBalance.create({ userId, balance: 0 });
  }
  return wallet;
}

/**
 * GET /wallet/health
 */
router.get('/health', (_req, res) => {
  ok(res, { ts: Date.now() }, 'ai-wallet ok');
});

/**
 * GET /wallet/balance?userId=xxxx
 * 如果钱包不存在，会自动创建，余额为 0
 */
router.get('/balance', async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return badRequest(res, 'userId is required');

    const wallet = await getOrCreateWallet(userId);
    ok(res, { userId, balance: wallet.balance });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /wallet/recharge
 * body: { userId, amount, itemType?, bizId?, meta? }
 * 用于：主系统充值、人工补偿、购买 AI 套餐等
 */
router.post('/recharge', async (req, res, next) => {
  try {
    const { userId, amount, itemType, bizId, meta } = req.body;
    if (!userId) return badRequest(res, 'userId is required');
    if (typeof amount !== 'number' || amount <= 0) {
      return badRequest(res, 'amount must be > 0');
    }

    const wallet = await getOrCreateWallet(String(userId));
    const before = wallet.balance;
    const after = before + amount;

    wallet.balance = after;
    await wallet.save();

    await WalletTransaction.create({
      userId: String(userId),
      type: 'recharge',
      amount,
      beforeBalance: before,
      afterBalance: after,
      itemType: itemType || 'recharge',
      bizId,
      meta
    });

    ok(res, { userId: String(userId), balance: after });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /wallet/consume
 * body: { userId, amount, itemType, bizId?, meta? }
 * 用于：AI 消息 / 语音 / 图片 / 视频等扣费
 */
router.post('/consume', async (req, res, next) => {
  try {
    const { userId, amount, itemType, bizId, meta } = req.body;
    if (!userId) return badRequest(res, 'userId is required');
    if (typeof amount !== 'number' || amount <= 0) {
      return badRequest(res, 'amount must be > 0');
    }
    if (!itemType) return badRequest(res, 'itemType is required');

    const wallet = await getOrCreateWallet(String(userId));
    const before = wallet.balance;

    if (before < amount) {
      return res.status(400).json({
        code: 400,
        msg: 'INSUFFICIENT_FUNDS',
        data: {
          userId: String(userId),
          balance: before,
          need: amount
        }
      });
    }

    const after = before - amount;
    wallet.balance = after;
    await wallet.save();

    await WalletTransaction.create({
      userId: String(userId),
      type: 'consume',
      amount: -amount,
      beforeBalance: before,
      afterBalance: after,
      itemType,
      bizId,
      meta
    });

    ok(res, { userId: String(userId), balance: after });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /wallet/reward/ad
 * body: { userId, reward, adNetwork?, placementId?, traceId, meta? }
 * 用于：看广告奖励 AI 币，traceId 防重复发奖
 */
router.post('/reward/ad', async (req, res, next) => {
  try {
    const { userId, reward, adNetwork, placementId, traceId, meta } = req.body;
    if (!userId) return badRequest(res, 'userId is required');
    if (typeof reward !== 'number' || reward <= 0) {
      return badRequest(res, 'reward must be > 0');
    }
    if (!traceId) return badRequest(res, 'traceId is required');

    // 防止同一条广告重复发奖
    const existed = await AdRewardLog.findOne({ traceId });
    if (existed) {
      return res.status(400).json({
        code: 400,
        msg: 'DUPLICATE_AD_REWARD',
        data: { traceId }
      });
    }

    const wallet = await getOrCreateWallet(String(userId));
    const before = wallet.balance;
    const after = before + reward;

    wallet.balance = after;
    await wallet.save();

    await AdRewardLog.create({
      userId: String(userId),
      reward,
      adNetwork,
      placementId,
      traceId,
      meta
    });

    await WalletTransaction.create({
      userId: String(userId),
      type: 'reward',
      amount: reward,
      beforeBalance: before,
      afterBalance: after,
      itemType: 'ad_reward',
      bizId: traceId,
      meta: {
        ...(meta || {}),
        adNetwork,
        placementId
      }
    });

    ok(res, { userId: String(userId), balance: after });
  } catch (err) {
    next(err);
  }
});

module.exports = router;