/**
 * 轨道管理系统 - 动态加载版本
 * 无限生成轨道方块，按需加载
 */

import { LevelConfig, TrackBlock, ColorType, Difficulty, SceneTheme, DifficultyConfig } from '@game/types'

// 颜色列表
const COLORS: ColorType[] = [
  ColorType.RED,
  ColorType.GREEN,
  ColorType.BLUE,
  ColorType.YELLOW,
  ColorType.PURPLE,
  ColorType.CYAN,
  ColorType.PINK,
  ColorType.ORANGE,
]

// 轨道系统的三种颜色
const TRACK_COLORS = [ColorType.PINK, ColorType.YELLOW, ColorType.BLUE]

/**
 * 轨道类型定义
 * (1) 长直轨道：1个完整方块，粉/黄/蓝任选一种
 * (2) 三块轨道：3个分裂方块，分别为粉、黄、蓝
 * (3) 两块轨道：2个分裂方块，从粉/黄/蓝中选二
 */
enum TrackType {
  STRAIGHT = 'straight',      // 长直轨道（1块）
  TRIPLE = 'triple',          // 三块轨道（3块）
  DOUBLE = 'double',          // 两块轨道（2块）
  BOOST = 'boost',            // 加速轨道（白色，踩到后加速）
}

/**
 * 难度配置表 — 驱动轨道生成概率、速度倍率、加速参数
 */
const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {
  easy: {
    speedMultiplier: 1.0,
    trackProbabilities: { straight: 0.45, triple: 0.15, double: 0.30, boost: 0.10 },
    boostMultiplier: 1.5,
    boostDuration: 6,
  },
  normal: {
    speedMultiplier: 1.2,
    trackProbabilities: { straight: 0.30, triple: 0.25, double: 0.25, boost: 0.20 },
    boostMultiplier: 2.0,
    boostDuration: 8,
  },
  hard: {
    speedMultiplier: 1.5,
    trackProbabilities: { straight: 0.20, triple: 0.28, double: 0.27, boost: 0.25 },
    boostMultiplier: 2.5,
    boostDuration: 10,
  },
  extreme: {
    speedMultiplier: 1.8,
    trackProbabilities: { straight: 0.12, triple: 0.30, double: 0.30, boost: 0.28 },
    boostMultiplier: 3.0,
    boostDuration: 10,
  },
}

/**
 * 预设关卡（用于菜单和难度选择）
 */
export const PRESET_LEVELS: LevelConfig[] = [
  {
    id: 'level_1_moon',
    name: '月球漫步',
    difficulty: Difficulty.EASY,
    duration: 60,
    blockCount: Infinity,
    targetDistance: 200,
    blocks: [],
    sceneTheme: { background: 0x0a0a14, fogColor: 0x0a0a14, fogNear: 60, fogFar: 250, ambientColor: 0xaabbcc, ambientIntensity: 0.7 },
  },
  {
    id: 'level_2_mars',
    name: '火星风暴',
    difficulty: Difficulty.EASY,
    duration: 75,
    blockCount: Infinity,
    targetDistance: 300,
    blocks: [],
    sceneTheme: { background: 0x1a0800, fogColor: 0x1a0800, fogNear: 60, fogFar: 250, ambientColor: 0xcc8866, ambientIntensity: 0.65 },
  },
  {
    id: 'level_3_venus',
    name: '金星熔炉',
    difficulty: Difficulty.NORMAL,
    duration: 90,
    blockCount: Infinity,
    targetDistance: 400,
    blocks: [],
    sceneTheme: { background: 0x1a1200, fogColor: 0x1a1200, fogNear: 55, fogFar: 240, ambientColor: 0xccaa55, ambientIntensity: 0.65 },
  },
  {
    id: 'level_4_jupiter',
    name: '木星漩涡',
    difficulty: Difficulty.NORMAL,
    duration: 100,
    blockCount: Infinity,
    targetDistance: 500,
    blocks: [],
    sceneTheme: { background: 0x0d0a05, fogColor: 0x0d0a05, fogNear: 55, fogFar: 240, ambientColor: 0xbb9966, ambientIntensity: 0.6 },
  },
  {
    id: 'level_5_saturn',
    name: '土星光环',
    difficulty: Difficulty.NORMAL,
    duration: 110,
    blockCount: Infinity,
    targetDistance: 600,
    blocks: [],
    sceneTheme: { background: 0x0f0d05, fogColor: 0x0f0d05, fogNear: 50, fogFar: 230, ambientColor: 0xccbb77, ambientIntensity: 0.6 },
  },
  {
    id: 'level_6_uranus',
    name: '天王星冰原',
    difficulty: Difficulty.HARD,
    duration: 120,
    blockCount: Infinity,
    targetDistance: 750,
    blocks: [],
    sceneTheme: { background: 0x041018, fogColor: 0x041018, fogNear: 50, fogFar: 220, ambientColor: 0x66aacc, ambientIntensity: 0.55 },
  },
  {
    id: 'level_7_neptune',
    name: '海王星深渊',
    difficulty: Difficulty.HARD,
    duration: 130,
    blockCount: Infinity,
    targetDistance: 900,
    blocks: [],
    sceneTheme: { background: 0x020810, fogColor: 0x020810, fogNear: 45, fogFar: 210, ambientColor: 0x4477bb, ambientIntensity: 0.55 },
  },
  {
    id: 'level_8_sirius',
    name: '天狼星闪耀',
    difficulty: Difficulty.HARD,
    duration: 140,
    blockCount: Infinity,
    targetDistance: 1050,
    blocks: [],
    sceneTheme: { background: 0x050814, fogColor: 0x050814, fogNear: 45, fogFar: 200, ambientColor: 0x99bbff, ambientIntensity: 0.6 },
  },
  {
    id: 'level_9_betelgeuse',
    name: '参宿四脉动',
    difficulty: Difficulty.EXTREME,
    duration: 150,
    blockCount: Infinity,
    targetDistance: 1200,
    blocks: [],
    sceneTheme: { background: 0x140200, fogColor: 0x140200, fogNear: 40, fogFar: 190, ambientColor: 0xcc4422, ambientIntensity: 0.5 },
  },
  {
    id: 'level_10_blackhole',
    name: '黑洞边界',
    difficulty: Difficulty.EXTREME,
    duration: 180,
    blockCount: Infinity,
    targetDistance: 1500,
    blocks: [],
    sceneTheme: { background: 0x020005, fogColor: 0x020005, fogNear: 35, fogFar: 180, ambientColor: 0x7733aa, ambientIntensity: 0.45 },
  },
]

/**
 * 基于索引和种子的随机函数
 * 不同 seed 产生完全不同的序列，同一 seed+index 保持确定性
 */
function seededRandom(index: number, seed: number = 0): number {
  let h = (index + seed) * 2654435761
  h = ((h >>> 16) ^ h) * 0x45d9f3b
  h = ((h >>> 16) ^ h) * 0x45d9f3b
  h = (h >>> 16) ^ h
  return (h & 0x7fffffff) / 0x7fffffff
}

/**
 * 确定性选择两色组合，必须包含 ballColor
 * 同时随机决定两个颜色分配到哪个车道
 */
function pickDoubleColorsWithBall(index: number, ballColor: ColorType, seed: number): ColorType[] {
  const allCombos = [
    [ColorType.PINK, ColorType.YELLOW],
    [ColorType.YELLOW, ColorType.BLUE],
    [ColorType.PINK, ColorType.BLUE],
  ]
  // 必须包含球当前颜色
  const validCombos = allCombos.filter(combo => combo.includes(ballColor))
  const idx = Math.floor(seededRandom(index + 20000, seed) * validCombos.length)
  const colors = [...validCombos[idx]]
  // 随机交换两个颜色的位置，避免同一车道总是同一颜色
  if (seededRandom(index + 30000, seed) > 0.5) {
    colors.reverse()
  }
  return colors
}

/**
 * 随机打乱三色排列
 */
function shuffleTripleColors(index: number, seed: number): ColorType[] {
  const colors = [...TRACK_COLORS]
  // Fisher-Yates 洗牌（3 个元素）
  for (let j = 2; j > 0; j--) {
    const k = Math.floor(seededRandom(index + 40000 + j, seed) * (j + 1))
    const tmp = colors[j]
    colors[j] = colors[k]
    colors[k] = tmp
  }
  return colors
}

/**
 * 生成结果
 */
interface GenerateResult {
  blocks: TrackBlock[]
  ballColor: ColorType  // 球在最后一个长直轨道后的颜色
}

/**
 * 计算指定索引的长直轨道颜色（确定性）
 * 抽取为独立函数，避免重复代码
 */
function computeStraightColor(i: number, currentBallColor: ColorType, seed: number): ColorType {
  let colorIdx = Math.floor(seededRandom(i + 10000, seed) * TRACK_COLORS.length)
  let color = TRACK_COLORS[colorIdx]
  if (color === currentBallColor) {
    colorIdx = (colorIdx + 1 + Math.floor(seededRandom(i + 15000, seed) * 2)) % TRACK_COLORS.length
    color = TRACK_COLORS[colorIdx]
  }
  return color
}

/**
 * 生成指定范围内的轨道方块
 *
 * 轨道类型完全随机，无连续约束：
 * - 长直轨道 30%、三块轨道 25%、两块轨道 25%、加速轨道 20%
 * - 第一个方块强制为长直轨道
 *
 * 颜色连续性算法（基于球的颜色）：
 * - 球只在长直轨道变色，两块/三块轨道不改变球颜色
 * - 三块轨道包含全部三色，天然满足
 * - 两块轨道从包含球颜色的组合中选
 *
 * 注意：为了保证颜色链的确定性，始终从 index 0 开始计算轨道类型序列，
 * 但只为 [startIndex, endIndex] 范围内的索引生成实际方块数据。
 */
function generateBlocksInRange(
  startZ: number,
  endZ: number,
  ballColor: ColorType,
  difficulty: string = 'normal',
  seed: number = 0
): GenerateResult {
  const blocks: TrackBlock[] = []
  const blockSpacing = 5

  let startIndex = Math.floor(startZ / blockSpacing)
  if (startIndex < 0) startIndex = 0
  const endIndex = Math.floor(endZ / blockSpacing)

  // 从 index 0 开始计算，确保轨道类型约束在整个序列中一致
  // 初始球颜色固定为 PINK（与 loadLevel 中的 lastBallColor 初始值一致）
  let trackBallColor: ColorType = ColorType.PINK

  for (let i = 0; i <= endIndex; i++) {
    const blockZ = i * blockSpacing

    // 确定轨道类型（基于难度配置的概率分布）
    let trackType: number  // 0=长直, 1=三块, 2=两块, 3=加速
    if (i === 0) {
      // 第一个方块强制为长直轨道，避免开局就失败
      trackType = 0
    } else {
      // 根据难度配置的概率分布随机选择轨道类型
      const config = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS['normal']
      const p = config.trackProbabilities
      const roll = seededRandom(i, seed)
      if (roll < p.boost) {
        trackType = 3  // 加速
      } else if (roll < p.boost + p.triple) {
        trackType = 1  // 三块
      } else if (roll < p.boost + p.triple + p.double) {
        trackType = 2  // 两块
      } else {
        trackType = 0  // 长直
      }
    }

    // 只为请求范围内的索引生成方块
    if (i >= startIndex) {
      if (trackType === 3) {
        // 加速轨道：白色，外观同长直轨道，不改变球颜色
        blocks.push({
          id: `block_${i}`,
          color: ColorType.WHITE,
          position: blockZ,
          lane: 1,
          isColorChanger: false,
          isSplit: false,
          isBoost: true,
        })
      } else if (trackType === 0) {
        // 长直轨道：变色方块
        const color = computeStraightColor(i, trackBallColor, seed)
        blocks.push({
          id: `block_${i}`,
          color,
          position: blockZ,
          lane: 1,
          isColorChanger: true,
          isSplit: false,
        })
        trackBallColor = color
      } else if (trackType === 1) {
        // 三块轨道：随机打乱三色排列，球颜色不在 lane 0 或 2 的对角
        // 确保球颜色不在与当前球位置相距 2 格的车道（但保持随机性）
        const shuffled = shuffleTripleColors(i, seed)
        for (let laneIdx = 0; laneIdx < 3; laneIdx++) {
          blocks.push({
            id: `block_${i}_L${laneIdx}`,
            color: shuffled[laneIdx],
            position: blockZ,
            lane: laneIdx,
            isColorChanger: false,
            isSplit: true,
          })
        }
      } else {
        // 两块轨道：使用相邻车道对 [0,1] 或 [1,2]，避免跨两格
        const colors = pickDoubleColorsWithBall(i, trackBallColor, seed)
        const useLeftPair = seededRandom(i + 50000, seed) > 0.5
        const lanes = useLeftPair ? [0, 1] : [1, 2]
        for (let idx = 0; idx < 2; idx++) {
          blocks.push({
            id: `block_${i}_L${lanes[idx]}`,
            color: colors[idx],
            position: blockZ,
            lane: lanes[idx],
            isColorChanger: false,
            isSplit: true,
          })
        }
      }
    } else {
      // 不在请求范围内，但仍需追踪球颜色变化
      if (trackType === 0) {
        trackBallColor = computeStraightColor(i, trackBallColor, seed)
      }
    }
  }

  return { blocks, ballColor: trackBallColor }
}

/**
 * 轨道管理器 - 支持动态加载
 */
export class TrackManager {
  // 难度设置
  private difficulty: string = 'normal'
  private currentLevelId: string = 'level_2_normal'
  // 随机种子：每次 loadLevel 时重新生成，确保每局不同
  private seed: number = Date.now()
  // 动态生成的块
  private allBlocks: Map<string, TrackBlock> = new Map()
  private loadedRanges: Array<{ start: number; end: number }> = []

  // 当前加载的范围
  private lastLoadedZ: number = 0
  private loadAheadDistance: number = 150 // 提前加载150单位，轨道看不到尽头

  // 块跟踪
  private hitBlocks: Set<string> = new Set()
  private blockCleanupThreshold: number = -20 // 身后20单位删除块

  // 颜色链状态：追踪球的颜色（只有长直轨道会改变）
  private lastBallColor: ColorType = ColorType.PINK

  // 目标距离
  private targetDistance: number = 500

  constructor(difficulty: string = 'normal') {
    this.difficulty = difficulty

    // 初始加载第一批块 - 从 Z=0 到 Z=50，确保球一开始就有方块可以踩
    this.loadBlocksAhead(0)
  }

  /**
   * 动态加载前方的块
   * @param ballZ 球的当前Z位置
   */
  private loadBlocksAhead(ballZ: number): void {
    // 在球的当前位置和前方加载块
    // 因为球自动前进，我们需要确保球前方有足够的块
    const targetZ = ballZ + this.loadAheadDistance

    // 如果已经加载过，不重复加载
    if (targetZ < this.lastLoadedZ) return

    // 限制不超过终点距离（留 10 单位缓冲）
    const maxZ = Math.min(targetZ, this.targetDistance + 10)

    // 生成新块，传入球颜色状态
    const startZ = this.lastLoadedZ > 0 ? this.lastLoadedZ : Math.max(0, ballZ - 5)
    const result = generateBlocksInRange(
      startZ,
      maxZ,
      this.lastBallColor,
      this.difficulty,
      this.seed
    )

    // 存储新块
    for (const block of result.blocks) {
      this.allBlocks.set(block.id, block)
    }

    // 更新球颜色状态
    this.lastBallColor = result.ballColor

    this.lastLoadedZ = maxZ
  }

  /**
   * 清理身后的块以节省内存
   * @param ballZ 球的当前Z位置
   */
  private cleanupFarBlocks(ballZ: number): void {
    const cleanupZ = ballZ + this.blockCleanupThreshold

    const toDelete: string[] = []
    for (const [id, block] of this.allBlocks.entries()) {
      if (block.position < cleanupZ) {
        toDelete.push(id)
      }
    }

    if (toDelete.length > 0) {
      for (const id of toDelete) {
        this.allBlocks.delete(id)
      }
    }
  }

  /**
   * 更新轨道（每帧调用）
   * @param ballZ 球的当前Z位置
   * @param deltaTime 时间差（秒）
   */
  updateTrack(ballZ: number, deltaTime: number): void {
    // 按需加载前方块
    this.loadBlocksAhead(ballZ)

    // 方块保持在固定位置，不再移动
    // 方块的位置直接使用在生成时设定的 position

    // 清理身后块
    this.cleanupFarBlocks(ballZ)
  }

  /**
   * 获取所有关卡
   */
  getAllLevels(): LevelConfig[] {
    return [...PRESET_LEVELS]
  }

  /**
   * 加载关卡（动态模式下简化处理）
   * @param levelId 关卡ID
   */
  loadLevel(levelId: string): boolean {
    // 在动态模式下，关卡ID用于设置难度
    const difficultyMap: { [key: string]: string } = {
      'level_1_moon': 'easy',
      'level_2_mars': 'easy',
      'level_3_venus': 'normal',
      'level_4_jupiter': 'normal',
      'level_5_saturn': 'normal',
      'level_6_uranus': 'hard',
      'level_7_neptune': 'hard',
      'level_8_sirius': 'hard',
      'level_9_betelgeuse': 'extreme',
      'level_10_blackhole': 'extreme',
    }

    this.difficulty = difficultyMap[levelId] || 'normal'
    this.currentLevelId = levelId

    // 每次加载关卡生成新的随机种子，确保每局轨道不同
    this.seed = Date.now()

    // 重置块
    this.allBlocks.clear()
    this.loadedRanges = []
    this.lastLoadedZ = 0
    this.hitBlocks.clear()
    this.lastBallColor = ColorType.PINK

    // 读取目标距离
    const level = PRESET_LEVELS.find(l => l.id === levelId)
    this.targetDistance = level?.targetDistance || 500
    
    // 初始化第一批块
    this.loadBlocksAhead(0)
    
    console.log(`TrackManager: Level loaded with difficulty ${this.difficulty}`)
    return true
  }

  /**
   * 获取当前关卡
   */
  getCurrentLevel(): LevelConfig | null {
    const level = PRESET_LEVELS.find((l) => l.id === this.currentLevelId)
    return level || null
  }

  /**
   * 获取当前关卡的目标距离
   */
  getTargetDistance(): number {
    return this.targetDistance
  }

  /**
   * 获取下一个关卡
   */
  getNextLevel(): LevelConfig | null {
    return null
  }

  /**
   * 获取当前难度配置（供 GameCore 读取速度倍率和加速参数）
   */
  getDifficultyConfig(): DifficultyConfig {
    return DIFFICULTY_CONFIGS[this.difficulty] || DIFFICULTY_CONFIGS['normal']
  }

  /**
   * 获取可见的方块
   * @param ballZ 球的Z轴位置
   * @returns 可见方块数组
   */
  getVisibleBlocks(ballZ: number): TrackBlock[] {
    // 获取球前方80单位范围内的方块，让轨道看起来延伸到远方
    const visibleBlocks: TrackBlock[] = []

    for (const block of this.allBlocks.values()) {
      const distance = block.position - ballZ
      if (distance > -2 && distance < 80) {
        visibleBlocks.push(block)
      }
    }

    return visibleBlocks
  }

  /**
   * 获取块0（第一个块的颜色配置）
   * 用于初始化球的颜色
   * @returns 块0的颜色
   */
  getFirstBlockColor(): ColorType {
    const firstBlock = this.allBlocks.get('block_0')
    if (firstBlock) {
      return firstBlock.color
    }
    // 如果块0不存在，生成一个临时的来获取颜色
    const result = generateBlocksInRange(0, 3, ColorType.PINK, this.difficulty, this.seed)
    if (result.blocks.length > 0) {
      return result.blocks[0].color
    }
    return COLORS[0] // 默认为第一个颜色
  }

  /**
   * 获取块碰撞 - 改进版本，严格碰撞检测
   * 规则：
   * - 普通方块（lane=1，!isSplit）：所有车道都能踩到
   * - 分裂方块（lane=1，isSplit=true）：所有车道都能踩到
   * 关键点：球的X位置在改变车道时立即更新，所以只需检查Z轴距离
   * @param ballZ 球的Z轴位置
   * @param ballLane 球的车道
   * @returns 碰撞的块，如果没有返回null
   */
  checkBlockCollision(ballZ: number, ballLane: number): TrackBlock | null {
    // 精确碰撞范围：根据方块宽度设置
    // 普通块宽度2.6，半宽1.3；分裂块宽度2.0（两个1.0子块），半宽1.0
    // 使用1.0可以安全覆盖所有情况
    const precisionRange = 1.0

    let closestBlock: TrackBlock | null = null
    let closestDistance = Infinity

    for (const block of this.allBlocks.values()) {
      // 检查块是否已被击中
      if (this.hitBlocks.has(block.id)) {
        continue
      }

      // 检查车道是否匹配
      let laneMatches = false
      if (!block.isSplit && block.lane === 1) {
        // 长直轨道（宽矩形）：所有车道都能踩到
        laneMatches = true
      } else {
        // 小方形轨道：需要精确车道匹配
        laneMatches = (block.lane === ballLane)
      }

      if (!laneMatches) {
        continue
      }

      const distance = Math.abs(block.position - ballZ)

      // 首选：精确范围内的块
      if (distance < precisionRange) {
        return block
      }

      // 备选：记录最近的块（用于扩展搜索）
      if (distance < closestDistance) {
        closestDistance = distance
        closestBlock = block
      }
    }

    // 第二优先级：在更大范围内自动吸附（防止遗漏）
    const searchRange = 1.5
    if (closestDistance < searchRange) {
      return closestBlock
    }

    return null
  }

  /**
   * 查找最近的方块（忽略车道限制）— 用于自动吸附防踩空
   * 优先选择颜色匹配的方块，其次选择变色方块/加速方块
   * @param ballZ 球的Z轴位置
   * @param ballColor 球当前颜色（可选，用于优先匹配）
   * @returns 最近的未命中方块，如果没有返回null
   */
  findNearestBlockAnyLane(ballZ: number, ballColor?: ColorType): TrackBlock | null {
    const searchRange = 2.5
    let bestBlock: TrackBlock | null = null
    let bestDistance = Infinity
    let bestPriority = -1  // 0=颜色匹配, 1=变色/加速, 2=其他

    for (const block of this.allBlocks.values()) {
      if (this.hitBlocks.has(block.id)) continue
      const distance = Math.abs(block.position - ballZ)
      if (distance >= searchRange) continue

      // 计算优先级
      let priority = 2
      if (block.isBoost || block.isColorChanger) {
        priority = 1  // 变色方块和加速方块安全
      }
      if (ballColor && block.color === ballColor) {
        priority = 0  // 颜色匹配最优先
      }

      // 优先级更高，或同优先级距离更近
      if (priority > bestPriority || (priority === bestPriority && distance < bestDistance)) {
        bestPriority = priority
        bestDistance = distance
        bestBlock = block
      }
    }

    return bestBlock
  }

  /**
   * 查找前方安全方块 — 复活时传送目标
   * 优先级：变色方块 > 加速方块 > 颜色匹配的分裂方块
   * @param ballZ 球当前 Z 位置
   * @param ballColor 球当前颜色
   * @returns 安全方块，找不到返回 null
   */
  findNextSafeBlock(ballZ: number, ballColor: ColorType): TrackBlock | null {
    // 先确保前方有足够方块
    this.loadBlocksAhead(ballZ)

    // 收集前方 5-50 单位范围内的未命中方块
    const candidates: TrackBlock[] = []
    for (const block of this.allBlocks.values()) {
      if (this.hitBlocks.has(block.id)) continue
      const dist = block.position - ballZ
      if (dist >= 5 && dist <= 50) {
        candidates.push(block)
      }
    }

    // 按距离排序（近的优先）
    candidates.sort((a, b) => a.position - b.position)

    // 按优先级搜索：变色方块 > 加速方块 > 颜色匹配分裂方块
    let colorChanger: TrackBlock | null = null
    let boostBlock: TrackBlock | null = null
    let colorMatch: TrackBlock | null = null

    for (const block of candidates) {
      if (block.isColorChanger && !colorChanger) {
        colorChanger = block
        break  // 变色方块最安全，直接返回
      }
      if (block.isBoost && !boostBlock) {
        boostBlock = block
      }
      if (block.isSplit && block.color === ballColor && !colorMatch) {
        colorMatch = block
      }
    }

    return colorChanger || boostBlock || colorMatch || candidates[0] || null
  }

  /**
   * 标记块为已命中
   * @param blockId 块ID
   */
  markBlockHit(blockId: string): void {
    this.hitBlocks.add(blockId)
  }

  /**
   * 检查块是否已命中
   * @param blockId 块ID
   */
  isBlockHit(blockId: string): boolean {
    return this.hitBlocks.has(blockId)
  }

  /**
   * 获取剩余块数（动态模式下无限）
   */
  getRemainingBlockCount(): number {
    return this.allBlocks.size
  }

  /**
   * 获取关卡在预设列表中的索引
   * @param levelId 关卡ID
   * @returns 索引（从0开始），未找到返回 -1
   */
  getLevelIndex(levelId: string): number {
    return PRESET_LEVELS.findIndex(l => l.id === levelId)
  }

  /**
   * 根据索引获取关卡ID
   * @param index 索引（从0开始）
   * @returns 关卡ID，越界返回 null
   */
  getLevelIdByIndex(index: number): string | null {
    if (index < 0 || index >= PRESET_LEVELS.length) return null
    return PRESET_LEVELS[index].id
  }

  /**
   * 获取总块数（动态模式下无限）
   */
  getTotalBlockCount(): number {
    return Infinity
  }

  /**
   * 获取某个位置附近的块（用于调试）
   * @param ballZ 球的Z轴位置
   * @param ballLane 球的车道
   * @param range 搜索范围
   * @returns 该范围内的所有块
   */
  getNearbyBlocks(ballZ: number, ballLane: number, range: number): TrackBlock[] {
    const nearby: TrackBlock[] = []
    for (const block of this.allBlocks.values()) {
      const distance = Math.abs(block.position - ballZ)
      if (distance < range) {
        nearby.push(block)
      }
    }
    // 按Z位置排序以便调试
    return nearby.sort((a, b) => a.position - b.position)
  }
}

export default TrackManager
