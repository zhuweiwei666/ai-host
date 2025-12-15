/**
 * LiveSkin FSM 状态机控制器
 * 
 * 管理视频播放状态和事件响应
 */

import {
  FSMState,
  FSMEvent,
  FSMConfig,
  FSMSnapshot,
  LiveSkinManifest,
  VideoAsset,
  QueuedEvent,
  EmotionId,
  DEFAULT_FSM_CONFIG,
  getReactionAssets,
  pickRandomAsset,
} from '../../types/liveskin';
import { EventQueue } from './EventQueue';
import { VideoPlayer, VideoPlayerCallbacks } from './VideoPlayer';

export interface FSMCallbacks {
  onStateChange?: (from: FSMState, to: FSMState, trigger: string) => void;
  onReactionQueued?: (event: QueuedEvent) => void;
  onReactionPlayed?: (event: QueuedEvent, asset: VideoAsset, latencyMs: number) => void;
  onReactionSkipped?: (event: QueuedEvent, reason: string) => void;
  onError?: (error: Error) => void;
}

export class FSMController {
  private state: FSMState = 'IDLE_LOOP';
  private manifest: LiveSkinManifest | null = null;
  private queue: EventQueue;
  private player: VideoPlayer;
  private config: FSMConfig;
  private callbacks: FSMCallbacks = {};
  
  private currentReaction: QueuedEvent | null = null;
  private isSpeaking = false;
  private lastTransitionAt = 0;

  constructor(
    videoElement?: HTMLVideoElement,
    config: Partial<FSMConfig> = {}
  ) {
    this.config = { ...DEFAULT_FSM_CONFIG, ...config };
    this.queue = new EventQueue(config);
    this.player = new VideoPlayer(videoElement);
    
    this.setupPlayerCallbacks();
  }

  // ========== 公共方法 ==========

  /**
   * 加载资产清单
   */
  setManifest(manifest: LiveSkinManifest): void {
    this.manifest = manifest;
    console.log('[FSM] Manifest loaded:', manifest.agentName, 'with', manifest.totalAssets, 'assets');
  }

  /**
   * 绑定 video 元素
   */
  attachVideo(videoElement: HTMLVideoElement): void {
    this.player.attach(videoElement);
    this.setupPlayerCallbacks();
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: FSMCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 启动状态机（开始播放 IDLE）
   */
  async start(): Promise<void> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded');
    }

    this.transitionTo('IDLE_LOOP', 'START');
    await this.playIdle();
  }

  /**
   * 停止状态机
   */
  stop(): void {
    this.player.pause();
    this.queue.clear();
  }

  /**
   * 添加反应事件到队列
   */
  queueReaction(
    emotionId: EmotionId | string,
    source: string,
    metadata?: Record<string, unknown>
  ): QueuedEvent | null {
    const event = this.queue.push(emotionId, source, metadata);
    
    if (event) {
      console.log('[FSM] Reaction queued:', emotionId, 'from', source);
      this.callbacks.onReactionQueued?.(event);
    }

    return event;
  }

  /**
   * TTS 开始
   */
  onTTSStart(): void {
    this.isSpeaking = true;
    
    if (this.state === 'IDLE_LOOP') {
      this.transitionTo('SPEAKING', 'TTS_START');
      this.playSpeakAsset();
    }
  }

  /**
   * TTS 结束
   */
  onTTSEnd(): void {
    this.isSpeaking = false;

    if (this.state === 'SPEAKING') {
      // TTS 结束后检查队列
      if (this.queue.hasEvents()) {
        this.transitionTo('TRANSITION_OUT', 'TTS_END_WITH_QUEUE');
        this.playTransitionOut();
      } else {
        this.transitionTo('IDLE_LOOP', 'TTS_END');
        this.playIdle();
      }
    }
  }

  /**
   * 获取状态快照
   */
  getSnapshot(): FSMSnapshot {
    return {
      state: this.state,
      currentAsset: this.player.getCurrentAsset(),
      currentTime: this.player.getCurrentTime(),
      queueLength: this.queue.length,
      isSpeaking: this.isSpeaking,
      lastTransitionAt: this.lastTransitionAt,
    };
  }

  /**
   * 获取当前状态
   */
  getState(): FSMState {
    return this.state;
  }

  // ========== 私有方法 ==========

  private setupPlayerCallbacks(): void {
    const callbacks: VideoPlayerCallbacks = {
      onSafeCutReached: (cutPoint) => this.handleSafeCutReached(cutPoint),
      onEnded: () => this.handleVideoEnded(),
      onError: (error) => this.handleError(error),
    };
    this.player.setCallbacks(callbacks);
  }

  private transitionTo(newState: FSMState, trigger: string): void {
    const from = this.state;
    this.state = newState;
    this.lastTransitionAt = Date.now();
    
    console.log(`[FSM] ${from} -> ${newState} (${trigger})`);
    this.callbacks.onStateChange?.(from, newState, trigger);
  }

  private handleSafeCutReached(cutPoint: number): void {
    // 只在 IDLE_LOOP 状态下响应安全切点
    if (this.state !== 'IDLE_LOOP') return;
    if (this.isSpeaking) return;
    if (!this.queue.hasEvents()) return;

    console.log('[FSM] Safe cut reached at', cutPoint, 'with', this.queue.length, 'events in queue');
    
    // 开始过渡
    this.transitionTo('TRANSITION_OUT', 'SAFE_CUT_WITH_QUEUE');
    this.playTransitionOut();
  }

  private handleVideoEnded(): void {
    switch (this.state) {
      case 'TRANSITION_OUT':
        // 过渡完成，播放反应
        this.playReaction();
        break;

      case 'REACTION_ONCE':
        // 反应完成，过渡回 IDLE
        this.transitionTo('TRANSITION_IN', 'REACTION_END');
        this.playTransitionIn();
        break;

      case 'TRANSITION_IN':
        // 过渡完成，回到 IDLE
        if (this.isSpeaking) {
          this.transitionTo('SPEAKING', 'TRANSITION_IN_END_SPEAKING');
          this.playSpeakAsset();
        } else {
          this.transitionTo('IDLE_LOOP', 'TRANSITION_IN_END');
          this.playIdle();
        }
        break;

      case 'SPEAKING':
        // 说话视频结束，检查是否还在说话
        if (this.isSpeaking) {
          this.playSpeakAsset();
        } else {
          this.transitionTo('IDLE_LOOP', 'SPEAK_END');
          this.playIdle();
        }
        break;

      case 'IDLE_LOOP':
        // IDLE 应该循环，不应该 ended
        // 但如果 loopSafe 不存在可能会触发
        this.playIdle();
        break;
    }
  }

  private handleError(error: Error): void {
    console.error('[FSM] Video error:', error);
    this.callbacks.onError?.(error);
    
    // 尝试恢复到 IDLE
    this.transitionTo('IDLE_LOOP', 'ERROR_RECOVERY');
    this.playIdle();
  }

  private async playIdle(): Promise<void> {
    if (!this.manifest) return;

    const idleAssets = this.manifest.assets.idle;
    if (idleAssets.length === 0) {
      console.warn('[FSM] No idle assets available');
      return;
    }

    const asset = idleAssets[this.manifest.defaultIdleIndex] || idleAssets[0];
    await this.player.play(asset, true); // loop = true
  }

  private async playTransitionOut(): Promise<void> {
    if (!this.manifest) return;

    const transitions = this.manifest.assets.transitions;
    if (transitions.length === 0) {
      // 没有过渡视频，直接播放反应
      this.playReaction();
      return;
    }

    const asset = pickRandomAsset(transitions);
    if (asset) {
      await this.player.play(asset, false);
    } else {
      this.playReaction();
    }
  }

  private async playTransitionIn(): Promise<void> {
    if (!this.manifest) return;

    const transitions = this.manifest.assets.transitions;
    if (transitions.length === 0) {
      // 没有过渡视频，直接回 IDLE
      this.transitionTo('IDLE_LOOP', 'NO_TRANSITION');
      this.playIdle();
      return;
    }

    const asset = pickRandomAsset(transitions);
    if (asset) {
      await this.player.play(asset, false);
    } else {
      this.transitionTo('IDLE_LOOP', 'NO_TRANSITION');
      this.playIdle();
    }
  }

  private async playReaction(): Promise<void> {
    if (!this.manifest) return;

    const event = this.queue.dequeue();
    if (!event) {
      // 没有事件，回到 IDLE
      this.transitionTo('IDLE_LOOP', 'NO_EVENT');
      this.playIdle();
      return;
    }

    this.currentReaction = event;
    const latencyMs = Date.now() - event.queuedAt;

    // 获取对应情绪的反应视频
    const reactionAssets = getReactionAssets(this.manifest, event.emotionId);
    
    if (reactionAssets.length === 0) {
      console.warn('[FSM] No reaction assets for emotion:', event.emotionId);
      this.callbacks.onReactionSkipped?.(event, 'no_assets');
      
      // 跳过，回到 IDLE
      this.transitionTo('IDLE_LOOP', 'NO_REACTION_ASSET');
      this.playIdle();
      return;
    }

    const asset = pickRandomAsset(reactionAssets);
    if (!asset) {
      this.transitionTo('IDLE_LOOP', 'NO_REACTION_ASSET');
      this.playIdle();
      return;
    }

    this.transitionTo('REACTION_ONCE', 'PLAY_REACTION');
    await this.player.play(asset, false);

    console.log('[FSM] Playing reaction:', event.emotionId, 'latency:', latencyMs, 'ms');
    this.callbacks.onReactionPlayed?.(event, asset, latencyMs);
  }

  private async playSpeakAsset(): Promise<void> {
    if (!this.manifest) return;

    const speakAssets = this.manifest.assets.speak;
    if (speakAssets.length === 0) {
      // 没有说话视频，使用 IDLE
      this.playIdle();
      return;
    }

    const asset = pickRandomAsset(speakAssets);
    if (asset) {
      await this.player.play(asset, true); // loop during speaking
    } else {
      this.playIdle();
    }
  }
}

export default FSMController;
