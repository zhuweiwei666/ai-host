const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

const Product = require('../models/Product');
const Subscription = require('../models/Subscription');
const Purchase = require('../models/Purchase');

const walletService = require('../services/walletService');
const ledgerService = require('../services/ledgerService');
const iapService = require('../services/iapService');

function base64urlDecode(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function decodeJwsPayload(jws) {
  if (!jws || typeof jws !== 'string') return null;
  const parts = jws.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64urlDecode(parts[1]));
  } catch {
    return null;
  }
}

async function ensureDefaultProducts() {
  const count = await Product.countDocuments({});
  if (count > 0) return;

  // Seed with existing top-up products + placeholder subscriptions.
  const seed = [
    { provider: 'ios', productId: 'com.clingai.coins.100', kind: 'topup', creditsAmount: 100, price: '$0.99', currencyCode: 'USD' },
    { provider: 'ios', productId: 'com.clingai.coins.500', kind: 'topup', creditsAmount: 500, price: '$4.99', currencyCode: 'USD' },
    { provider: 'ios', productId: 'com.clingai.coins.1000', kind: 'topup', creditsAmount: 1000, price: '$9.99', currencyCode: 'USD' },
    { provider: 'ios', productId: 'com.clingai.coins.5000', kind: 'topup', creditsAmount: 5000, price: '$39.99', currencyCode: 'USD' },

    { provider: 'android', productId: 'coins_100', kind: 'topup', creditsAmount: 100, price: '$0.99', currencyCode: 'USD' },
    { provider: 'android', productId: 'coins_500', kind: 'topup', creditsAmount: 500, price: '$4.99', currencyCode: 'USD' },
    { provider: 'android', productId: 'coins_1000', kind: 'topup', creditsAmount: 1000, price: '$9.99', currencyCode: 'USD' },
    { provider: 'android', productId: 'coins_5000', kind: 'topup', creditsAmount: 5000, price: '$39.99', currencyCode: 'USD' },

    // Subscription placeholders (edit in DB later)
    {
      provider: 'ios',
      productId: 'com.clingai.sub.basic',
      kind: 'subscription',
      creditsAmount: 0,
      price: '$9.99',
      currencyCode: 'USD',
      meta: { tier: 'basic', monthlyCredits: 3000, discountPercent: 0 },
    },
    {
      provider: 'ios',
      productId: 'com.clingai.sub.pro',
      kind: 'subscription',
      creditsAmount: 0,
      price: '$19.99',
      currencyCode: 'USD',
      meta: { tier: 'pro', monthlyCredits: 8000, discountPercent: 10 },
    },
  ];

  await Product.insertMany(seed.map((p) => ({ ...p, status: 'active' })));
}

// GET /api/billing/products?platform=ios|android|web
router.get('/products', requireAuth, async (req, res) => {
  try {
    await ensureDefaultProducts();
    const { platform } = req.query;
    const q = { status: 'active' };
    if (platform && ['ios', 'android', 'stripe', 'internal'].includes(platform)) {
      q.provider = platform;
    }
    const products = await Product.find(q).sort({ kind: 1, creditsAmount: 1 }).lean();
    return sendSuccess(res, HTTP_STATUS.OK, { products });
  } catch (err) {
    console.error('[billing] products error:', err);
    return errors.internalError(res, 'Failed to list products', { error: err.message });
  }
});

// GET /api/billing/entitlements
router.get('/entitlements', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureDefaultProducts();

    const now = new Date();
    const activeSub = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'trialing'] },
      $or: [{ currentPeriodEnd: null }, { currentPeriodEnd: { $gt: now } }],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const balance = await walletService.getBalance(userId);

    let plan = null;
    if (activeSub) {
      const prod = await Product.findOne({ provider: activeSub.provider, productId: activeSub.productId }).lean();
      plan = {
        provider: activeSub.provider,
        productId: activeSub.productId,
        status: activeSub.status,
        currentPeriodStart: activeSub.currentPeriodStart,
        currentPeriodEnd: activeSub.currentPeriodEnd,
        autoRenew: activeSub.autoRenew,
        tier: prod?.meta?.tier,
        monthlyCredits: prod?.meta?.monthlyCredits || 0,
        discountPercent: prod?.meta?.discountPercent || 0,
      };
    }

    return sendSuccess(res, HTTP_STATUS.OK, {
      balance,
      isSubscriber: !!plan,
      plan,
    });
  } catch (err) {
    console.error('[billing] entitlements error:', err);
    return errors.internalError(res, 'Failed to compute entitlements', { error: err.message });
  }
});

// POST /api/billing/subscription/restore (iOS)
// Body: { platform: "ios", receiptData: string }
router.post('/subscription/restore', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform, receiptData } = req.body || {};

    if (platform !== 'ios') {
      return errors.badRequest(res, 'Only ios is supported for subscription restore currently', { code: 'INVALID_PLATFORM' });
    }
    if (!receiptData) return errors.badRequest(res, 'receiptData is required', { code: 'MISSING_RECEIPT' });

    await ensureDefaultProducts();

    const v = await iapService.verifyAppleSubscriptionReceipt(receiptData);
    const product = await Product.findOne({ provider: 'ios', productId: v.productId, kind: 'subscription' }).lean();

    // Upsert subscription
    const status = v.isActive ? 'active' : 'expired';
    const sub = await Subscription.findOneAndUpdate(
      { provider: 'ios', providerSubId: v.originalTransactionId },
      {
        $set: {
          userId,
          productId: v.productId,
          status,
          currentPeriodStart: v.purchaseDate || null,
          currentPeriodEnd: v.expiresDate || null,
          autoRenew: v.autoRenew ?? true,
          lastEventAt: new Date(),
          raw: {
            environment: v.environment,
            transactionId: v.transactionId,
          },
        },
      },
      { upsert: true, new: true }
    ).lean();

    // Grant monthly allowance (if configured) with strict idempotency.
    if (v.isActive && product?.meta?.monthlyCredits) {
      const periodKey = v.expiresDate ? v.expiresDate.toISOString().slice(0, 10) : 'unknown';
      const idempotencyKey = `sub_allowance:ios:${v.originalTransactionId}:${periodKey}`;
      await ledgerService.applyCreditsMutation({
        userId,
        delta: Number(product.meta.monthlyCredits),
        reason: 'subscription_allowance',
        idempotencyKey,
        type: 'credit',
        refType: 'subscription',
        refId: v.originalTransactionId,
        meta: { productId: v.productId, periodEnd: v.expiresDate, tier: product?.meta?.tier },
      });
    }

    const balance = await walletService.getBalance(userId);
    return sendSuccess(res, HTTP_STATUS.OK, { subscription: sub, balance });
  } catch (err) {
    console.error('[billing] subscription restore error:', err);
    return errors.badRequest(res, 'Subscription restore failed', { error: err.message });
  }
});

// POST /api/billing/purchase/verify (top-ups)
// Body: { platform: "ios"|"android", receiptData? purchaseToken? productId? packageName? }
router.post('/purchase/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform, receiptData, purchaseToken, productId, packageName } = req.body || {};

    if (!platform || !['ios', 'android'].includes(platform)) {
      return errors.badRequest(res, 'platform must be "ios" or "android"', { code: 'INVALID_PLATFORM' });
    }

    let verificationResult;
    let providerTxnId;

    if (platform === 'ios') {
      if (!receiptData) return errors.badRequest(res, 'receiptData is required for iOS', { code: 'MISSING_RECEIPT' });
      verificationResult = await iapService.verifyAppleReceipt(receiptData);
      providerTxnId = verificationResult.transactionId;
    } else {
      if (!purchaseToken || !productId) {
        return errors.badRequest(res, 'purchaseToken and productId are required for Android', { code: 'MISSING_PARAMS' });
      }
      verificationResult = await iapService.verifyGooglePurchase(
        purchaseToken,
        productId,
        packageName || process.env.ANDROID_PACKAGE_NAME
      );
      providerTxnId = purchaseToken;
    }

    const existing = await Purchase.findOne({ provider: platform, providerTxnId: providerTxnId });
    if (existing) {
      const balance = await walletService.getBalance(userId);
      return sendSuccess(res, HTTP_STATUS.OK, { verified: true, alreadyProcessed: true, balance, transactionId: providerTxnId });
    }

    const coins = verificationResult.coins || iapService.getCoinsForProduct(verificationResult.productId);
    if (!coins || coins <= 0) return errors.badRequest(res, 'Unknown product or zero coins', { code: 'UNKNOWN_PRODUCT' });

    const idempotencyKey = `purchase:${platform}:${providerTxnId}`;
    const balance = await walletService.reward(userId, coins, 'iap_purchase', verificationResult.productId, null, idempotencyKey);

    await Purchase.create({
      provider: platform,
      providerTxnId,
      userId,
      productId: verificationResult.productId,
      status: 'completed',
      environment: verificationResult.environment,
      raw: { coins },
    });

    return sendSuccess(res, HTTP_STATUS.OK, { verified: true, alreadyProcessed: false, coins, balance, transactionId: providerTxnId });
  } catch (err) {
    console.error('[billing] purchase verify error:', err);
    return errors.badRequest(res, 'Purchase verification failed', { error: err.message });
  }
});

// POST /api/billing/webhooks/apple
// Body: { signedPayload: string }
router.post('/webhooks/apple', async (req, res) => {
  try {
    const secret = process.env.APPLE_WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
      return errors.forbidden(res, 'Invalid webhook secret');
    }

    const { signedPayload } = req.body || {};
    if (!signedPayload) return errors.badRequest(res, 'signedPayload is required');

    const payload = decodeJwsPayload(signedPayload) || {};
    const data = payload.data || {};
    const tx = decodeJwsPayload(data.signedTransactionInfo) || {};
    const renewal = decodeJwsPayload(data.signedRenewalInfo) || {};

    const providerSubId = tx.originalTransactionId || tx.original_transaction_id || null;
    const productId = tx.productId || tx.product_id || null;

    if (providerSubId && productId) {
      // Best-effort status mapping
      let status = 'active';
      if (tx.revocationDate || tx.revocation_date) status = 'revoked';
      if (payload.notificationType === 'EXPIRED') status = 'expired';
      if (payload.notificationType === 'CANCEL') status = 'canceled';

      const periodEndMs = tx.expiresDate ? Number(tx.expiresDate) : (tx.expires_date ? Number(tx.expires_date) : null);
      const periodEnd = periodEndMs ? new Date(periodEndMs) : null;
      const periodStartMs = tx.purchaseDate ? Number(tx.purchaseDate) : null;
      const periodStart = periodStartMs ? new Date(periodStartMs) : null;

      await Subscription.findOneAndUpdate(
        { provider: 'ios', providerSubId },
        {
          $set: {
            productId,
            status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            autoRenew: renewal.autoRenewStatus ? renewal.autoRenewStatus === 1 : true,
            lastEventAt: new Date(),
            raw: { payloadType: payload.notificationType, payload, tx, renewal },
          },
        },
        { upsert: true, new: false }
      );
    }

    return sendSuccess(res, HTTP_STATUS.OK, { ok: true });
  } catch (err) {
    console.error('[billing] apple webhook error:', err);
    // webhooks should ACK to avoid retries storms; still return 200 with error info
    return sendSuccess(res, HTTP_STATUS.OK, { ok: false, error: err.message });
  }
});

// POST /api/billing/webhooks/google (stub)
router.post('/webhooks/google', async (req, res) => {
  const secret = process.env.GOOGLE_WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return errors.forbidden(res, 'Invalid webhook secret');
  }
  return sendSuccess(res, HTTP_STATUS.OK, { ok: true, note: 'google webhook stub' });
});

// POST /api/billing/webhooks/stripe (stub)
router.post('/webhooks/stripe', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return errors.forbidden(res, 'Invalid webhook secret');
  }
  return sendSuccess(res, HTTP_STATUS.OK, { ok: true, note: 'stripe webhook stub' });
});

// Admin-only: set products (optional helper)
router.post('/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { products } = req.body || {};
    if (!Array.isArray(products)) return errors.badRequest(res, 'products[] is required');
    await Promise.all(
      products.map((p) =>
        Product.findOneAndUpdate(
          { provider: p.provider, productId: p.productId },
          { $set: p },
          { upsert: true, new: false, strict: false }
        )
      )
    );
    return sendSuccess(res, HTTP_STATUS.OK, { ok: true });
  } catch (err) {
    console.error('[billing] products upsert error:', err);
    return errors.internalError(res, 'Failed to upsert products', { error: err.message });
  }
});

module.exports = router;

