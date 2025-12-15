/**
 * LiveSkin React Hook
 * 
 * 简化 FSM 在 React 组件中的使用
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { FSMController, FSMCallbacks } from './FSMController';
import { 
  FSMState, 
  LiveSkinManifest, 
  QueuedEvent, 
  VideoAsset,
  EmotionId,
  FSMConfig,
} from '../../types/liveskin';
import { getLiveSkinManifest, reportLiveSkinEvent } from '../../api';

export interface UseLiveSkinOptions {
  /** 是否自动开始 */
  autoStart?: boolean;
  /** FSM 配置 */
  config?: Partial<FSMConfig>;
  /** 是否上报事件到后端 */
  reportEvents?: boolean;
  /** 状态变化回调 */
  onStateChange?: (from: FSMState, to: FSMState) => void;
  /** 反应播放回调 */
  onReactionPlayed?: (event: QueuedEvent, asset: VideoAsset, latencyMs: number) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

export interface UseLiveSkinReturn {
  /** Video 元素 ref */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** 当前 FSM 状态 */
  state: FSMState;
  /** Manifest 是否已加载 */
  isReady: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 队列长度 */
  queueLength: number;
  /** 添加反应到队列 */
  queueReaction: (emotionId: EmotionId | string, source: string, metadata?: Record<string, unknown>) => void;
  /** TTS 开始通知 */
  onTTSStart: () => void;
  /** TTS 结束通知 */
  onTTSEnd: () => void;
  /** 手动开始 */
  start: () => Promise<void>;
  /** 停止 */
  stop: () => void;
}

export function useLiveSkin(
  agentId: string | null,
  options: UseLiveSkinOptions = {}
): UseLiveSkinReturn {
  const {
    autoStart = true,
    config = {},
    reportEvents = true,
    onStateChange,
    onReactionPlayed,
    onError,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const fsmRef = useRef<FSMController | null>(null);
  const manifestRef = useRef<LiveSkinManifest | null>(null);

  const [state, setState] = useState<FSMState>('IDLE_LOOP');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [queueLength, setQueueLength] = useState(0);

  // 初始化 FSM
  useEffect(() => {
    if (!agentId) return;

    let mounted = true;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 加载 manifest
        const response = await getLiveSkinManifest(agentId);
        const manifest = response.data;

        if (!mounted) return;

        manifestRef.current = manifest;

        // 创建 FSM
        const fsm = new FSMController(undefined, config);
        fsm.setManifest(manifest);

        // 设置回调
        const callbacks: FSMCallbacks = {
          onStateChange: (from, to, trigger) => {
            setState(to);
            onStateChange?.(from, to);

            if (reportEvents) {
              reportLiveSkinEvent({
                agentId,
                eventType: 'fsm_state_change',
                data: { fromState: from, toState: to, trigger },
              }).catch(console.error);
            }
          },
          onReactionQueued: (event) => {
            setQueueLength(fsm.getSnapshot().queueLength);

            if (reportEvents) {
              reportLiveSkinEvent({
                agentId,
                eventType: 'reaction_queued',
                data: { emotionId: event.emotionId },
              }).catch(console.error);
            }
          },
          onReactionPlayed: (event, asset, latencyMs) => {
            setQueueLength(fsm.getSnapshot().queueLength);
            onReactionPlayed?.(event, asset, latencyMs);

            if (reportEvents) {
              reportLiveSkinEvent({
                agentId,
                eventType: 'reaction_played',
                data: { 
                  emotionId: event.emotionId, 
                  latencyMs,
                  videoAssetId: asset.id,
                },
              }).catch(console.error);
            }
          },
          onReactionSkipped: (event, reason) => {
            setQueueLength(fsm.getSnapshot().queueLength);

            if (reportEvents) {
              reportLiveSkinEvent({
                agentId,
                eventType: 'reaction_skipped',
                data: { emotionId: event.emotionId, skipReason: reason },
              }).catch(console.error);
            }
          },
          onError: (err) => {
            setError(err);
            onError?.(err);
          },
        };
        fsm.setCallbacks(callbacks);

        fsmRef.current = fsm;
        setIsReady(true);
        setIsLoading(false);

        console.log('[useLiveSkin] FSM initialized for agent:', agentId);
      } catch (err) {
        console.error('[useLiveSkin] Init failed:', err);
        if (mounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      fsmRef.current?.stop();
      fsmRef.current = null;
    };
  }, [agentId]);

  // 绑定 video 元素并自动开始
  useEffect(() => {
    if (!isReady || !videoRef.current || !fsmRef.current) return;

    fsmRef.current.attachVideo(videoRef.current);

    if (autoStart) {
      fsmRef.current.start().catch((err) => {
        console.error('[useLiveSkin] Start failed:', err);
        setError(err);
      });
    }
  }, [isReady, autoStart]);

  // 方法
  const queueReaction = useCallback((
    emotionId: EmotionId | string,
    source: string,
    metadata?: Record<string, unknown>
  ) => {
    fsmRef.current?.queueReaction(emotionId, source, metadata);
  }, []);

  const onTTSStart = useCallback(() => {
    fsmRef.current?.onTTSStart();
  }, []);

  const onTTSEnd = useCallback(() => {
    fsmRef.current?.onTTSEnd();
  }, []);

  const start = useCallback(async () => {
    if (!fsmRef.current) {
      throw new Error('FSM not initialized');
    }
    await fsmRef.current.start();
  }, []);

  const stop = useCallback(() => {
    fsmRef.current?.stop();
  }, []);

  return {
    videoRef,
    state,
    isReady,
    isLoading,
    error,
    queueLength,
    queueReaction,
    onTTSStart,
    onTTSEnd,
    start,
    stop,
  };
}

export default useLiveSkin;
