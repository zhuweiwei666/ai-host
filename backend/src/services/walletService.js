const crypto = require('crypto');

const UserAIBalance = require('../models/UserAIBalance'); // legacy (migration fallback)
const WalletTransaction = require('../models/WalletTransaction'); // legacy logs (kept for backward compatibility)
const WalletTrace = require('../models/WalletTrace'); // legacy ad trace (kept for backward compatibility)

const ledgerService = require('./ledgerService');
const UserBalance = require('../models/UserBalance');

class WalletService {
  
  /**
   * Get user balance.
   * Ledger is the source of truth; legacy UserAIBalance is used only for migration fallback.
   */
  async getBalance(userId, appId = null) {
    // Fast path: new snapshot
    const snap = await UserBalance.findOne({ userId }).lean();
    if (snap) return snap.creditsBalance ?? 0;

    // Migration fallback: if legacy balance exists, backfill once into ledger+snapshot
    const legacy = await UserAIBalance.findOne({ userId }).lean();
    if (legacy && Number.isFinite(legacy.balance) && legacy.balance > 0) {
      const migrated = await ledgerService.applyCreditsMutation({
        userId,
        appId,
        delta: legacy.balance,
        reason: 'open_balance_migration',
        idempotencyKey: `migration:open_balance:${userId}`,
        type: 'adjustment',
        refType: 'legacy',
        refId: userId,
      });
      return migrated.balance;
    }

    // New user: grant welcome bonus (100) once
    const welcome = await ledgerService.applyCreditsMutation({
      userId,
      appId,
      delta: 100,
      reason: 'new_user_gift',
      idempotencyKey: `init:welcome:${userId}`,
      type: 'credit',
      refType: 'system',
      refId: 'welcome',
      meta: { note: 'Welcome bonus' },
    });

    // Keep legacy transaction log for admin/support tooling that reads it.
    WalletTransaction.create({
      userId,
      appId: appId || welcome.ledgerEntry?.appId,
      type: 'reward',
      amount: 100,
      beforeBalance: 0,
      afterBalance: 100,
      itemType: 'new_user_gift',
      meta: { note: 'Welcome bonus' },
    }).catch(() => {});

    return welcome.balance;
  }

  /**
   * Deduct coins. Throws error if insufficient funds.
   * Ledger-backed (atomic + auditable).
   */
  async consume(userId, amount, itemType, refId = null, idempotencyKey = null, appId = null) {
    if (!amount || Number(amount) <= 0) return this.getBalance(userId, appId);

    // Ensure user has been initialized/migrated
    await this.getBalance(userId, appId);

    let res;
    try {
      res = await ledgerService.applyCreditsMutation({
        userId,
        appId,
        delta: -Math.abs(Number(amount)),
        reason: itemType || 'consume',
        idempotencyKey: idempotencyKey || `consume:${crypto.randomUUID()}`,
        type: 'debit',
        refType: itemType || 'consume',
        refId: refId ? String(refId) : undefined,
      });
    } catch (e) {
      if (e?.code === 'INSUFFICIENT_FUNDS') {
        // Keep backward compatibility with existing callers checking err.message.
        throw new Error('INSUFFICIENT_FUNDS');
      }
      throw e;
    }

    // Legacy log (best-effort)
    WalletTransaction.create({
      userId,
      appId: appId || res.ledgerEntry?.appId,
      type: 'consume',
      amount: -Math.abs(Number(amount)),
      beforeBalance: res.balance + Math.abs(Number(amount)),
      afterBalance: res.balance,
      itemType: itemType || 'consume',
      refId: refId ? String(refId) : undefined,
    }).catch(() => {});

    return res.balance;
  }

  /**
   * Add coins (e.g. ad reward)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reward
   * @param {string} itemType - Type of reward (e.g. 'ad_reward')
   * @param {string} refId - Optional reference ID (can be traceId for duplicate prevention)
   * @param {string} traceId - Optional trace ID for duplicate prevention (if provided, checks for duplicates)
   */
  async reward(userId, amount, itemType, refId = null, traceId = null, idempotencyKey = null, appId = null) {
    if (!amount || Number(amount) <= 0) return this.getBalance(userId, appId);

    // Ensure user has been initialized/migrated
    await this.getBalance(userId, appId);

    // Legacy duplicate prevention for ad rewards (kept)
    if (traceId) {
      const existingTrace = await WalletTrace.findOne({ traceId });
      if (existingTrace) {
        throw new Error('DUPLICATE_REWARD');
      }
    }

    const key =
      idempotencyKey ||
      (traceId ? `${itemType || 'reward'}:${traceId}` : `reward:${crypto.randomUUID()}`);

    const res = await ledgerService.applyCreditsMutation({
      userId,
      appId,
      delta: Math.abs(Number(amount)),
      reason: itemType || 'reward',
      idempotencyKey: key,
      type: 'credit',
      refType: itemType || 'reward',
      refId: (refId || traceId) ? String(refId || traceId) : undefined,
    });

    // Record traceId if provided (legacy)
    if (traceId) {
      await WalletTrace.create({
        traceId,
        userId,
        itemType,
        amount: Math.abs(Number(amount)),
      }).catch(() => {});
    }

    // Legacy log (best-effort)
    WalletTransaction.create({
      userId,
      appId: appId || res.ledgerEntry?.appId,
      type: 'reward',
      amount: Math.abs(Number(amount)),
      beforeBalance: res.balance - Math.abs(Number(amount)),
      afterBalance: res.balance,
      itemType: itemType || 'reward',
      refId: (refId || traceId) ? String(refId || traceId) : undefined,
    }).catch(() => {});

    return res.balance;
  }
}

module.exports = new WalletService();

