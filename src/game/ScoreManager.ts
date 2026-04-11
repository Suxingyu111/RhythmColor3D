/**
 * 分数管理系统
 * 处理游戏中的分数计算、连击、和成绩统计
 */

import { HitRating, GameResult } from '@game/types'
import { getScoreByRating } from './RhythmDetector'
import { getRewardByRating } from './ColorMatcher'

export class ScoreManager {
  // 当前分数
  private score: number = 0

  // 当前连击数
  private combo: number = 0

  // 最大连击数
  private maxCombo: number = 0

  // 流血倍数（连击达到一定数值时触发）
  private comboMultiplier: number = 1.0

  // 统计各类等级的击打次数
  private hitCounts = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  }

  // 连击达到的阈值 => 倍数映射
  private comboThresholds = [
    { threshold: 10, multiplier: 1.2 },
    { threshold: 25, multiplier: 1.5 },
    { threshold: 50, multiplier: 2.0 },
    { threshold: 100, multiplier: 2.5 },
  ]

  constructor() {
    this.reset()
  }

  /**
   * 重置分数管理器
   */
  reset(): void {
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.comboMultiplier = 1.0
    this.hitCounts = {
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
    }
  }

  /**
   * 记录一次击打
   * @param rating 击打等级
   * @returns 本次获得的分数
   */
  recordHit(rating: HitRating): number {
    // 更新统计计数
    switch (rating) {
      case HitRating.PERFECT:
        this.hitCounts.perfect++
        break
      case HitRating.GREAT:
        this.hitCounts.great++
        break
      case HitRating.GOOD:
        this.hitCounts.good++
        break
      case HitRating.MISS:
        this.hitCounts.miss++
        break
    }

    // 计算分数
    const baseScore = getScoreByRating(rating)
    const rewardByRating = getRewardByRating(rating)

    if (rating === HitRating.MISS) {
      // 未击中重置连击
      this.combo = 0
      this.comboMultiplier = 1.0
    } else {
      // 更新连击
      this.combo += rewardByRating
      this.updateComboMultiplier()

      // 更新最大连击
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo
      }
    }

    // 应用连击倍数计算最终分数
    const finalScore = Math.floor(baseScore * this.comboMultiplier)
    this.score += finalScore

    return finalScore
  }

  /**
   * 根据连击数更新倍数
   */
  private updateComboMultiplier(): void {
    this.comboMultiplier = 1.0
    for (const { threshold, multiplier } of this.comboThresholds) {
      if (this.combo >= threshold) {
        this.comboMultiplier = multiplier
      }
    }
  }

  /**
   * 获取当前分数
   */
  getScore(): number {
    return this.score
  }

  /**
   * 获取当前连击数
   */
  getCombo(): number {
    return this.combo
  }

  /**
   * 获取最大连击数
   */
  getMaxCombo(): number {
    return this.maxCombo
  }

  /**
   * 获取连击倍数
   */
  getComboMultiplier(): number {
    return this.comboMultiplier
  }

  /**
   * 获取准确率（0-100）
   */
  getAccuracy(): number {
    const total =
      this.hitCounts.perfect +
      this.hitCounts.great +
      this.hitCounts.good +
      this.hitCounts.miss
    if (total === 0) return 0

    const weighted =
      this.hitCounts.perfect * 100 +
      this.hitCounts.great * 90 +
      this.hitCounts.good * 70 +
      this.hitCounts.miss * 0
    return Math.round((weighted / (total * 100)) * 100)
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.comboMultiplier,
      accuracy: this.getAccuracy(),
      hits: { ...this.hitCounts },
    }
  }

  /**
   * 生成最终成绩对象
   * @param levelId 关卡ID
   * @returns 游戏成绩
   */
  generateResult(levelId: string): GameResult {
    return {
      levelId,
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: this.getAccuracy(),
      hitCounts: { ...this.hitCounts },
      completedAt: Date.now(),
    }
  }
}

export default ScoreManager
