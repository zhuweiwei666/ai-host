/**
 * React Hook: 使用缓存的视频 URL
 */

import { useState, useEffect } from 'react';
import { getVideoWithCache } from '../utils/videoCache';

/**
 * 获取缓存的视频 URL（如果是 IDLE 视频则使用缓存）
 */
export function useCachedVideo(
  url: string | null | undefined,
  isIdleVideo: boolean = false
): string | null {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setCachedUrl(null);
      return;
    }

    // 如果不是 IDLE 视频，直接使用原 URL
    if (!isIdleVideo) {
      setCachedUrl(url);
      return;
    }

    // IDLE 视频使用缓存
    let blobUrl: string | null = null;
    getVideoWithCache(url)
      .then((videoUrl) => {
        blobUrl = videoUrl;
        setCachedUrl(videoUrl);
      })
      .catch((err) => {
        console.error('[useCachedVideo] Failed to get cached video:', err);
        // 失败时回退到原 URL
        setCachedUrl(url);
      });

    // 清理函数
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url, isIdleVideo]);

  return cachedUrl;
}
