/**
 * 事件发射器 - 用于游戏中的事件通信
 * 支持事件订阅、发射和清理
 */

export class EventEmitter {
  // 事件监听器映射表：事件名 => 回调函数数组
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map()

  /**
   * 订阅事件
   * @param event 事件名
   * @param callback 回调函数
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  /**
   * 取消订阅事件
   * @param event 事件名
   * @param callback 回调函数
   */
  off(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) return
    const callbacks = this.listeners.get(event)!
    const index = callbacks.indexOf(callback)
    if (index !== -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * 发射事件
   * @param event 事件名
   * @param args 传递给回调的参数
   */
  emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return
    const callbacks = this.listeners.get(event)!
    callbacks.forEach((callback) => callback(...args))
  }

  /**
   * 清除所有事件监听器
   */
  clear(): void {
    this.listeners.clear()
  }
}

export default EventEmitter
