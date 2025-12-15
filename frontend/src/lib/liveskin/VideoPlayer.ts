/**
 * LiveSkin 视频播放器封装
 * 
 * 封装 HTML5 Video 元素，提供状态机所需的接口
 */

import { VideoAsset, isAtSafeCut } from '../../types/liveskin';

export interface VideoPlayerCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onSafeCutReached?: (cutPoint: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onPlaying?: () => void;
  onPaused?: () => void;
}

export class VideoPlayer {
  private videoElement: HTMLVideoElement | null = null;
  private currentAsset: VideoAsset | null = null;
  private callbacks: VideoPlayerCallbacks = {};
  private isLooping = false;
  private lastSafeCutNotified = -1;
  private safeCutCheckInterval: number | null = null;

  constructor(videoElement?: HTMLVideoElement) {
    if (videoElement) {
      this.attach(videoElement);
    }
  }

  /**
   * 绑定 video 元素
   */
  attach(videoElement: HTMLVideoElement): void {
    this.detach();
    this.videoElement = videoElement;
    this.setupEventListeners();
  }

  /**
   * 解绑 video 元素
   */
  detach(): void {
    if (this.videoElement) {
      this.removeEventListeners();
      this.videoElement = null;
    }
    if (this.safeCutCheckInterval) {
      window.clearInterval(this.safeCutCheckInterval);
      this.safeCutCheckInterval = null;
    }
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: VideoPlayerCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 播放资产
   */
  async play(asset: VideoAsset, loop = false): Promise<void> {
    if (!this.videoElement) {
      throw new Error('Video element not attached');
    }

    this.currentAsset = asset;
    this.isLooping = loop;
    this.lastSafeCutNotified = -1;

    // 优先使用 loopSafeUrl（如果存在且需要循环）
    const url = loop && asset.loopSafeUrl ? asset.loopSafeUrl : asset.url;
    
    this.videoElement.src = url;
    this.videoElement.loop = loop;
    
    try {
      await this.videoElement.play();
    } catch (err) {
      console.error('[VideoPlayer] Play failed:', err);
      this.callbacks.onError?.(err as Error);
    }

    // 启动安全切点检测
    this.startSafeCutCheck();
  }

  /**
   * 暂停
   */
  pause(): void {
    this.videoElement?.pause();
  }

  /**
   * 恢复播放
   */
  resume(): void {
    this.videoElement?.play();
  }

  /**
   * 获取当前时间
   */
  getCurrentTime(): number {
    return this.videoElement?.currentTime || 0;
  }

  /**
   * 获取总时长
   */
  getDuration(): number {
    return this.videoElement?.duration || 0;
  }

  /**
   * 获取当前资产
   */
  getCurrentAsset(): VideoAsset | null {
    return this.currentAsset;
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    if (!this.videoElement) return false;
    return !this.videoElement.paused && !this.videoElement.ended;
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 静音
   */
  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  // ========== 私有方法 ==========

  private setupEventListeners(): void {
    if (!this.videoElement) return;

    this.videoElement.addEventListener('timeupdate', this.handleTimeUpdate);
    this.videoElement.addEventListener('ended', this.handleEnded);
    this.videoElement.addEventListener('error', this.handleError);
    this.videoElement.addEventListener('playing', this.handlePlaying);
    this.videoElement.addEventListener('pause', this.handlePaused);
  }

  private removeEventListeners(): void {
    if (!this.videoElement) return;

    this.videoElement.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.videoElement.removeEventListener('ended', this.handleEnded);
    this.videoElement.removeEventListener('error', this.handleError);
    this.videoElement.removeEventListener('playing', this.handlePlaying);
    this.videoElement.removeEventListener('pause', this.handlePaused);
  }

  private handleTimeUpdate = (): void => {
    if (!this.videoElement) return;
    const currentTime = this.videoElement.currentTime;
    const duration = this.videoElement.duration;
    this.callbacks.onTimeUpdate?.(currentTime, duration);
  };

  private handleEnded = (): void => {
    if (this.safeCutCheckInterval) {
      window.clearInterval(this.safeCutCheckInterval);
      this.safeCutCheckInterval = null;
    }
    this.callbacks.onEnded?.();
  };

  private handleError = (): void => {
    const error = this.videoElement?.error;
    this.callbacks.onError?.(new Error(error?.message || 'Video error'));
  };

  private handlePlaying = (): void => {
    this.callbacks.onPlaying?.();
  };

  private handlePaused = (): void => {
    this.callbacks.onPaused?.();
  };

  private startSafeCutCheck(): void {
    if (this.safeCutCheckInterval) {
      window.clearInterval(this.safeCutCheckInterval);
    }

    // 每 16ms（约60fps）检查一次
    this.safeCutCheckInterval = window.setInterval(() => {
      this.checkSafeCut();
    }, 16);
  }

  private checkSafeCut(): void {
    if (!this.videoElement || !this.currentAsset) return;
    if (!this.isLooping) return; // 只在循环模式下检测

    const currentTime = this.videoElement.currentTime;
    const safeCutPoints = this.currentAsset.safeCutPoints || [];

    if (safeCutPoints.length === 0) return;

    // 检查是否到达安全切点
    if (isAtSafeCut(currentTime, safeCutPoints, 0.05)) {
      // 避免重复通知
      const nearestCut = safeCutPoints.find(cut => Math.abs(cut - currentTime) <= 0.05);
      if (nearestCut !== undefined && nearestCut !== this.lastSafeCutNotified) {
        this.lastSafeCutNotified = nearestCut;
        this.callbacks.onSafeCutReached?.(nearestCut);
      }
    }
  }
}

export default VideoPlayer;
