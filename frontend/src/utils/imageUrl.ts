/**
 * Normalize image URLs to ensure they can be loaded correctly
 * @param url - Image URL (can be relative path like /uploads/xxx.jpg or full URL)
 * @param placeholder - Placeholder URL to use if URL is invalid (default: placeholder image)
 * @returns Normalized URL
 */
export function normalizeImageUrl(url: string | undefined | null, placeholder: string = 'https://via.placeholder.com/64'): string {
  if (!url) {
    return placeholder;
  }

  // Skip loading placeholder
  if (url === 'loading_placeholder') {
    return placeholder;
  }

  // If already a full URL (http/https), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it's a relative path starting with /uploads/, prepend API base URL
  if (url.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://www.cling-ai.com';
    return `${apiBase}${url}`;
  }

  // For any other relative path, prepend API base URL
  return url;
}

/**
 * Check if a URL is a local server path
 */
export function isLocalPath(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('/uploads/');
}

