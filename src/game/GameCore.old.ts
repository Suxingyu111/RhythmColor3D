/**
 * 游戏核心逻辑
 * 协调所有游戏系统，处理游戏流程
 */

import { GameState, Difficulty, LevelConfig, ColorBlock } from '@game/types'
import ScoreManager from '@game/ScoreManager'
import AudioManager from '@audio/AudioManager'
import Renderer3D from '@3d/Renderer3D'
import { detectHit } from '@game/RhythmDetector'
import EventEmitter from '@utils/EventEmitter'

export class GameCore extends EventEmitter {
  // 游戏状态
  private state: GameState = GameState.IDLE

  // 当前难度
  private difficulty: Difficulty = Difficulty.NORMAL

  // 当前关卡
  private currentLevel: LevelConfig | null = null

  // 游戏系统
  private scoreManager: ScoreManager
  private audioManager: AudioManager
  private renderer: Renderer3D | null = null

  // 游戏进度
  private startTime: number = 0
  private currentBlocks: ColorBlock[] = []
  private processedBlocks: Set<string> = new Set()

  // 游戏计时器
  private gameLoopId: number | null = null

  constructor() {
    super()
    this.scoreManager = new ScoreManager()
    this.audioManager = new AudioManager()
    console.log('GameCore: Initialized')
  }

  /**
   * 初始化3D渲染
   * @param canvas HTML Canvas元素
   */
  initRenderer(canvas: HTMLCanvasElement): void {
    this.renderer = new Renderer3D(canvas)
    this.renderer.startRendering()
    console.log('GameCore: Renderer initialized')
  }

  /**
   * 加载关卡
   * @param level 关卡配置
   */
  loadLevel(level: LevelConfig): void {
    this.currentLevel = level
    this.currentBlocks = [...level.blocks] // 复制关卡数据
    this.processedBlocks.clear()
    this.scoreManager.reset()

    console.log(`GameCore: Level loaded - ${level.name}`)
    this.emit('level-loaded', level)
  }

  /**
   * 开始游戏
   */
  async startGame(): Promise<void> {
    if (!this.currentLevel || !this.renderer) {
      console.error('GameCore: Level not loaded or renderer not initialized')
      return
    }

    try {
      // 加载音乐
      console.log(`GameCore: Loading music from ${this.currentLevel.musicFile}`)
      const audioBuffer = await this.audioManager.loadMusic(
        this.currentLevel.musicFile,
        this.currentLevel.musicTitle,
        this.currentLevel.artist,
        this.currentLevel.bpm,
        this.currentLevel.duration / 1000 // 转换为秒
      )

      // 创建色彩方块
      for (const block of this.currentBlocks) {
        this.renderer.createColorBlock(block.id, block.color, block.positionX, block.positionY)
      }

      // 更新游戏状态
      this.state = GameState.PLAYING
      this.startTime = Date.now()

      // 播放音乐
      this.audioManager.play(audioBuffer)

      // 启动游戏循环
      this.startGameLoop()

      console.log('GameCore: Game started')
      this.emit('game-started')
    } catch (error) {
      console.error('GameCore: Failed to start game', error)
      this.emit('error', error)
    }
  }

  /**
   * 启动游戏循环
   */
  private startGameLoop(): void {
    const update = () => {
      if (this.state !== GameState.PLAYING) return

      const currentTime = this.audioManager.getCurrentTime()
      const musicDuration = this.audioManager.getMusicMetadata().duration

      // 检查游戏是否结束
      if (currentTime >= musicDuration) {
        this.finishGame()
        return
      }

      // 检测空心块击打
      this.detectBlockHits(currentTime)

      // 发出游戏更新事件
      this.emit('game-update', {
        currentTime,
        duration: musicDuration,
        score: this.scoreManager.getScore(),
        combo: this.scoreManager.getCombo(),
        accuracy: this.scoreManager.getAccuracy(),
      })

      requestAnimationFrame(update)
    }

    update()
  }

  /**
   * 检测方块击打
   * @param currentTime 当前时间（毫秒）
   */
  private detectBlockHits(currentTime: number): void {
    for (const block of this.currentBlocks) {
      // 跳过已处理的方块或已点击的方块
      if (this.processedBlocks.has(block.id) || block.clicked) continue

      const result = detectHit(currentTime, block.targetTime, 150)
      if (result.hit) {
        // 记录为点击过的
        block.clicked = true
        block.hitTime = currentTime
        block.hitRating = result.rating

        // 记分
        const points = this.scoreManager.recordHit(result.rating)

        // 移除渲染中的方块
        if (this.renderer) {
          this.renderer.removeColorBlock(block.id)
          this.renderer.createParticleEffect(block.color, { x: 0, y: 0, z: 0 })
        }

        // 标记为已处理
        this.processedBlocks.add(block.id)

        console.log(`Block hit: ${block.id}, rating: ${result.rating}, points: ${points}`)
        this.emit('block-hit', { blockId: block.id, rating: result.rating, points })
      }
    }
  }

  /**
   * 处理用户点击
   * @param blockId 方块ID
   */
  handleBlockClick(blockId: string): void {
    const block = this.currentBlocks.find((b) => b.id === blockId)
    if (!block || this.state !== GameState.PLAYING) return

    const currentTime = this.audioManager.getCurrentTime()
    const { hit, rating } = detectHit(currentTime, block.targetTime, 150)

    if (hit) {
      block.clicked = true
      block.hitTime = currentTime
      block.hitRating = rating

      const points = this.scoreManager.recordHit(rating)

      if (this.renderer) {
        this.renderer.removeColorBlock(blockId)
        this.renderer.createParticleEffect(block.color, { x: 0, y: 0, z: 0 })
      }

      this.processedBlocks.add(blockId)
      this.emit('block-clicked', { blockId, rating, points })
    } else {
      this.emit('block-missed', { blockId })
    }
  }

  /**
   * 暂停游戏
   */
  pauseGame(): void {
    if (this.state !== GameState.PLAYING) return
    this.state = GameState.PAUSED
    this.audioManager.pause()
    this.emit('game-paused')
    console.log('GameCore: Game paused')
  }

  /**
   * 继续游戏
   */
  resumeGame(): void {
    if (this.state !== GameState.PAUSED) return
    this.state = GameState.PLAYING
    this.audioManager.resume()
    this.startGameLoop()
    this.emit('game-resumed')
    console.log('GameCore: Game resumed')
  }

  /**
   * 结束游戏
   */
  finishGame(): void {
    if (this.state === GameState.FINISHED) return

    this.state = GameState.FINISHED
    this.audioManager.stop()

    if (this.renderer) {
      this.renderer.stopRendering()
    }

    const result = this.scoreManager.generateResult(this.currentLevel?.id || '')
    this.emit('game-finished', result)

    console.log('GameCore: Game finished', result)
  }

  /**
   * 获取游戏状态
   */
  getState(): GameState {
    return this.state
  }

  /**
   * 获取当前分数
   */
  getScore(): number {
    return this.scoreManager.getScore()
  }

  /**
   * 获取当前连击
   */
  getCombo(): number {
    return this.scoreManager.getCombo()
  }

  /**
   * 销毁游戏
   */
  destroy(): void {
    this.pauseGame()
    this.audioManager.destroy()
    if (this.renderer) {
      this.renderer.dispose()
    }
    this.clear()
    console.log('GameCore: Destroyed')
  }
}

export default GameCore
