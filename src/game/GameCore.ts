/**
 * 游戏核心逻辑 - 球形跳跃游戏版本
 * 协调所有游戏系统，处理落地事件和颜色同步
 */

import { GameState, LevelConfig, SceneTheme, DifficultyConfig } from '@game/types'
import BallPhysics from '@game/BallPhysics'
import Renderer3D from '@3d/Renderer3D'
import TrackManager from '@managers/TrackManager'
import AudioManager from '@audio/AudioManager'
import { getMusicConfig, MusicConfig } from '@audio/MusicConfig'
import EventEmitter from '@utils/EventEmitter'

export class GameCore extends EventEmitter {
  // 游戏状态
  private state: GameState = GameState.IDLE

  // 游戏系统
  private ballPhysics: BallPhysics
  private renderer: Renderer3D | null = null
  private trackManager: TrackManager
  private audioManager: AudioManager

  // 游戏进度
  private currentLevel: LevelConfig | null = null
  private score: number = 0
  private blocksHit: number = 0
  private blocksMissed: number = 0
  private hitBlocks: Set<string> = new Set()
  private targetDistance: number = 500

  // 难度配置（从 TrackManager 获取）
  private difficultyConfig: DifficultyConfig | null = null

  // 音乐配置
  private musicConfig: MusicConfig | null = null

  // 游戏计时器
  private gameLoopId: number | null = null
  private startTime: number = 0
  private deltaTime: number = 0
  private lastFrameTime: number = 0

  // 帧计数器（用于降频非关键操作）
  private frameCount: number = 0

  // 复活机制
  private reviveCount: number = 0          // 本局已复活次数
  private maxRevives: number = 3           // 最大复活次数
  private comboShieldUsed: boolean = false  // 连击护盾是否已用
  private comboCount: number = 0           // 当前连击数
  private isInvincible: boolean = false    // 无敌保护状态
  private invincibleTimer: number | null = null

  constructor() {
    super()
    this.ballPhysics = new BallPhysics()
    this.trackManager = new TrackManager()
    this.audioManager = new AudioManager()
    
    // 监听球的事件
    this.setupBallPhysicsListeners()
    
    console.log('GameCore: Initialized')
  }

  /**
   * 设置球物理的事件监听
   */
  private setupBallPhysicsListeners(): void {
    // 监听落地事件
    this.ballPhysics.on('landed', (data) => {
      this.handleBallLanded(data)
    })

    // 监听颜色变化
    this.ballPhysics.on('color-changed', (color) => {
      if (this.renderer) {
        this.renderer.updateBallColor(color)
      }
      this.emit('ball-color-changed', color)
    })

    // 监听快照事件
    this.ballPhysics.on('snapped-to-block', () => {})

    // 监听加速状态变化
    this.ballPhysics.on('boost-activated', (data) => {
      if (this.renderer) {
        this.renderer.startBoostParticles()
      }
      this.emit('boost-activated', data)
    })

    this.ballPhysics.on('boost-deactivated', () => {
      if (this.renderer) {
        this.renderer.stopBoostParticles()
      }
      // 恢复音乐原始 BPM
      this.audioManager.deactivateBoostBPM()
      this.emit('boost-deactivated')
    })
  }

  /**
   * 处理球进行落地
   * @param data 落地数据
   */
  private handleBallLanded(data: any): void {
    const { position, lane } = data

    // 每次落地播放弹跳音效
    this.audioManager.playBounceSound()

    // 检查是否踩到了方块（包括自动吸附范围）
    let block = this.trackManager.checkBlockCollision(position.z, lane)

    // 如果当前车道没有匹配方块，自动吸附到最近的方块并调整球的车道
    if (!block) {
      const currentColor = this.ballPhysics.getColor()
      block = this.trackManager.findNearestBlockAnyLane(position.z, currentColor)
      if (block) {
        // 自动调整球到方块所在车道
        this.ballPhysics.changeLane(block.lane)
      }
    }

    if (block && !this.trackManager.isBlockHit(block.id)) {
      // 加速方块：不检查颜色，不改变球颜色，直接激活加速
      if (block.isBoost) {
        // 精确快照到方块
        this.ballPhysics.snapToBlock(block)
        // 标记为已命中
        this.trackManager.markBlockHit(block.id)
        // 激活加速（倍率和持续时间由难度配置决定）
        const boostMul = this.difficultyConfig?.boostMultiplier ?? 2
        const boostDur = this.difficultyConfig?.boostDuration ?? 10
        this.ballPhysics.activateBoost(boostMul, boostDur)
        // 同步音乐 BPM 加速
        this.audioManager.activateBoostBPM(boostMul)
        // 播放加速音效
        this.audioManager.playBoostSound()
        // 播放反弹效果
        if (this.renderer) {
          this.renderer.playBallBounceEffect()
          this.renderer.playPadBounceEffect(block.id)
          this.renderer.playRippleEffect(block.id)
          this.renderer.playLandingParticlesAtBall()
          this.renderer.playCameraShake(0.12, 180)
        }
        // 处理方块命中（计分）
        this.handleBlockHit(block)
        return
      }

      // 检查颜色匹配规则
      const currentBallColor = this.ballPhysics.getColor()

      if (block.isSplit && block.color !== currentBallColor) {
        // 无敌状态下跳过颜色检查，正常 snapToBlock
        if (this.isInvincible) {
          // 无敌期间踩错颜色不失败，正常处理
        } else {
          // 分裂方块颜色不匹配，游戏失败
          this.failGame(block)
          return
        }
      }

      if (block.isColorChanger) {
        // 颜色改变块：改变球的颜色
        this.ballPhysics.setColor(block.color)
      }

      // 精确快照到方块
      this.ballPhysics.snapToBlock(block)

      // 标记为已命中
      this.trackManager.markBlockHit(block.id)

      // 播放反弹效果：球体挤压 + 跳板下压回弹 + 涟漪扩散 + 落地粒子 + 摄像机震动
      if (this.renderer) {
        this.renderer.playBallBounceEffect()
        this.renderer.playPadBounceEffect(block.id)
        this.renderer.playRippleEffect(block.id)
        this.renderer.playLandingParticlesAtBall()
        this.renderer.playCameraShake(0.12, 180)
      }

      // 处理方块命中
      this.handleBlockHit(block)
      // 注：跳跃已在 BallPhysics 的着陆检测中自动触发
    } else if (!block) {
      // 球落入空位置
      if (!this.isInvincible) {
        this.failGame({ id: 'empty', color: 'none' })
      }
    }
  }

  /**
   * 初始化3D渲染
   * @param canvas HTML Canvas元素
   */
  initRenderer(canvas: HTMLCanvasElement): void {
    this.renderer = new Renderer3D(canvas)

    // 创建球体
    this.renderer.createBall(0.7)

    // 启动渲染
    this.renderer.startRendering()

    console.log('GameCore: Renderer initialized')
  }

  /**
   * 加载关卡
   * @param level 关卡配置或关卡ID字符串
   */
  loadLevel(level: LevelConfig | string): void {
    if (typeof level === 'string') {
      // 如果传入的是字符串ID，根据动态轨道加载处理
      this.trackManager.loadLevel(level)
      this.targetDistance = this.trackManager.getTargetDistance()
      // 应用场景主题
      const levelConfig = this.trackManager.getCurrentLevel()
      if (levelConfig?.sceneTheme && this.renderer) {
        this.renderer.setSceneTheme(levelConfig.sceneTheme)
      }
      console.log(`GameCore: Level loaded - ${level}`)
    } else {
      // 传入LevelConfig对象
      this.currentLevel = level
      this.trackManager.loadLevel(level.id)
      this.targetDistance = level.targetDistance
      // 应用场景主题
      if (level.sceneTheme && this.renderer) {
        this.renderer.setSceneTheme(level.sceneTheme)
      }
      console.log(`GameCore: Level loaded - ${level.name}`)
    }

    this.score = 0
    this.blocksHit = 0
    this.blocksMissed = 0
    this.hitBlocks.clear()

    // 获取并应用难度配置（速度倍率）
    this.difficultyConfig = this.trackManager.getDifficultyConfig()
    this.ballPhysics.setSpeedMultiplier(this.difficultyConfig.speedMultiplier)

    // 获取关卡对应的音乐配置
    const levelId = typeof level === 'string' ? level : level.id
    this.musicConfig = getMusicConfig(levelId) || null

    this.emit('level-loaded', level)
  }

  /**
   * 开始游戏
   */
  startGame(): void {
    if (!this.renderer) {
      console.error('GameCore: Renderer not initialized')
      return
    }

    // 重置球
    this.ballPhysics.reset()

    // 重置复活状态
    this.reviveCount = 0
    this.comboShieldUsed = false
    this.comboCount = 0
    this.isInvincible = false
    if (this.invincibleTimer !== null) {
      clearTimeout(this.invincibleTimer)
      this.invincibleTimer = null
    }

    // 设置球的初始颜色为块0的颜色（确保第一次着陆时颜色匹配）
    const firstBlockColor = this.trackManager.getFirstBlockColor()
    this.ballPhysics.setColor(firstBlockColor)
    console.log(`GameCore: Ball initialized with color ${firstBlockColor}`)

    // 更新游戏状态
    this.state = GameState.PLAYING
    this.startTime = Date.now()
    this.lastFrameTime = this.startTime
    this.deltaTime = 0

    // 立即跳跃一次
    this.ballPhysics.jump()

    // 启动背景音乐（先停止旧的，防止重试时叠加）
    this.audioManager.resumeContext()
    this.audioManager.stopBGM()
    this.audioManager.playBGM(this.musicConfig || undefined)

    // 启动游戏循环
    this.startGameLoop()

    console.log('GameCore: Game started')
    this.emit('game-started')
  }

  /**
   * 启动游戏循环
   */
  private startGameLoop(): void {
    const update = () => {
      if (this.state !== GameState.PLAYING) return

      const now = Date.now()
      this.deltaTime = (now - this.lastFrameTime) / 1000
      this.lastFrameTime = now
      this.frameCount++

      // 更新球的物理
      this.ballPhysics.update(this.deltaTime)

      // 获取球的状态（直接引用，无拷贝）
      const ballState = this.ballPhysics.getState()
      const ballPosition = this.ballPhysics.getPosition()

      // 更新轨道（动态加载）
      this.trackManager.updateTrack(ballPosition.z, this.deltaTime)

      // 获取节拍信息（供视觉层音画同步）
      const beatInfo = this.audioManager.getBeatInfo()

      // 更新渲染
      if (this.renderer) {
        this.renderer.updateBallState(ballState, beatInfo)
        this.renderer.updateCameraPosition(ballPosition, beatInfo)

        // 每 5 帧检查一次可见方块是否需要创建
        if (this.frameCount % 5 === 0) {
          const visibleBlocks = this.trackManager.getVisibleBlocks(ballPosition.z)
          for (const block of visibleBlocks) {
            if (!this.renderer.hasBlock(block.id)) {
              this.renderer.createTrackBlock(block)
            }
          }
        }

        // 每 30 帧清理一次身后方块
        if (this.frameCount % 30 === 0) {
          this.renderer.cleanupBehindBlocks(ballPosition.z)
        }

        // 单次渲染（合并到游戏循环，不再双重 rAF）
        this.renderer.render()
      }

      // 发出游戏更新事件
      const elapsedTime = (now - this.startTime) / 1000
      this.emit('game-update', {
        time: elapsedTime,
        score: this.score,
        blocksHit: this.blocksHit,
        blocksMissed: this.blocksMissed,
        ballZ: ballPosition.z,
        distance: ballPosition.z,
        targetDistance: this.targetDistance,
      })

      // 检测是否到达终点
      if (ballPosition.z >= this.targetDistance) {
        this.finishGame()
        return
      }

      requestAnimationFrame(update)
    }

    update()
  }

  /**
   * 处理踩中方块
   * @param block 方块对象
   */
  private handleBlockHit(block: any): void {
    this.blocksHit++
    this.comboCount++
    const points = 10 + (block.lane !== 1 ? 5 : 0) // 中间车道基础分，边车道加分

    this.score += points

    // 踩中方块播放命中音效
    this.audioManager.playHitSound()

    if (this.renderer) {
      this.renderer.removeBlock(block.id)
    }

    this.emit('block-hit', { blockId: block.id, points, color: block.color })
  }

  /**
   * 游戏失败 - 颜色不匹配时触发
   * 有复活机会时进入 REVIVING 状态，否则直接失败
   * @param block 导致失败的方块
   */
  private failGame(block: any): void {
    this.state = GameState.FINISHED

    // 记录死亡时连击数（用于连击护盾判断）
    const comboAtDeath = this.comboCount
    this.comboCount = 0

    // 停止背景音乐，播放失败音效
    this.audioManager.stopBGM()
    this.audioManager.playFailSound()

    // 播放球体破裂动画 + 强摄像机震动
    if (this.renderer) {
      this.renderer.playCameraShake(0.35, 400)
      this.renderer.playBallExplodeEffect()
    }

    // 游戏循环已停止（state=FINISHED），启动临时渲染循环让爆炸动画播完
    const failStartTime = Date.now()
    const failRender = () => {
      if (this.renderer) {
        this.renderer.render()
      }
      if (Date.now() - failStartTime < 1000) {
        requestAnimationFrame(failRender)
      }
    }
    requestAnimationFrame(failRender)

    // 延迟 1 秒后判断是否可以复活
    setTimeout(() => {
      const ballPos = this.ballPhysics.getPosition()

      if (this.reviveCount < this.maxRevives) {
        // 有复活机会，进入复活选择状态
        this.state = GameState.REVIVING
        const comboShieldAvailable = comboAtDeath >= 10 && !this.comboShieldUsed
        this.emit('game-revive-offer', {
          revivesLeft: this.maxRevives - this.reviveCount,
          comboShieldAvailable,
          score: this.score,
          ballZ: ballPos.z,
        })
      } else {
        // 无复活机会，直接失败
        const result = {
          levelId: this.currentLevel?.id || '',
          score: this.score,
          blocksHit: this.blocksHit,
          blocksMissed: this.blocksMissed,
          accuracy: this.calculateAccuracy(),
          distanceTraveled: ballPos.z,
          completedAt: Date.now(),
          reviveCount: this.reviveCount,
        }
        this.emit('game-failed', result)
      }
    }, 1000)
  }

  /**
   * 复活游戏
   * @param method 复活方式：'ad' 观看广告 | 'score' 分数复活 | 'shield' 连击护盾
   */
  reviveGame(method: 'ad' | 'score' | 'shield'): void {
    if (this.state !== GameState.REVIVING) return

    this.reviveCount++

    // 根据复活方式处理
    if (method === 'score') {
      this.score = Math.floor(this.score * 0.5)
    }
    if (method === 'shield') {
      this.comboShieldUsed = true
    }

    // 查找前方安全方块
    const ballPos = this.ballPhysics.getPosition()
    const ballColor = this.ballPhysics.getColor()
    const safeBlock = this.trackManager.findNextSafeBlock(ballPos.z, ballColor)

    if (!safeBlock) {
      // 找不到安全方块，直接失败
      this.emitFinalFail()
      return
    }

    // 确定复活后球的颜色（匹配目标方块）
    const reviveColor = safeBlock.isBoost ? ballColor : safeBlock.color

    // 轻量重置球到安全方块
    this.ballPhysics.softReset(safeBlock.position, safeBlock.lane, reviveColor)

    // 恢复球体可见性 + 播放重生特效
    if (this.renderer) {
      this.renderer.restoreBall()
      this.renderer.updateBallColor(reviveColor)
      this.renderer.playReviveEffect()
    }

    // 恢复 BGM
    this.audioManager.resumeContext()
    this.audioManager.playBGM(this.musicConfig || undefined)

    // 恢复游戏状态
    this.state = GameState.PLAYING
    this.lastFrameTime = Date.now()

    // 启动 2 秒无敌保护
    this.startInvincibleProtection()

    // 开始跳跃 + 重启游戏循环
    this.ballPhysics.jump()
    this.startGameLoop()

    this.emit('game-revived', { method, revivesLeft: this.maxRevives - this.reviveCount })
    console.log(`GameCore: Revived via ${method}, ${this.maxRevives - this.reviveCount} revives left`)
  }

  /**
   * 放弃复活，进入失败结算
   */
  giveUpRevive(): void {
    if (this.state !== GameState.REVIVING) return
    this.emitFinalFail()
  }

  /**
   * 发出最终失败事件
   */
  private emitFinalFail(): void {
    this.state = GameState.FINISHED
    const ballPos = this.ballPhysics.getPosition()
    const result = {
      levelId: this.currentLevel?.id || '',
      score: this.score,
      blocksHit: this.blocksHit,
      blocksMissed: this.blocksMissed,
      accuracy: this.calculateAccuracy(),
      distanceTraveled: ballPos.z,
      completedAt: Date.now(),
      reviveCount: this.reviveCount,
    }
    this.emit('game-failed', result)
  }

  /**
   * 启动无敌保护（2 秒）
   */
  private startInvincibleProtection(): void {
    this.isInvincible = true
    if (this.renderer) {
      this.renderer.startInvincibleBlink()
    }
    // 清除旧定时器
    if (this.invincibleTimer !== null) {
      clearTimeout(this.invincibleTimer)
    }
    this.invincibleTimer = window.setTimeout(() => {
      this.isInvincible = false
      this.invincibleTimer = null
      if (this.renderer) {
        this.renderer.stopInvincibleBlink()
      }
    }, 2000)
  }

  /**
   * 获取复活信息（供 UI 查询）
   */
  getReviveInfo(): { revivesLeft: number; score: number } {
    return {
      revivesLeft: this.maxRevives - this.reviveCount,
      score: this.score,
    }
  }

  /**
   * 游戏完成
   */
  private finishGame(): void {
    this.state = GameState.FINISHED
    if (this.renderer) {
      this.renderer.stopRendering()
    }

    // 停止背景音乐
    this.audioManager.stopBGM()

    const ballPosition = this.ballPhysics.getPosition()
    const result = {
      levelId: this.currentLevel?.id || '',
      score: this.score,
      blocksHit: this.blocksHit,
      blocksMissed: this.blocksMissed,
      accuracy: this.calculateAccuracy(),
      distanceTraveled: ballPosition.z,
      completedAt: Date.now(),
    }

    this.emit('game-finished', result)
    console.log('GameCore: Game finished', result)
  }

  /**
   * 计算准确率
   */
  private calculateAccuracy(): number {
    const total = this.blocksHit + this.blocksMissed
    if (total === 0) return 0
    return Math.round((this.blocksHit / total) * 100)
  }

  /**
   * 改变车道
   * @param lane 新车道（0, 1, 2）
   */
  changeLane(lane: number): void {
    if (this.state === GameState.PLAYING) {
      this.ballPhysics.changeLane(lane)
      this.emit('lane-changed', { lane })
    }
  }

  /**
   * 相对移动车道 - 每次只移动一个位置
   * @param direction 移动方向：-1 左移，0 移到中间，1 右移
   */
  moveLane(direction: number): void {
    if (this.state === GameState.PLAYING) {
      this.ballPhysics.moveLane(direction)
      this.emit('lane-changed', { lane: this.ballPhysics.getCurrentLane() })
    }
  }

  /**
   * 暂停游戏
   */
  pauseGame(): void {
    if (this.state !== GameState.PLAYING) return
    this.state = GameState.PAUSED
    this.audioManager.pauseBGM()
    this.emit('game-paused')
    console.log('GameCore: Game paused')
  }

  /**
   * 继续游戏
   */
  resumeGame(): void {
    if (this.state !== GameState.PAUSED) return
    this.state = GameState.PLAYING
    // 重置帧时间，避免恢复后第一帧 deltaTime 包含整个暂停时长
    this.lastFrameTime = Date.now()
    this.audioManager.resumeBGM()
    this.startGameLoop()
    this.emit('game-resumed')
    console.log('GameCore: Game resumed')
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
    return this.score
  }

  /**
   * 销毁游戏
   */
  destroy(): void {
    this.state = GameState.FINISHED
    this.audioManager.stopBGM()
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }
    this.score = 0
    this.blocksHit = 0
    this.blocksMissed = 0
    this.hitBlocks.clear()
    this.difficultyConfig = null
    this.musicConfig = null
    // 清理复活状态
    this.reviveCount = 0
    this.comboShieldUsed = false
    this.comboCount = 0
    this.isInvincible = false
    if (this.invincibleTimer !== null) {
      clearTimeout(this.invincibleTimer)
      this.invincibleTimer = null
    }
    console.log('GameCore: Destroyed')
  }
}

export default GameCore
