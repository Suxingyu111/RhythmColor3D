/**
 * 球形跳跃游戏的类型定义
 */

// 颜色类型
export enum ColorType {
  RED = 'red',
  GREEN = 'green',
  BLUE = 'blue',
  YELLOW = 'yellow',
  PURPLE = 'purple',
  CYAN = 'cyan',
  PINK = 'pink',
  ORANGE = 'orange',
  WHITE = 'white',
}

// 游戏难度
export enum Difficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  EXTREME = 'extreme',
}

// 游戏状态
export enum GameState {
  IDLE = 'idle',
  STARTING = 'starting',
  PLAYING = 'playing',
  PAUSED = 'paused',
  REVIVING = 'reviving',   // 复活选择中
  FINISHED = 'finished',
}

// 轨道方块配置
export interface TrackBlock {
  id: string
  color: ColorType
  position: number        // 轨道上的位置（0.0 - 1.0）
  lane: number           // 车道位置（0 = 左，1 = 中，2 = 右）
  isColorChanger: boolean // 该块是否改变球的颜色（true）或要求颜色匹配（false）
  isSplit?: boolean      // 是否分裂成左右两块（仅在lane=1时生效）
  isBoost?: boolean      // 是否为加速轨道（白色，踩到后加速）
}

// 场景主题配置
export interface SceneTheme {
  background: number      // 场景背景色 (hex)
  fogColor: number        // 雾效颜色
  fogNear: number         // 雾近端距离
  fogFar: number          // 雾远端距离
  ambientColor: number    // 环境光颜色
  ambientIntensity: number // 环境光强度
}

// 难度配置（驱动关卡实际游戏体验差异）
export interface DifficultyConfig {
  speedMultiplier: number      // 速度倍率 k（影响 moveSpeed、jumpForce、gravity）
  trackProbabilities: {        // 轨道类型概率（总和=1）
    straight: number           // 长直轨道（安全变色）
    triple: number             // 三块轨道（三选一）
    double: number             // 两块轨道（二选一）
    boost: number              // 加速轨道（白色）
  }
  boostMultiplier: number      // 加速方块的加速倍率
  boostDuration: number        // 加速持续时间（秒）
}

// 关卡配置
export interface LevelConfig {
  id: string
  name: string
  difficulty: Difficulty
  duration: number        // 关卡时长（秒）
  blockCount: number      // 方块数量
  blocks: TrackBlock[]
  targetDistance: number   // 目标距离（Z 轴单位），到达即通关
  sceneTheme?: SceneTheme // 关卡场景主题
  targetColor?: ColorType // 当前关卡的目标颜色（如果是颜色匹配模式）
  musicId?: string        // 音乐配置 ID，默认等于 level.id
}

// 玩家成绩
export interface GameResult {
  levelId: string
  score: number
  blocksHit: number       // 成功踩到的方块数
  blocksMissed: number    // 踩到错误颜色的数量
  accuracy: number        // 准确率（0-100）
  distanceTraveled: number // 走过的距离
  completedAt: number
}

// 游戏设置
export interface GameSettings {
  volume: number          // 0-100
  visualQuality: 'low' | 'medium' | 'high'
  enableVibration: boolean
  controlMode: 'auto' | 'manual'
}

// 球体状态
export interface BallState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  isJumping: boolean
  currentLane: number  // 0, 1, 2
  currentColor: ColorType // 当前球的颜色
}
