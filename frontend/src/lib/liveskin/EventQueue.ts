/**
 * LiveSkin 事件队列
 * 
 * 管理待处理的 reaction 事件
 */

import {
  QueuedEvent,
  EmotionId,
  FSMConfig,
  DEFAULT_FSM_CONFIG,
  createQueuedEvent,
  isEventExpired,
} from '../../types/liveskin';

export class EventQueue {
  private queue: QueuedEvent[] = [];
  private config: FSMConfig;

  constructor(config: Partial<FSMConfig> = {}) {
    this.config = { ...DEFAULT_FSM_CONFIG, ...config };
  }

  /**
   * 添加事件到队列
   */
  push(
    emotionId: EmotionId | string,
    source: string,
    metadata?: Record<string, unknown>
  ): QueuedEvent | null {
    // 清理过期事件
    this.cleanup();

    // 检查队列是否已满
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('[EventQueue] Queue is full, dropping event');
      return null;
    }

    // 检查是否可以合并（连续相同情绪）
    const lastEvent = this.queue[this.queue.length - 1];
    if (lastEvent && lastEvent.emotionId === emotionId && lastEvent.source === source) {
      // 合并：更新 metadata，提高优先级
      lastEvent.priority = Math.min(5, lastEvent.priority + 1);
      lastEvent.metadata = { ...lastEvent.metadata, ...metadata, mergeCount: ((lastEvent.metadata?.mergeCount as number) || 1) + 1 };
      return lastEvent;
    }

    const event = createQueuedEvent(emotionId, source, metadata);
    this.queue.push(event);
    
    // 按优先级排序（高优先级在前）
    this.queue.sort((a, b) => b.priority - a.priority);

    return event;
  }

  /**
   * 取出队首事件
   */
  dequeue(): QueuedEvent | null {
    this.cleanup();
    return this.queue.shift() || null;
  }

  /**
   * 查看队首事件（不移除）
   */
  peek(): QueuedEvent | null {
    this.cleanup();
    return this.queue[0] || null;
  }

  /**
   * 是否有事件
   */
  hasEvents(): boolean {
    this.cleanup();
    return this.queue.length > 0;
  }

  /**
   * 队列长度
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * 清理过期事件
   */
  private cleanup(): void {
    const before = this.queue.length;
    this.queue = this.queue.filter(event => !isEventExpired(event));
    const removed = before - this.queue.length;
    if (removed > 0) {
      console.log(`[EventQueue] Cleaned up ${removed} expired events`);
    }
  }

  /**
   * 获取队列快照
   */
  getSnapshot(): QueuedEvent[] {
    return [...this.queue];
  }
}

export default EventQueue;
