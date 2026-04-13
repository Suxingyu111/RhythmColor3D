/**
 * 事件发射器 - 用于游戏中的事件通信
 * 支持事件订阅、发射和清理
 */

type EventMap = { [K in string]?: unknown[] };

export class EventEmitter<Events extends EventMap = EventMap> {
  // 事件监听器映射表：事件名 => 回调函数数组
  private listeners: Map<
    keyof Events & string,
    Array<(...args: unknown[]) => void>
  > = new Map();

  /**
   * 订阅事件
   * @param event 事件名
   * @param callback 回调函数
   */
  on<K extends keyof Events & string>(
    event: K,
    callback: (...args: NonNullable<Events[K]>) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback as (...args: unknown[]) => void);
  }

  /**
   * 取消订阅事件
   * @param event 事件名
   * @param callback 回调函数
   */
  off<K extends keyof Events & string>(
    event: K,
    callback: (...args: NonNullable<Events[K]>) => void,
  ): void {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback as (...args: unknown[]) => void);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * 发射事件
   * @param event 事件名
   * @param args 传递给回调的参数
   */
  emit<K extends keyof Events & string>(
    event: K,
    ...args: NonNullable<Events[K]>
  ): void {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event)!;
    callbacks.forEach((callback) => callback(...args));
  }

  /**
   * 清除所有事件监听器
   */
  clear(): void {
    this.listeners.clear();
  }
}

export default EventEmitter;
