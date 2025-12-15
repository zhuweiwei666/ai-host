/**
 * LiveSkin FSM 类型定义
 * 
 * 用于 iOS 和 Web 客户端的状态机实现
 */

// ========== FSM 状态 ==========
export type FSMState = 
  | 'IDLE_LOOP'        // 待机循环播放
  | 'TRANSITION_OUT'   // 从 IDLE 过渡出
  | 'REACTION_ONCE'    // 播放一次反应
  | 'TRANSITION_IN'    // 回到 IDLE 过渡
  | 'SPEAKING';        // TTS 说话中

// ========== 资产类型 ==========
export type AssetType = 'idle' | 'reaction' | 'transition' | 'speak';

// ========== 情绪类型 ==========
export type EmotionId = 
  | 'happy' | 'excited' | 'flirty' | 'shy' | 'love' | 'proud'  // 正向情绪
  | 'sad' | 'angry' | 'surprised' | 'scared' | 'confused' | 'bored';  // 负向/中性情绪

// ========== 视频资产 ==========
export interface VideoAsset {
  id: string;
  url: string;
  loopSafeUrl?: string;          // ping-pong 版本 URL
  thumbnailUrl?: string;
  duration: number;              // 秒
  width?: number;
  height?: number;
  safeCutPoints: number[];       // 安全切点时间戳（秒）
  poseId: string;                // 起止姿态 ID
  emotionId?: string;            // 情绪 ID（reaction 专用）
  fromPose?: string;             // 过渡起始姿态（transition 专用）
  toPose?: string;               // 过渡目标姿态（transition 专用）
  loopSafe: boolean;             // 是否已处理为无缝循环
  tags?: string[];
  scaleLevel?: number;
  sortOrder?: number;
}

// ========== FSM 资产清单 ==========
export interface LiveSkinManifest {
  agentId: string;
  agentName: string;
  version: number;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  assets: {
    idle: VideoAsset[];
    reactions: Record<EmotionId | string, VideoAsset[]>;
    transitions: VideoAsset[];
    speak: VideoAsset[];
  };
  defaultIdleIndex: number;
  totalAssets: number;
  generatedAt: string;
}

// ========== 事件队列项 ==========
export interface QueuedEvent {
  id: string;                    // 唯一 ID
  emotionId: EmotionId | string; // 情绪 ID
  priority: number;              // 优先级 1-5，5 最高
  queuedAt: number;              // 入队时间戳（ms）
  expiresAt?: number;            // 过期时间戳（ms）
  source: string;                // 来源：gift/like/chat
  metadata?: Record<string, unknown>;
}

// ========== 安全切点 ==========
export interface SafeCutPoint {
  time: number;                  // 时间戳（秒）
  confidence: number;            // 置信度 0-1
}

// ========== FSM 事件 ==========
export type FSMEvent = 
  | { type: 'SAFE_CUT_REACHED' }
  | { type: 'VIDEO_ENDED' }
  | { type: 'TTS_START' }
  | { type: 'TTS_END' }
  | { type: 'QUEUE_EVENT'; event: QueuedEvent }
  | { type: 'FORCE_IDLE' };

// ========== FSM 状态机配置 ==========
export interface FSMConfig {
  /** 最大队列长度 */
  maxQueueSize: number;
  /** 事件过期时间（ms） */
  eventExpirationMs: number;
  /** 安全切点检测阈值（秒） */
  safeCutThreshold: number;
  /** 是否允许连续 reaction */
  allowConsecutiveReactions: boolean;
  /** TTS 播放时是否入队 */
  queueDuringSpeaking: boolean;
}

// ========== FSM 状态快照 ==========
export interface FSMSnapshot {
  state: FSMState;
  currentAsset: VideoAsset | null;
  currentTime: number;
  queueLength: number;
  isSpeaking: boolean;
  lastTransitionAt: number;
}

// ========== 事件上报数据 ==========
export interface ReactionEventData {
  emotionId: string;
  queuedAt?: string;
  playedAt?: string;
  latencyMs?: number;
  skipReason?: string;
  fsmState?: FSMState;
  videoAssetId?: string;
}

export interface FSMStateChangeData {
  fromState: FSMState;
  toState: FSMState;
  trigger: string;
}

// ========== 默认配置 ==========
export const DEFAULT_FSM_CONFIG: FSMConfig = {
  maxQueueSize: 10,
  eventExpirationMs: 30000,      // 30秒过期
  safeCutThreshold: 0.05,        // 50ms 阈值
  allowConsecutiveReactions: false,
  queueDuringSpeaking: true,
};

// ========== 情绪优先级映射 ==========
export const EMOTION_PRIORITY: Record<string, number> = {
  // 高优先级 - 强烈情绪
  excited: 5,
  angry: 5,
  surprised: 5,
  scared: 5,
  love: 5,
  
  // 中优先级 - 普通情绪
  happy: 4,
  flirty: 4,
  proud: 4,
  shy: 3,
  sad: 3,
  confused: 3,
  
  // 低优先级 - 弱情绪
  bored: 2,
};

// ========== 工具函数 ==========

/**
 * 生成唯一事件 ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建队列事件
 */
export function createQueuedEvent(
  emotionId: EmotionId | string,
  source: string,
  metadata?: Record<string, unknown>
): QueuedEvent {
  return {
    id: generateEventId(),
    emotionId,
    priority: EMOTION_PRIORITY[emotionId] || 3,
    queuedAt: Date.now(),
    expiresAt: Date.now() + DEFAULT_FSM_CONFIG.eventExpirationMs,
    source,
    metadata,
  };
}

/**
 * 检查事件是否过期
 */
export function isEventExpired(event: QueuedEvent): boolean {
  if (!event.expiresAt) return false;
  return Date.now() > event.expiresAt;
}

/**
 * 根据情绪 ID 获取资产
 */
export function getReactionAssets(
  manifest: LiveSkinManifest,
  emotionId: string
): VideoAsset[] {
  return manifest.assets.reactions[emotionId] || [];
}

/**
 * 随机选择一个资产
 */
export function pickRandomAsset(assets: VideoAsset[]): VideoAsset | null {
  if (assets.length === 0) return null;
  return assets[Math.floor(Math.random() * assets.length)];
}

/**
 * 找到最近的安全切点
 */
export function findNearestSafeCut(
  currentTime: number,
  safeCutPoints: number[],
  threshold: number = DEFAULT_FSM_CONFIG.safeCutThreshold
): number | null {
  for (const cut of safeCutPoints) {
    if (Math.abs(cut - currentTime) <= threshold) {
      return cut;
    }
  }
  return null;
}

/**
 * 检查当前是否在安全切点
 */
export function isAtSafeCut(
  currentTime: number,
  safeCutPoints: number[],
  threshold: number = DEFAULT_FSM_CONFIG.safeCutThreshold
): boolean {
  return findNearestSafeCut(currentTime, safeCutPoints, threshold) !== null;
}
