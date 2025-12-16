/**
 * Media Proxy API
 *
 * Purpose:
 * - Work around client-side TLS / network issues reaching Cloudflare R2 public domain (r2.dev)
 * - Allow iOS to fetch images/videos through our own domain (same TLS as API)
 *
 * Security:
 * - Strict allowlist of upstream hosts
 * - Only allows common media file types
 * - No auth required (public media), but still rate-limited by global limiter
 *
 * Usage:
 * GET /api/media/proxy?url=<encoded_public_media_url>
 */

const express = require('express');
const axios = require('axios');
const { errors } = require('../utils/errorHandler');

const router = express.Router();

function isAllowedUpstream(urlObj) {
  const host = (urlObj.hostname || '').toLowerCase();
  // Allow Cloudflare R2 public dev domain and common subdomains
  if (host === 'r2.dev' || host.endsWith('.r2.dev')) return true;
  return false;
}

function isAllowedPath(urlObj) {
  const p = (urlObj.pathname || '').toLowerCase();
  // Basic media allowlist
  return (
    p.endsWith('.png') ||
    p.endsWith('.jpg') ||
    p.endsWith('.jpeg') ||
    p.endsWith('.webp') ||
    p.endsWith('.gif') ||
    p.endsWith('.mp4') ||
    p.endsWith('.mp3') ||
    p.endsWith('.m4a') ||
    p.endsWith('.wav')
  );
}

router.get('/proxy', async (req, res) => {
  try {
    const raw = String(req.query.url || '');
    if (!raw) return errors.badRequest(res, 'Missing url');

    let urlObj;
    try {
      urlObj = new URL(raw);
    } catch {
      return errors.badRequest(res, 'Invalid url');
    }

    if (urlObj.protocol !== 'https:') {
      return errors.badRequest(res, 'Only https url is allowed');
    }

    if (!isAllowedUpstream(urlObj)) {
      return errors.forbidden(res, 'Upstream host not allowed');
    }

    if (!isAllowedPath(urlObj)) {
      return errors.forbidden(res, 'File type not allowed');
    }

    const upstream = await axios.get(urlObj.toString(), {
      responseType: 'stream',
      timeout: 60000,
      // Avoid sending our auth headers to upstream
      headers: {
        'User-Agent': 'ai-host-media-proxy/1.0',
      },
      maxRedirects: 3,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    // Mirror important headers
    const ct = upstream.headers['content-type'];
    if (ct) res.setHeader('Content-Type', ct);

    const cl = upstream.headers['content-length'];
    if (cl) res.setHeader('Content-Length', cl);

    // Cache at edge/client for a bit
    res.setHeader('Cache-Control', 'public, max-age=3600');

    upstream.data.pipe(res);
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.statusText || err.message || 'Proxy failed';
    console.error('[Media Proxy] Error:', status, msg);
    return errors.badGateway(res, 'Media proxy failed', { status, message: msg });
  }
});

module.exports = router;

