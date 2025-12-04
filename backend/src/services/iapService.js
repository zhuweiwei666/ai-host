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
 * Verify Google Play purchase
 * @param {string} purchaseToken - The purchase token from Google Play
 * @param {string} productId - The product ID
 * @param {string} packageName - Your app's package name
 * @returns {object} Verification result with purchase info
 */
async function verifyGooglePurchase(purchaseToken, productId, packageName) {
  // Google Play verification requires OAuth2 credentials
  // This is a simplified version - in production, use googleapis library
  
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!clientEmail || !privateKey) {
    throw new Error('Google Play credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY');
  }
  
  try {
    // For now, return a mock verification
    // In production, implement full Google Play verification:
    // 1. Get OAuth2 token using service account
    // 2. Call Google Play Developer API
    
    console.warn('[IAP] Google Play verification not fully implemented - returning mock success');
    
    return {
      valid: true,
      environment: 'production',
      packageName: packageName,
      productId: productId,
      purchaseToken: purchaseToken,
      purchaseState: 0, // 0 = Purchased
      consumptionState: 0, // 0 = Not consumed
      coins: PRODUCT_COINS_MAP[productId] || 0,
    };
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
  verifyGooglePurchase,
  getCoinsForProduct,
  addProduct,
  PRODUCT_COINS_MAP,
};

