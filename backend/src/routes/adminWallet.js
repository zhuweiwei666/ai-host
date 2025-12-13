const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

const ledgerService = require('../services/ledgerService');
const walletService = require('../services/walletService');

// POST /api/admin/wallet/grant
// Body: { userId: string, delta: number, reason?: string, idempotencyKey?: string, refId?: string }
router.post('/wallet/grant', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, delta, reason, idempotencyKey, refId } = req.body || {};
    if (!userId) return errors.badRequest(res, 'userId is required');
    const num = Number(delta);
    if (!Number.isFinite(num) || num === 0) return errors.badRequest(res, 'delta must be a non-zero number');

    // Ensure user init/migration
    await walletService.getBalance(userId);

    const out = await ledgerService.applyCreditsMutation({
      userId,
      delta: num,
      reason: reason || 'admin_grant',
      idempotencyKey: idempotencyKey || `admin_grant:${userId}:${Date.now()}`,
      type: num > 0 ? 'credit' : 'adjustment',
      refType: 'admin',
      refId: refId ? String(refId) : undefined,
      meta: { by: req.user.id },
    });

    return sendSuccess(res, HTTP_STATUS.OK, { balance: out.balance, ledgerEntryId: out.ledgerEntry?._id });
  } catch (err) {
    console.error('[adminWallet] grant error:', err);
    return errors.internalError(res, 'Failed to grant wallet balance', { error: err.message });
  }
});

module.exports = router;

