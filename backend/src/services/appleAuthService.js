/**
 * Apple Sign In Verification Service
 * Verifies Apple identityToken using Apple's public keys
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

// Apple's public keys endpoint
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

// Cache for Apple's public keys
let appleKeysCache = null;
let keysCacheExpiry = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Apple's public keys (with caching)
 */
async function getApplePublicKeys() {
  const now = Date.now();
  
  if (appleKeysCache && now < keysCacheExpiry) {
    return appleKeysCache;
  }
  
  try {
    const response = await axios.get(APPLE_KEYS_URL, { timeout: 10000 });
    appleKeysCache = response.data.keys;
    keysCacheExpiry = now + CACHE_DURATION;
    return appleKeysCache;
  } catch (error) {
    console.error('[Apple Auth] Failed to fetch public keys:', error.message);
    // Return cached keys if available, even if expired
    if (appleKeysCache) {
      console.warn('[Apple Auth] Using expired cached keys');
      return appleKeysCache;
    }
    throw new Error('Failed to fetch Apple public keys');
  }
}

/**
 * Convert Apple's JWK to PEM format
 */
function jwkToPem(jwk) {
  const { n, e } = jwk;
  
  // Base64url decode
  const nBuffer = Buffer.from(n, 'base64url');
  const eBuffer = Buffer.from(e, 'base64url');
  
  // Build the RSA public key in DER format
  const nLen = nBuffer.length;
  const eLen = eBuffer.length;
  
  // ASN.1 DER encoding for RSA public key
  const sequence = Buffer.concat([
    Buffer.from([0x30]), // SEQUENCE
    encodeLength(nLen + eLen + 4 + (nBuffer[0] & 0x80 ? 1 : 0) + (eBuffer[0] & 0x80 ? 1 : 0)),
    Buffer.from([0x02]), // INTEGER (n)
    encodeLength(nLen + (nBuffer[0] & 0x80 ? 1 : 0)),
    nBuffer[0] & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0),
    nBuffer,
    Buffer.from([0x02]), // INTEGER (e)
    encodeLength(eLen + (eBuffer[0] & 0x80 ? 1 : 0)),
    eBuffer[0] & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0),
    eBuffer,
  ]);
  
  // Wrap in PKCS#1 format
  const pkcs1 = Buffer.concat([
    Buffer.from([0x30]), // SEQUENCE
    encodeLength(sequence.length + 13),
    Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]), // Algorithm identifier
    Buffer.from([0x03]), // BIT STRING
    encodeLength(sequence.length + 1),
    Buffer.from([0x00]), // No unused bits
    sequence,
  ]);
  
  const pem = `-----BEGIN PUBLIC KEY-----\n${pkcs1.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
  return pem;
}

function encodeLength(length) {
  if (length < 128) {
    return Buffer.from([length]);
  }
  const bytes = [];
  let temp = length;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/**
 * Verify Apple identityToken
 * @param {string} identityToken - The JWT token from Apple
 * @param {string} bundleId - Your app's bundle ID (optional, for additional validation)
 * @returns {object} Decoded token payload with user info
 */
async function verifyIdentityToken(identityToken, bundleId = null) {
  if (!identityToken) {
    throw new Error('Identity token is required');
  }
  
  try {
    // Decode header to get the key ID (kid)
    const header = JSON.parse(Buffer.from(identityToken.split('.')[0], 'base64url').toString());
    const kid = header.kid;
    
    if (!kid) {
      throw new Error('No key ID (kid) found in token header');
    }
    
    // Get Apple's public keys
    const keys = await getApplePublicKeys();
    const key = keys.find(k => k.kid === kid);
    
    if (!key) {
      throw new Error(`No matching key found for kid: ${kid}`);
    }
    
    // Convert JWK to PEM
    const pem = jwkToPem(key);
    
    // Verify the token
    const decoded = jwt.verify(identityToken, pem, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
    });
    
    // Additional validation
    if (bundleId && decoded.aud !== bundleId) {
      throw new Error(`Token audience (${decoded.aud}) does not match bundle ID (${bundleId})`);
    }
    
    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      throw new Error('Token has expired');
    }
    
    return {
      sub: decoded.sub, // Apple User ID (unique, stable)
      email: decoded.email || null,
      email_verified: decoded.email_verified === 'true' || decoded.email_verified === true,
      is_private_email: decoded.is_private_email === 'true' || decoded.is_private_email === true,
      real_user_status: decoded.real_user_status, // 0: unsupported, 1: unknown, 2: likely real
      aud: decoded.aud, // Your app's bundle ID
      iss: decoded.iss, // Should be https://appleid.apple.com
    };
  } catch (error) {
    console.error('[Apple Auth] Token verification failed:', error.message);
    throw new Error(`Apple token verification failed: ${error.message}`);
  }
}

module.exports = {
  verifyIdentityToken,
  getApplePublicKeys,
};

