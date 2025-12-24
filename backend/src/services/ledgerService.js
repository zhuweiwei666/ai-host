const mongoose = require('mongoose');
const crypto = require('crypto');

const LedgerEntry = require('../models/LedgerEntry');
const UserBalance = require('../models/UserBalance');

function makeIdempotencyKey(prefix = 'auto') {
  return `${prefix}:${crypto.randomUUID()}`;
}

function makeError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || String(err.message || '').includes('E11000'));
}

class LedgerService {
  /**
   * Get current credits balance (fast path via snapshot).
   */
  async getCreditsBalance(userId) {
    const snap = await UserBalance.findOne({ userId }).lean();
    return snap?.creditsBalance ?? 0;
  }

  /**
   * Apply a balance mutation with full audit trail.
   * - Enforces per-user idempotencyKey uniqueness.
   * - Maintains UserBalance snapshot atomically in the same transaction.
   */
  async applyCreditsMutation({
    userId,
    appId = null, // 新增 appId
    delta,
    reason,
    idempotencyKey,
    type,
    refType = null,
    refId = null,
    meta = null,
  }) {
    if (!userId) throw makeError('BAD_REQUEST', 'userId is required');
    if (!Number.isFinite(delta) || delta === 0) throw makeError('BAD_REQUEST', 'delta must be a non-zero number');
    if (!reason) throw makeError('BAD_REQUEST', 'reason is required');

    // 如果未传入 appId，尝试从 User 自动回填（或者由 caller 传入）
    let targetAppId = appId;
    if (!targetAppId) {
      const User = require('../models/User');
      const user = await User.findById(userId).select('appId').lean();
      targetAppId = user?.appId;
    }

    const finalType =
      type ||
      (delta > 0 ? 'credit' : 'debit');

    const key = idempotencyKey || makeIdempotencyKey(reason);
    const abs = Math.abs(delta);

    const session = await mongoose.startSession();
    try {
      let out;
      try {
        await session.withTransaction(async () => {
          // 1) Idempotency check (fast path)
          const existing = await LedgerEntry.findOne({ userId, idempotencyKey: key }).session(session);
          if (existing) {
            const balance = await UserBalance.findOne({ userId }).session(session).lean();
            out = {
              alreadyApplied: true,
              ledgerEntry: existing,
              balance: balance?.creditsBalance ?? 0,
              idempotencyKey: key,
            };
            return;
          }

          // 2) Update snapshot with constraint for debits
          let updated;
          if (delta < 0) {
            // Ensure a balance doc exists (0 if new user) so debit can be checked with $gte.
            await UserBalance.updateOne(
              { userId },
              { $setOnInsert: { appId: targetAppId, creditsBalance: 0, version: 0 } },
              { upsert: true, session }
            );

            updated = await UserBalance.findOneAndUpdate(
              { userId, creditsBalance: { $gte: abs } },
              { $inc: { creditsBalance: delta, version: 1 } },
              { new: true, upsert: false, session }
            );

            if (!updated) {
              throw makeError('INSUFFICIENT_FUNDS', 'Insufficient credits');
            }
          } else {
            updated = await UserBalance.findOneAndUpdate(
              { userId },
              { 
                $inc: { creditsBalance: delta, version: 1 },
                $set: { appId: targetAppId } // 确保 appId 被设置
              },
              { new: true, upsert: true, setDefaultsOnInsert: true, session }
            );
          }

          // 3) Insert immutable ledger entry
          const created = await LedgerEntry.create(
            [
              {
                userId,
                appId: targetAppId,
                currency: 'credits',
                delta,
                type: finalType,
                reason,
                idempotencyKey: key,
                refType: refType || undefined,
                refId: refId || undefined,
                meta: meta || undefined,
              },
            ],
            { session }
          );

          out = {
            alreadyApplied: false,
            ledgerEntry: created[0],
            balance: updated.creditsBalance,
            idempotencyKey: key,
          };
        });
      } catch (err) {
        // Race safety: if two callers try same idempotencyKey concurrently,
        // one may hit E11000 on LedgerEntry unique index. Convert to alreadyApplied.
        if (isDuplicateKeyError(err)) {
          const existing = await LedgerEntry.findOne({ userId, idempotencyKey: key }).lean();
          const balance = await UserBalance.findOne({ userId }).lean();
          return {
            alreadyApplied: true,
            ledgerEntry: existing,
            balance: balance?.creditsBalance ?? 0,
            idempotencyKey: key,
          };
        }
        throw err;
      }

      return out;
    } finally {
      session.endSession();
    }
  }

  /**
   * List ledger entries for audit/support.
   */
  async listLedger({ userId, limit = 50, cursor = null }) {
    const q = { userId };
    if (cursor) {
      q._id = { $lt: cursor };
    }
    const rows = await LedgerEntry.find(q)
      .sort({ _id: -1 })
      .limit(Math.min(200, Math.max(1, Number(limit) || 50)))
      .lean();

    const nextCursor = rows.length ? rows[rows.length - 1]._id.toString() : null;
    return { rows, nextCursor };
  }
}

module.exports = new LedgerService();

