/**
 * 游戏应用 - 主程序入口
 * 协调所有系统，管理游戏流程
 */

import GameCore from '@game/GameCore'
import UIManager from '@ui/UIManager'
import LevelManager from '@managers/LevelManager'
import { GameState } from '@game/types'

export class GameApp {
  private gameCore: GameCore
  private uiManager: UIManager
  private levelManager: LevelManager

  constructor() {
    this.gameCore = new GameCore()
    this.uiManager = new UIManager('app')
    this.levelManager = new LevelManager()

    this.setupEventListeners()
    this.init()
  }

  /**
   * 初始化应用
   */
  private init(): void {
    // 创建主菜单
    this.uiManager.createMainMenu()

    // 注册菜单按钮事件
    this.uiManager.onButtonClick('btn-start', () => this.startGame())
    this.uiManager.onButtonClick('btn-levels', () => this.showLevelSelect())
    this.uiManager.onButtonClick('btn-settings', () => this.showSettings())

    console.log('GameApp: Initialized')
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 游戏事件
    this.gameCore.on('game-started', () => {
      console.log('GameApp: Game started event received')
    })

    this.gameCore.on('game-update', (data: any) => {
      this.uiManager.updateScore(data.score)
      this.uiManager.updateCombo(data.combo)
      this.uiManager.updateAccuracy(data.accuracy)
      this.uiManager.updateProgress(data.currentTime, data.duration)
    })

    this.gameCore.on('block-clicked', (data: any) => {
      console.log(`Block clicked: ${data.blockId}, rating: ${data.rating}, points: ${data.points}`)
    })

    this.gameCore.on('game-finished', (result: any) => {
      this.showResultScreen(result)
    })

    this.gameCore.on('error', (error: any) => {
      console.error('GameApp: Game error', error)
      alert('游戏出错：' + error.message)
    })
  }

  /**
   * 开始游戏
   */
  private async startGame(): Promise<void> {
    // 获取第一个关卡
    const level = this.levelManager.getCurrentLevel()
    if (!level) {
      alert('没有可用的关卡')
      return
    }

    // 清空菜单
    this.uiManager.clear()

    // 创建游戏UI
    this.uiManager.createGameUI()

    // 初始化3D渲染
    const canvasContainer = this.uiManager.getCanvasContainer()
    if (!canvasContainer) {
      alert('无法创建Canvas容器')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvasContainer.appendChild(canvas)

    // 初始化游戏
    this.gameCore.initRenderer(canvas)
    this.gameCore.loadLevel(level)
    await this.gameCore.startGame()

    // 注册暂停按钮
    this.uiManager.onButtonClick('btn-pause', () => {
      if (this.gameCore.getState() === GameState.PLAYING) {
        this.gameCore.pauseGame()
        // 这里可以显示暂停菜单
      }
    })
  }

  /**
   * 显示关卡选择界面
   */
  private showLevelSelect(): void {
    const levels = this.levelManager.getAllLevels()
    const html = `
      <div id="level-select" class="menu-container">
        <h2>选择关卡</h2>
        <div class="levels-grid">
          ${levels
            .map(
              (level, index) => `
              <div class="level-card" data-index="${index}">
                <h3>${level.name}</h3>
                <p>${level.musicTitle}</p>
                <span class="difficulty ${level.difficulty}">${level.difficulty}</span>
              </div>
            `
            )
            .join('')}
        </div>
        <button class="btn btn-secondary" id="btn-back">返回</button>
      </div>
    `

    const container = document.getElementById('app')
    if (container) {
      container.innerHTML = html

      // 关卡选择事件
      document.querySelectorAll('.level-card').forEach((card) => {
        card.addEventListener('click', () => {
          const index = parseInt((card as HTMLElement).dataset.index || '0')
          this.levelManager.setCurrentLevel(index)
          this.startGame()
        })
      })

      document.getElementById('btn-back')?.addEventListener('click', () => {
        this.init()
      })
    }
  }

  /**
   * 显示设置界面
   */
  private showSettings(): void {
    const html = `
      <div id="settings" class="menu-container">
        <h2>设置</h2>
        <div class="settings-group">
          <label>主音量: <input type="range" id="volume" min="0" max="100" value="80"></label>
          <label>画质: 
            <select id="quality">
              <option value="low">低</option>
              <option value="medium" selected>中</option>
              <option value="high">高</option>
            </select>
          </label>
        </div>
        <button class="btn btn-secondary" id="btn-back">返回</button>
      </div>
    `

    const container = document.getElementById('app')
    if (container) {
      container.innerHTML = html
      document.getElementById('btn-back')?.addEventListener('click', () => {
        this.init()
      })
    }
  }

  /**
   * 显示结果界面
   * @param result 游戏结果
   */
  private showResultScreen(result: any): void {
    this.uiManager.clear()
    this.uiManager.createResultScreen()

    // 填充结果数据
    const finalScore = document.getElementById('final-score')
    const maxCombo = document.getElementById('max-combo')
    const finalAccuracy = document.getElementById('final-accuracy')

    if (finalScore) finalScore.textContent = result.score.toString()
    if (maxCombo) maxCombo.textContent = result.maxCombo.toString()
    if (finalAccuracy) finalAccuracy.textContent = `${result.accuracy}%`

    // 填充详细数据
    document.getElementById('detail-perfect')!.textContent = result.hitCounts.perfect
    document.getElementById('detail-great')!.textContent = result.hitCounts.great
    document.getElementById('detail-good')!.textContent = result.hitCounts.good
    document.getElementById('detail-miss')!.textContent = result.hitCounts.miss

    // 注册结果界面按钮
    this.uiManager.onButtonClick('btn-retry', () => {
      this.startGame()
    })

    this.uiManager.onButtonClick('btn-menu', () => {
      this.uiManager.clear()
      this.init()
    })
  }

  /**
   * 销毁应用
   */
  destroy(): void {
    this.gameCore.destroy()
    this.uiManager.clear()
  }
}

/**
 * 应用入口
 */
let app: GameApp

document.addEventListener('DOMContentLoaded', () => {
  app = new GameApp()
  console.log('GameApp: Application started')
})

// 页面卸载时销毁应用
window.addEventListener('beforeunload', () => {
  if (app) {
    app.destroy()
  }
})

export default GameApp
