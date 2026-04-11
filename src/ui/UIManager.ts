/**
 * UI管理系统
 * 管理游戏的用户界面和显示
 */

export class UIManager {
  private container: HTMLElement | null = null
  private elements: Map<string, HTMLElement> = new Map()

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)
    if (!this.container) {
      console.warn(`UIManager: Container with id "${containerId}" not found`)
    }
  }

  /**
   * 创建主菜单
   */
  createMainMenu(): HTMLElement {
    const menu = document.createElement('div')
    menu.id = 'main-menu'
    menu.className = 'menu-container'
    menu.innerHTML = `
      <div class="menu-content">
        <h1 class="game-title">🎨 炫彩节奏3D</h1>
        <p class="game-subtitle">色彩与节奏的碰撞</p>
        
        <div class="menu-buttons">
          <button class="btn btn-primary" id="btn-start">开始游戏</button>
          <button class="btn btn-secondary" id="btn-levels">选择关卡</button>
          <button class="btn btn-tertiary" id="btn-settings">设置</button>
        </div>
        
        <div class="menu-info">
          <p>使用鼠标或触屏点击色彩方块</p>
          <p>根据音乐节奏击打方块获得高分</p>
        </div>
      </div>
    `

    if (this.container) {
      this.container.appendChild(menu)
    }
    this.elements.set('main-menu', menu)
    return menu
  }

  // 连击动画定时器
  private comboTimer: number | null = null
  // 加速指示器定时器
  private boostTimer: number | null = null

  /**
   * 创建游戏界面 — 升级版 HUD
   */
  createGameUI(): HTMLElement {
    const ui = document.createElement('div')
    ui.id = 'game-ui'
    ui.className = 'game-ui'
    ui.innerHTML = `
      <div class="game-header">
        <div class="hud-score">
          <span class="hud-label">SCORE</span>
          <span class="hud-value" id="score">0</span>
        </div>
        <div class="hud-stats">
          <div class="hud-stat">
            <span class="hud-label">HIT</span>
            <span class="hud-value" id="blocks-hit">0</span>
          </div>
          <div class="hud-stat">
            <span class="hud-label">TIME</span>
            <span class="hud-value" id="game-time">0.0</span>
          </div>
        </div>
      </div>

      <!-- 距离进度条 -->
      <div class="distance-bar">
        <div class="distance-fill" id="distance-fill"></div>
        <span class="distance-text" id="distance-text">0m / 500m</span>
      </div>

      <!-- 连击显示区域 -->
      <div id="combo-display" class="combo-display"></div>

      <!-- 加速指示器 -->
      <div id="boost-indicator" class="boost-indicator" style="display: none;">
        <span class="boost-icon">⚡</span>
        <span class="boost-label">BOOST</span>
        <span class="boost-timer" id="boost-timer">10s</span>
      </div>

      <div id="canvas-container" class="canvas-container"></div>

      <div class="game-hints">
        <p>← → 切换车道 | 空格 回中 | ESC 暂停</p>
      </div>
    `

    if (this.container) {
      this.container.appendChild(ui)
    }
    this.elements.set('game-ui', ui)
    return ui
  }

  /**
   * 显示连击效果 — 增强版
   * 多层视觉：数字 + 光环 + 火焰条 + 里程碑 + 屏幕震动
   * @param combo 当前连击数
   */
  showComboEffect(combo: number): void {
    const display = document.getElementById('combo-display')
    if (!display) return

    // 清除旧的淡出定时器
    if (this.comboTimer !== null) {
      clearTimeout(this.comboTimer)
      this.comboTimer = null
    }

    // 确定连击等级（4 档）
    let tier = 1
    if (combo >= 20) tier = 4
    else if (combo >= 10) tier = 3
    else if (combo >= 5) tier = 2

    const tierClass = `combo-tier-${tier}`

    // 里程碑鼓励语（带中文）
    let milestone = ''
    if (combo === 50) milestone = 'LEGENDARY! 传说!'
    else if (combo === 30) milestone = 'UNSTOPPABLE! 势不可挡!'
    else if (combo === 20) milestone = 'AMAZING! 太强了!'
    else if (combo === 10) milestone = 'GREAT! 厉害!'
    else if (combo === 5) milestone = 'NICE! 不错!'

    // 火焰条数量（tier 2+ 显示）
    const streakBars = tier >= 2 ? tier : 0

    // 构建连击 HTML
    let html = `<div class="combo-container ${tier >= 3 ? 'combo-shake' : ''}">`

    // 光环背景（tier 3+）
    if (tier >= 3) {
      html += `<div class="combo-glow ${tierClass}"></div>`
    }

    // 连击数字
    html += `<span class="combo-number ${tierClass}">${combo}x</span>`
    html += `<span class="combo-label ${tierClass}">COMBO</span>`

    // 火焰条指示器
    if (streakBars > 0) {
      html += `<div class="combo-streak">`
      for (let i = 0; i < streakBars; i++) {
        html += `<span class="streak-bar ${tierClass}" style="animation-delay: ${i * 0.1}s"></span>`
      }
      html += `</div>`
    }

    // 里程碑文字
    if (milestone) {
      html += `<span class="combo-milestone ${tierClass}">${milestone}</span>`
    }

    html += `</div>`

    display.innerHTML = html

    // 里程碑时触发屏幕闪光
    if (milestone) {
      this.flashScreen(tier)
    }

    // 1200ms 后开始淡出（延长显示时间）
    this.comboTimer = window.setTimeout(() => {
      const container = display.querySelector('.combo-container')
      if (container) {
        container.classList.add('fade-out')
      }
      // 淡出动画 400ms 后清空
      this.comboTimer = window.setTimeout(() => {
        display.innerHTML = ''
        this.comboTimer = null
      }, 400)
    }, 1200)
  }

  /**
   * 屏幕闪光效果（里程碑触发）
   */
  private flashScreen(tier: number): void {
    const flash = document.createElement('div')
    flash.className = `screen-flash flash-tier-${tier}`
    document.body.appendChild(flash)
    setTimeout(() => flash.remove(), 500)
  }

  /**
   * 隐藏连击显示（连击断裂时调用）
   */
  hideCombo(): void {
    if (this.comboTimer !== null) {
      clearTimeout(this.comboTimer)
      this.comboTimer = null
    }
    const display = document.getElementById('combo-display')
    if (display) display.innerHTML = ''
  }

  /**
   * 显示加速指示器
   * @param duration 加速持续时间（秒）
   */
  showBoostIndicator(duration: number): void {
    const indicator = document.getElementById('boost-indicator')
    const timerEl = document.getElementById('boost-timer')
    if (!indicator) return

    indicator.style.display = 'flex'
    let remaining = duration

    // 立即更新一次
    if (timerEl) timerEl.textContent = `${remaining}s`

    // 清除旧定时器
    if (this.boostTimer !== null) {
      clearInterval(this.boostTimer)
    }

    // 每秒更新倒计时
    this.boostTimer = window.setInterval(() => {
      remaining--
      if (timerEl) timerEl.textContent = `${Math.max(0, remaining)}s`
      if (remaining <= 0) {
        this.hideBoostIndicator()
      }
    }, 1000)
  }

  /**
   * 隐藏加速指示器
   */
  hideBoostIndicator(): void {
    if (this.boostTimer !== null) {
      clearInterval(this.boostTimer)
      this.boostTimer = null
    }
    const indicator = document.getElementById('boost-indicator')
    if (indicator) indicator.style.display = 'none'
  }

  /**
   * 创建结果界面
   */
  createResultScreen(): HTMLElement {
    const screen = document.createElement('div')
    screen.id = 'result-screen'
    screen.className = 'result-screen'
    screen.innerHTML = `
      <div class="result-content">
        <h2>游戏结束</h2>
        
        <div class="result-stats">
          <div class="stat">
            <span class="stat-label">最终分数</span>
            <span class="stat-value" id="final-score">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">最大连击</span>
            <span class="stat-value" id="max-combo">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">准确率</span>
            <span class="stat-value" id="final-accuracy">0%</span>
          </div>
        </div>
        
        <div class="result-details">
          <div class="detail">
            <span>完美</span>
            <span id="detail-perfect">0</span>
          </div>
          <div class="detail">
            <span>很好</span>
            <span id="detail-great">0</span>
          </div>
          <div class="detail">
            <span>良好</span>
            <span id="detail-good">0</span>
          </div>
          <div class="detail">
            <span>未击中</span>
            <span id="detail-miss">0</span>
          </div>
        </div>
        
        <div class="result-buttons">
          <button class="btn btn-primary" id="btn-retry">重试</button>
          <button class="btn btn-secondary" id="btn-menu">返回菜单</button>
        </div>
      </div>
    `

    if (this.container) {
      this.container.appendChild(screen)
    }
    this.elements.set('result-screen', screen)
    return screen
  }

  /**
   * 更新分数显示
   * @param score 分数值
   */
  updateScore(score: number): void {
    const element = document.getElementById('score')
    if (element) element.textContent = score.toString()
  }

  /**
   * 更新距离进度条
   * @param current 当前距离
   * @param target 目标距离
   */
  updateDistance(current: number, target: number): void {
    const fill = document.getElementById('distance-fill')
    const text = document.getElementById('distance-text')
    const percent = Math.min((current / target) * 100, 100)
    if (fill) fill.style.width = `${percent}%`
    if (text) text.textContent = `${Math.floor(current)}m / ${target}m`
  }

  /**
   * 更新连击显示
   * @param combo 连击值
   */
  updateCombo(combo: number): void {
    const element = document.getElementById('combo')
    if (element) element.textContent = combo.toString()
  }

  /**
   * 更新准确率显示
   * @param accuracy 准确率百分比
   */
  updateAccuracy(accuracy: number): void {
    const element = document.getElementById('accuracy')
    if (element) element.textContent = `${accuracy}%`
  }

  /**
   * 更新进度条
   * @param currentTime 当前时间
   * @param totalTime 总时间
   */
  updateProgress(currentTime: number, totalTime: number): void {
    const fill = document.getElementById('progress-fill')
    const current = document.getElementById('current-time')
    const total = document.getElementById('total-time')

    if (fill) {
      const percentage = (currentTime / totalTime) * 100
      fill.style.width = `${percentage}%`
    }

    if (current) current.textContent = this.formatTime(currentTime)
    if (total) total.textContent = this.formatTime(totalTime)
  }

  /**
   * 格式化时间为 MM:SS
   * @param ms 毫秒
   */
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * 显示元素
   * @param elementId 元素ID
   */
  show(elementId: string): void {
    const element = document.getElementById(elementId)
    if (element) {
      element.style.display = 'block'
    }
  }

  /**
   * 隐藏元素
   * @param elementId 元素ID
   */
  hide(elementId: string): void {
    const element = document.getElementById(elementId)
    if (element) {
      element.style.display = 'none'
    }
  }

  /**
   * 注册按钮点击事件
   * @param buttonId 按钮ID
   * @param callback 回调函数
   */
  onButtonClick(buttonId: string, callback: () => void): void {
    const button = document.getElementById(buttonId)
    if (button) {
      button.addEventListener('click', callback)
    }
  }

  /**
   * 更新方块数量显示
   * @param count 方块数量
   */
  updateBlocksHit(count: number): void {
    const element = document.getElementById('blocks-hit')
    if (element) element.textContent = count.toString()
  }

  /**
   * 更新时间显示
   * @param time 时间（秒）
   */
  updateTime(time: number): void {
    const element = document.getElementById('game-time')
    if (element) element.textContent = time.toFixed(1)
  }

  /**
   * 显示浮动文字
   * @param text 文字内容
   * @param color 颜色
   */
  showFloatingText(text: string, color?: string): void {
    const floatingText = document.createElement('div')
    floatingText.textContent = text
    floatingText.style.position = 'fixed'
    floatingText.style.left = '50%'
    floatingText.style.top = '50%'
    floatingText.style.transform = 'translate(-50%, -50%)'
    floatingText.style.fontSize = '2rem'
    floatingText.style.fontWeight = 'bold'
    floatingText.style.color = color ? `rgb(${color})` : '#00ff00'
    floatingText.style.pointerEvents = 'none'
    floatingText.style.animation = 'fadeOutUp 1s ease-out forwards'
    floatingText.style.zIndex = '1000'

    document.body.appendChild(floatingText)

    setTimeout(() => {
      floatingText.remove()
    }, 1000)
  }

  /**
   * 获取Canvas容器
   */
  getCanvasContainer(): HTMLElement | null {
    const container = document.getElementById('canvas-container')
    return container
  }

  /**
   * 清空UI
   */
  clear(): void {
    this.elements.forEach((element) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element)
      }
    })
    this.elements.clear()
  }
}

export default UIManager
