/**
 * LiveSkin FSM Library
 * 
 * 视频状态机库，用于实现 AI 主播"永远活着"的效果
 * 
 * 使用示例：
 * 
 * ```tsx
 * import { FSMController, useLiveSkin } from '@/lib/liveskin';
 * 
 * // 方式1：直接使用 Controller
 * const fsm = new FSMController(videoElement);
 * fsm.setManifest(manifest);
 * await fsm.start();
 * fsm.queueReaction('happy', 'gift');
 * 
 * // 方式2：使用 React Hook
 * const { videoRef, queueReaction, state } = useLiveSkin(agentId);
 * ```
 */

// 核心类
export { FSMController, type FSMCallbacks } from './FSMController';
export { EventQueue } from './EventQueue';
export { VideoPlayer, type VideoPlayerCallbacks } from './VideoPlayer';

// 类型
export * from '../../types/liveskin';

// React Hook
export { useLiveSkin } from './useLiveSkin';
