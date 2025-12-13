/**
 * In-App Purchase (IAP) Verification Service
 * Supports both Apple App Store and Google Play Store
 */

const axios = require('axios');

// Apple App Store URLs
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

// Product ID to coins mapping (configure based on your products)
const PRODUCT_COINS_MAP = {
  // iOS Products
  'com.clingai.coins.100': 100,
  'com.clingai.coins.500': 500,
  'com.clingai.coins.1000': 1000,
  'com.clingai.coins.5000': 5000,
  // Android Products
  'coins_100': 100,
  'coins_500': 500,
  'coins_1000': 1000,
  'coins_5000': 5000,
};

/**
 * Verify Apple App Store receipt
 * @param {string} receiptData - Base64 encoded receipt data
 * @param {boolean} isSandbox - Whether to use sandbox environment
 * @returns {object} Verification result with purchase info
 */
async function verifyAppleReceipt(receiptData, isSandbox = false) {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  
  if (!sharedSecret) {
    console.warn('[IAP] APPLE_SHARED_SECRET not configured, using receipt-only verification');
  }
  
  const requestBody = {
    'receipt-data': receiptData,
    'exclude-old-transactions': true,
  };
  
  if (sharedSecret) {
    requestBody.password = sharedSecret;
  }
  
  // Try production first, then sandbox if needed
  let url = isSandbox ? APPLE_SANDBOX_URL : APPLE_PRODUCTION_URL;
  
  try {
    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    
    const result = response.data;
    
    // Status 21007 means receipt is from sandbox - retry with sandbox URL
    if (result.status === 21007 && !isSandbox) {
      console.log('[IAP] Receipt is from sandbox, retrying...');
      return verifyAppleReceipt(receiptData, true);
    }
    
    // Status codes: https://developer.apple.com/documentation/appstorereceipts/status
    if (result.status !== 0) {
      const statusMessages = {
        21000: 'The App Store could not read the JSON',
        21002: 'The receipt data is malformed',
        21003: 'The receipt could not be authenticated',
        21004: 'The shared secret does not match',
        21005: 'The receipt server is unavailable',
        21006: 'This receipt is valid but the subscription has expired',
        21007: 'This receipt is from sandbox (handled above)',
        21008: 'This receipt is from production (but you sent to sandbox)',
        21010: 'This receipt could not be authorized',
      };
      
      throw new Error(statusMessages[result.status] || `Unknown status: ${result.status}`);
    }
    
    // Extract latest transaction info
    const latestReceipt = result.latest_receipt_info || result.receipt?.in_app || [];
    const latestTransaction = Array.isArray(latestReceipt) 
      ? latestReceipt[latestReceipt.length - 1] 
      : latestReceipt;
    
    if (!latestTransaction) {
      throw new Error('No transaction found in receipt');
    }
    
    return {
      valid: true,
      environment: result.environment, // 'Sandbox' or 'Production'
      bundleId: result.receipt?.bundle_id,
      productId: latestTransaction.product_id,
      transactionId: latestTransaction.transaction_id,
      originalTransactionId: latestTransaction.original_transaction_id,
      purchaseDate: new Date(parseInt(latestTransaction.purchase_date_ms)),
      quantity: parseInt(latestTransaction.quantity) || 1,
      coins: PRODUCT_COINS_MAP[latestTransaction.product_id] || 0,
    };
  } catch (error) {
    console.error('[IAP] Apple receipt verification failed:', error.message);
    throw error;
  }
}

/**
 * Verify Apple subscription receipt and extract latest subscription status.
 * NOTE: This uses verifyReceipt (legacy). For maximum robustness, migrate to App Store Server API + JWS later.
 */
async function verifyAppleSubscriptionReceipt(receiptData, isSandbox = false) {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;

  const requestBody = {
    'receipt-data': receiptData,
    'exclude-old-transactions': true,
  };
  if (sharedSecret) requestBody.password = sharedSecret;

  let url = isSandbox ? APPLE_SANDBOX_URL : APPLE_PRODUCTION_URL;

  const response = await axios.post(url, requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  const result = response.data;
  if (result.status === 21007 && !isSandbox) {
    return verifyAppleSubscriptionReceipt(receiptData, true);
  }
  if (result.status !== 0) {
    throw new Error(`Apple receipt status=${result.status}`);
  }

  const infos = Array.isArray(result.latest_receipt_info) ? result.latest_receipt_info : (result.receipt?.in_app || []);
  if (!infos || !infos.length) throw new Error('No subscription transaction found in receipt');

  // Pick the newest by expires_date_ms if present, else by purchase_date_ms
  const sorted = infos
    .slice()
    .sort((a, b) => Number(a.expires_date_ms || a.purchase_date_ms || 0) - Number(b.expires_date_ms || b.purchase_date_ms || 0));
  const latest = sorted[sorted.length - 1];

  const expiresMs = latest.expires_date_ms ? Number(latest.expires_date_ms) : null;
  const now = Date.now();
  const isActive = expiresMs ? expiresMs > now : false;

  // pending_renewal_info may include auto_renew_status for subscriptions
  const pri = Array.isArray(result.pending_renewal_info) ? result.pending_renewal_info : [];
  const renewal = pri.find((x) => x.original_transaction_id === latest.original_transaction_id) || pri[0] || null;
  const autoRenew = renewal ? renewal.auto_renew_status === '1' : null;

  return {
    valid: true,
    environment: result.environment,
    bundleId: result.receipt?.bundle_id,
    productId: latest.product_id,
    transactionId: latest.transaction_id,
    originalTransactionId: latest.original_transaction_id,
    purchaseDate: latest.purchase_date_ms ? new Date(Number(latest.purchase_date_ms)) : null,
    expiresDate: expiresMs ? new Date(expiresMs) : null,
    isActive,
    autoRenew,
  };
}

/**
 * Verify Google Play purchase
 * @param {string} purchaseToken - The purchase token from Google Play
 * @param {string} productId - The product ID
 * @param {string} packageName - Your app's package name
 * @returns {object} Verification result with purchase info
 */
async function verifyGooglePurchase(purchaseToken, productId, packageName) {
  const enabled = process.env.ENABLE_GOOGLE_PLAY === 'true';
  if (!enabled) {
    throw new Error('GOOGLE_PLAY_DISABLED');
  }
  // Google Play verification requires OAuth2 credentials
  // This is a simplified version - in production, use googleapis library
  
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!clientEmail || !privateKey) {
    throw new Error('Google Play credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY');
  }
  
  try {
    // TODO: implement Google Play Developer API verification.
    // For now: fail closed to avoid crediting fraudulently.
    throw new Error('GOOGLE_PLAY_NOT_IMPLEMENTED');
  } catch (error) {
    console.error('[IAP] Google purchase verification failed:', error.message);
    throw error;
  }
}

/**
 * Get coins amount for a product
 * @param {string} productId - The product ID
 * @returns {number} Number of coins
 */
function getCoinsForProduct(productId) {
  return PRODUCT_COINS_MAP[productId] || 0;
}

/**
 * Add new product to the mapping
 * @param {string} productId - The product ID
 * @param {number} coins - Number of coins
 */
function addProduct(productId, coins) {
  PRODUCT_COINS_MAP[productId] = coins;
}

module.exports = {
  verifyAppleReceipt,
  verifyAppleSubscriptionReceipt,
  verifyGooglePurchase,
  getCoinsForProduct,
  addProduct,
  PRODUCT_COINS_MAP,
};

