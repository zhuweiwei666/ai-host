/**
 * Normalize image URLs to ensure they use OSS URLs instead of local server paths
 * @param url - Image URL (can be relative path like /uploads/xxx.jpg or full OSS URL)
 * @param placeholder - Placeholder URL to use if URL is invalid (default: placeholder image)
 * @returns Normalized URL (OSS URL or full URL)
 */
export function normalizeImageUrl(url: string | undefined | null, placeholder: string = 'https://via.placeholder.com/64'): string {
  if (!url) {
    return placeholder;
  }

  // If already a full URL (http/https), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it's a relative path starting with /uploads/, it's an old local file
  // These should have been migrated to OSS, but if not, we can't load them
  // Return placeholder to avoid 500 errors
  if (url.startsWith('/uploads/')) {
    console.warn('[Image URL] Found old local path (should be migrated to OSS):', url);
    return placeholder;
  }

  // If it's a server IP path (old format), also return placeholder
  if (url.includes('47.245.121.93/uploads/')) {
    console.warn('[Image URL] Found server IP path (should be migrated to OSS):', url);
    return placeholder;
  }

  // If it's a relative path without /uploads/, assume it's already an OSS path
  // OSS URLs are typically full URLs, so this shouldn't happen, but handle it
  return url;
}

/**
 * Check if a URL is a local server path that should be migrated to OSS
 */
export function isLocalPath(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('/uploads/') || url.includes('47.245.121.93/uploads/');
}

