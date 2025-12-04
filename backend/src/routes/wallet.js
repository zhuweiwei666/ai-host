const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const iapService = require('../services/iapService');
const { requireAuth } = require('../middleware/auth');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

// Model for tracking IAP transactions
const mongoose = require('mongoose');

// Simple IAP transaction log schema (inline)
const IAPTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  transactionId: { type: String, required: true, unique: true },
  originalTransactionId: { type: String },
  productId: { type: String, required: true },
  coins: { type: Number, required: true },
  environment: { type: String }, // 'Sandbox' or 'Production'
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'completed' },
  rawReceipt: { type: String }, // Store receipt for audit
}, { timestamps: true });

IAPTransactionSchema.index({ userId: 1, createdAt: -1 });
IAPTransactionSchema.index({ transactionId: 1 });

const IAPTransaction = mongoose.models.IAPTransaction || mongoose.model('IAPTransaction', IAPTransactionSchema);

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/wallet/balance
// Returns balance for authenticated user
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await walletService.getBalance(userId);
    sendSuccess(res, HTTP_STATUS.OK, { balance });
  } catch (err) {
    console.error(err);
    errors.internalError(res, 'Error fetching balance', { error: err.message });
  }
});

// POST /api/wallet/reward/ad
// Reward for watching an ad (requires traceId to prevent duplicate rewards)
router.post('/reward/ad', async (req, res) => {
  try {
    const userId = req.user.id;
    const { traceId } = req.body;
    
    if (!traceId) {
      return errors.badRequest(res, 'traceId is required to prevent duplicate rewards', { code: 'TRACE_ID_REQUIRED' });
    }

    // Fixed reward for watching ad: +50 Coins
    // traceId is passed as 5th parameter for duplicate prevention
    const newBalance = await walletService.reward(userId, 50, 'ad_reward', traceId, traceId);
    
    sendSuccess(res, 200, { balance: newBalance }, 'Ad reward received! +50 Coins');
  } catch (err) {
    console.error('Ad reward error:', err);
    if (err.message === 'DUPLICATE_REWARD') {
      return errors.conflict(res, 'This ad reward has already been claimed', { code: 'DUPLICATE_REWARD' });
    }
    errors.internalError(res, 'Error processing reward', { error: err.message });
  }
});

// POST /api/wallet/verify-purchase - Verify IAP purchase and credit coins
// Supports both Apple App Store and Google Play
router.post('/verify-purchase', async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform, receiptData, purchaseToken, productId, packageName } = req.body;

    // Validation
    if (!platform || !['ios', 'android'].includes(platform)) {
      return errors.badRequest(res, 'platform must be "ios" or "android"', { code: 'INVALID_PLATFORM' });
    }

    let verificationResult;
    let transactionId;

    if (platform === 'ios') {
      // Apple App Store verification
      if (!receiptData) {
        return errors.badRequest(res, 'receiptData is required for iOS', { code: 'MISSING_RECEIPT' });
      }

      try {
        verificationResult = await iapService.verifyAppleReceipt(receiptData);
        transactionId = verificationResult.transactionId;
      } catch (verifyError) {
        console.error('Apple receipt verification failed:', verifyError);
        return errors.badRequest(res, 'Invalid receipt', { 
          code: 'INVALID_RECEIPT',
          error: verifyError.message 
        });
      }
    } else {
      // Google Play verification
      if (!purchaseToken || !productId) {
        return errors.badRequest(res, 'purchaseToken and productId are required for Android', { code: 'MISSING_PARAMS' });
      }

      try {
        verificationResult = await iapService.verifyGooglePurchase(
          purchaseToken, 
          productId, 
          packageName || process.env.ANDROID_PACKAGE_NAME
        );
        transactionId = purchaseToken; // Use purchase token as transaction ID
      } catch (verifyError) {
        console.error('Google purchase verification failed:', verifyError);
        return errors.badRequest(res, 'Invalid purchase', { 
          code: 'INVALID_PURCHASE',
          error: verifyError.message 
        });
      }
    }

    // Check if this transaction was already processed
    const existingTransaction = await IAPTransaction.findOne({ transactionId });
    if (existingTransaction) {
      // Return success but don't credit coins again
      const balance = await walletService.getBalance(userId);
      return sendSuccess(res, HTTP_STATUS.OK, {
        verified: true,
        alreadyProcessed: true,
        coins: existingTransaction.coins,
        balance: balance,
        transactionId: transactionId
      });
    }

    // Get coins amount for this product
    const coins = verificationResult.coins || iapService.getCoinsForProduct(verificationResult.productId);
    
    if (coins <= 0) {
      return errors.badRequest(res, 'Unknown product or zero coins', { 
        code: 'UNKNOWN_PRODUCT',
        productId: verificationResult.productId 
      });
    }

    // Credit coins to user
    const newBalance = await walletService.reward(userId, coins, 'iap_purchase', verificationResult.productId);

    // Record the transaction
    await IAPTransaction.create({
      userId: userId,
      platform: platform,
      transactionId: transactionId,
      originalTransactionId: verificationResult.originalTransactionId,
      productId: verificationResult.productId,
      coins: coins,
      environment: verificationResult.environment,
      status: 'completed',
      rawReceipt: platform === 'ios' ? receiptData?.substring(0, 500) : purchaseToken?.substring(0, 500) // Store partial for audit
    });

    console.log(`[IAP] Credited ${coins} coins to user ${userId} for ${verificationResult.productId}`);

    sendSuccess(res, HTTP_STATUS.OK, {
      verified: true,
      alreadyProcessed: false,
      coins: coins,
      balance: newBalance,
      transactionId: transactionId,
      productId: verificationResult.productId,
      environment: verificationResult.environment
    });

  } catch (err) {
    console.error('IAP verification error:', err);
    errors.internalError(res, 'Failed to verify purchase', { error: err.message });
  }
});

// GET /api/wallet/products - Get available IAP products
router.get('/products', async (req, res) => {
  try {
    const { platform } = req.query;

    // Define available products
    const products = {
      ios: [
        { productId: 'com.clingai.coins.100', coins: 100, price: '$0.99', description: '100 AI Coins' },
        { productId: 'com.clingai.coins.500', coins: 500, price: '$4.99', description: '500 AI Coins' },
        { productId: 'com.clingai.coins.1000', coins: 1000, price: '$9.99', description: '1000 AI Coins' },
        { productId: 'com.clingai.coins.5000', coins: 5000, price: '$39.99', description: '5000 AI Coins' },
      ],
      android: [
        { productId: 'coins_100', coins: 100, price: '$0.99', description: '100 AI Coins' },
        { productId: 'coins_500', coins: 500, price: '$4.99', description: '500 AI Coins' },
        { productId: 'coins_1000', coins: 1000, price: '$9.99', description: '1000 AI Coins' },
        { productId: 'coins_5000', coins: 5000, price: '$39.99', description: '5000 AI Coins' },
      ]
    };

    if (platform && products[platform]) {
      return sendSuccess(res, HTTP_STATUS.OK, { products: products[platform] });
    }

    sendSuccess(res, HTTP_STATUS.OK, { products });
  } catch (err) {
    console.error('Get products error:', err);
    errors.internalError(res, 'Failed to get products', { error: err.message });
  }
});

// GET /api/wallet/transactions - Get user's transaction history
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const transactions = await IAPTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-rawReceipt'); // Don't expose raw receipt

    const total = await IAPTransaction.countDocuments({ userId });

    sendSuccess(res, HTTP_STATUS.OK, {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get transactions error:', err);
    errors.internalError(res, 'Failed to get transactions', { error: err.message });
  }
});

module.exports = router;

