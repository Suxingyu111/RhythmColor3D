/**
 * 关卡/歌曲管理系统
 * 管理游戏的关卡和预设歌曲数据
 */

import { LevelConfig, ColorType, ColorBlock, Difficulty } from '@game/types'

/**
 * 颜色列表（用于生成色彩方块）
 */
const COLORS: ColorType[] = [
  ColorType.RED,
  ColorType.GREEN,
  ColorType.BLUE,
  ColorType.YELLOW,
  ColorType.PURPLE,
  ColorType.CYAN,
]

/**
 * 为关卡生成色彩方块序列
 * @param difficulty 难度
 * @param bpm 音乐BPM
 * @param duration 关卡总时长（毫秒）
 * @returns 方块列表
 */
function generateBlocksForLevel(
  difficulty: string,
  bpm: number,
  duration: number
): ColorBlock[] {
  const beatDuration = (60 / bpm) * 1000 // 一拍的毫秒数

  const blocks: ColorBlock[] = []
  let time = beatDuration * 2 // 从第2拍开始

  let density = 1 // 每拍生成的方块数量
  if (difficulty === 'normal') density = 1.5
  if (difficulty === 'hard') density = 2

  let blockId = 0
  while (time < duration) {
    const blockCount = Math.ceil(density)
    for (let i = 0; i < blockCount; i++) {
      if (Math.random() < (density % 1 || 1)) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        const posX = (Math.random() - 0.5) * 2 // -1 到 1
        const posY = (Math.random() - 0.5) * 2 // -1 到 1

        blocks.push({
          id: `block_${blockId++}`,
          color,
          targetTime: time + (i * beatDuration) / blockCount,
          positionX: posX,
          positionY: posY,
          clicked: false,
        })
      }
    }
    time += beatDuration
  }

  return blocks
}

/**
 * 预设关卡数据
 * 在实际项目中，这些数据应该从后端加载
 */
export const PRESET_LEVELS: LevelConfig[] = [
  {
    id: 'level_1_easy',
    name: '新手入门',
    musicFile: '/assets/music/sample-1.mp3',
    musicTitle: '彩色梦想',
    artist: 'Demo Artist',
    bpm: 120,
    difficulty: Difficulty.EASY,
    duration: 30000, // 30秒
    blocks: generateBlocksForLevel('easy', 120, 30000),
  },
  {
    id: 'level_2_normal',
    name: '标准难度',
    musicFile: '/assets/music/sample-2.mp3',
    musicTitle: '节奏之心',
    artist: 'Demo Artist',
    bpm: 140,
    difficulty: Difficulty.NORMAL,
    duration: 45000, // 45秒
    blocks: generateBlocksForLevel('normal', 140, 45000),
  },
  {
    id: 'level_3_hard',
    name: '挑战困难',
    musicFile: '/assets/music/sample-3.mp3',
    musicTitle: '炫彩风暴',
    artist: 'Demo Artist',
    bpm: 160,
    difficulty: Difficulty.HARD,
    duration: 60000, // 60秒
    blocks: generateBlocksForLevel('hard', 160, 60000),
  },
]

/**
 * 关卡管理器
 */
export class LevelManager {
  private levels: LevelConfig[] = PRESET_LEVELS
  private currentLevelIndex: number = 0

  /**
   * 获取所有关卡
   */
  getAllLevels(): LevelConfig[] {
    return [...this.levels]
  }

  /**
   * 按ID获取关卡
   * @param levelId 关卡ID
   */
  getLevelById(levelId: string): LevelConfig | undefined {
    return this.levels.find((l) => l.id === levelId)
  }

  /**
   * 按难度获取关卡
   * @param difficulty 难度
   */
  getLevelsByDifficulty(difficulty: Difficulty): LevelConfig[] {
    return this.levels.filter((l) => l.difficulty === difficulty)
  }

  /**
   * 获取下一个关卡
   */
  getNextLevel(): LevelConfig | undefined {
    if (this.currentLevelIndex + 1 < this.levels.length) {
      return this.levels[++this.currentLevelIndex]
    }
    return undefined
  }

  /**
   * 获取当前关卡
   */
  getCurrentLevel(): LevelConfig | undefined {
    return this.levels[this.currentLevelIndex]
  }

  /**
   * 设置当前关卡
   * @param index 关卡索引
   */
  setCurrentLevel(index: number): void {
    if (index >= 0 && index < this.levels.length) {
      this.currentLevelIndex = index
    }
  }

  /**
   * 添加自定义关卡
   * @param level 关卡配置
   */
  addLevel(level: LevelConfig): void {
    this.levels.push(level)
  }

  /**
   * 获取关卡总数
   */
  getLevelCount(): number {
    return this.levels.length
  }
}

export default LevelManager
