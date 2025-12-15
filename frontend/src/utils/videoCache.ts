/**
 * 视频缓存工具
 * 使用 Cache API 缓存 IDLE 视频，避免重复下载
 */

const CACHE_NAME = 'idle-videos-v1';
const CACHE_MAX_SIZE = 500 * 1024 * 1024; // 500MB 最大缓存
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天过期

// CachedVideo interface (for future use if needed)
// interface CachedVideo {
//   url: string;
//   blob: Blob;
//   cachedAt: number;
//   size: number;
// }

/**
 * 初始化缓存
 */
async function initCache(): Promise<Cache | null> {
  if (!('caches' in window)) {
    console.warn('[VideoCache] Cache API not supported');
    return null;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    return cache;
  } catch (err) {
    console.error('[VideoCache] Failed to open cache:', err);
    return null;
  }
}

/**
 * 获取缓存的视频
 */
export async function getCachedVideo(url: string): Promise<Blob | null> {
  const cache = await initCache();
  if (!cache) return null;

  try {
    const response = await cache.match(url);
    if (!response) return null;

    // 检查是否过期（通过 metadata）
    const cachedAt = response.headers.get('X-Cached-At');
    if (cachedAt) {
      const age = Date.now() - parseInt(cachedAt, 10);
      if (age > CACHE_EXPIRY) {
        // 过期，删除
        await cache.delete(url);
        return null;
      }
    }

    const blob = await response.blob();
    console.log(`[VideoCache] Cache hit: ${url.substring(0, 50)}...`);
    return blob;
  } catch (err) {
    console.error('[VideoCache] Failed to get cached video:', err);
    return null;
  }
}

/**
 * 缓存视频
 */
export async function cacheVideo(url: string, blob: Blob): Promise<void> {
  const cache = await initCache();
  if (!cache) return;

  try {
    // 检查缓存大小，如果超过限制则清理
    await cleanupCacheIfNeeded(blob.size);

    // 创建 Response 并添加 metadata
    const response = new Response(blob, {
      headers: {
        'Content-Type': blob.type || 'video/mp4',
        'X-Cached-At': Date.now().toString(),
        'X-Content-Length': blob.size.toString(),
      },
    });

    await cache.put(url, response);
    console.log(`[VideoCache] Cached: ${url.substring(0, 50)}... (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
  } catch (err) {
    console.error('[VideoCache] Failed to cache video:', err);
  }
}

/**
 * 获取视频（优先从缓存，否则下载并缓存）
 */
export async function getVideoWithCache(url: string): Promise<string> {
  // 先检查缓存
  const cachedBlob = await getCachedVideo(url);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }

  // 缓存未命中，下载并缓存
  console.log(`[VideoCache] Cache miss, downloading: ${url.substring(0, 50)}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const blob = await response.blob();
    
    // 异步缓存（不阻塞返回）
    cacheVideo(url, blob).catch(err => {
      console.warn('[VideoCache] Failed to cache video (non-blocking):', err);
    });

    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('[VideoCache] Failed to fetch video:', err);
    throw err;
  }
}

/**
 * 清理缓存（如果超过大小限制）
 */
async function cleanupCacheIfNeeded(newSize: number): Promise<void> {
  const cache = await initCache();
  if (!cache) return;

  try {
    const keys = await cache.keys();
    let totalSize = 0;
    const entries: Array<{ url: string; size: number; cachedAt: number }> = [];

    // 计算总大小并收集条目
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        const size = blob.size;
        const cachedAt = parseInt(response.headers.get('X-Cached-At') || '0', 10);
        totalSize += size;
        entries.push({ url: request.url, size, cachedAt });
      }
    }

    // 如果加上新视频会超过限制，删除最旧的
    if (totalSize + newSize > CACHE_MAX_SIZE) {
      // 按时间排序，删除最旧的
      entries.sort((a, b) => a.cachedAt - b.cachedAt);
      
      let freed = 0;
      for (const entry of entries) {
        if (totalSize + newSize - freed <= CACHE_MAX_SIZE) break;
        await cache.delete(entry.url);
        freed += entry.size;
        console.log(`[VideoCache] Evicted: ${entry.url.substring(0, 50)}...`);
      }
    }
  } catch (err) {
    console.error('[VideoCache] Failed to cleanup cache:', err);
  }
}

/**
 * 清除所有缓存
 */
export async function clearVideoCache(): Promise<void> {
  if (!('caches' in window)) return;

  try {
    await caches.delete(CACHE_NAME);
    console.log('[VideoCache] Cache cleared');
  } catch (err) {
    console.error('[VideoCache] Failed to clear cache:', err);
  }
}

/**
 * 获取缓存统计
 */
export async function getCacheStats(): Promise<{ count: number; size: number }> {
  const cache = await initCache();
  if (!cache) return { count: 0, size: 0 };

  try {
    const keys = await cache.keys();
    let totalSize = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }

    return {
      count: keys.length,
      size: totalSize,
    };
  } catch (err) {
    console.error('[VideoCache] Failed to get cache stats:', err);
    return { count: 0, size: 0 };
  }
}
