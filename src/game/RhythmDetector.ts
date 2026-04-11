/**
 * 节奏检测系统
 * 根据音乐播放进度和目标时间进行节奏检测
 */

import { HitRating } from '@game/types'

// 击打的不同评级范围（毫秒）
const HIT_WINDOWS = {
  PERFECT: 50,   // ±50ms
  GREAT: 100,    // ±100ms
  GOOD: 150,     // ±150ms
  MISS: Infinity, // > 150ms
}

/**
 * 根据击打时间差判定等级
 * @param timeDifference 击打时间与目标时间的差值（毫秒）
 * @returns 击打等级
 */
export function getRatingByTimeDifference(timeDifference: number): HitRating {
  const absDiff = Math.abs(timeDifference)

  if (absDiff <= HIT_WINDOWS.PERFECT) {
    return HitRating.PERFECT
  }
  if (absDiff <= HIT_WINDOWS.GREAT) {
    return HitRating.GREAT
  }
  if (absDiff <= HIT_WINDOWS.GOOD) {
    return HitRating.GOOD
  }
  return HitRating.MISS
}

/**
 * 获取击打等级对应的分数
 * @param rating 击打等级
 * @returns 基础分数
 */
export function getScoreByRating(rating: HitRating): number {
  const scores: Record<HitRating, number> = {
    [HitRating.PERFECT]: 100,
    [HitRating.GREAT]: 80,
    [HitRating.GOOD]: 50,
    [HitRating.MISS]: 0,
  }
  return scores[rating]
}

/**
 * 检测是否击中了某个目标
 * @param currentTime 当前音乐时间（毫秒）
 * @param targetTime 目标击打时间（毫秒）
 * @param tolerance 容差（毫秒，默认150ms）
 * @returns 是否击中以及击打等级
 */
export function detectHit(
  currentTime: number,
  targetTime: number,
  tolerance: number = HIT_WINDOWS.GOOD
): { hit: boolean; rating: HitRating } {
  const timeDifference = currentTime - targetTime

  // 如果还没有到达目标时间前150ms，还没开始
  if (timeDifference < -tolerance) {
    return { hit: false, rating: HitRating.MISS }
  }

  // 已经超过目标时间超过150ms，判定为Miss
  if (timeDifference > tolerance) {
    return { hit: false, rating: HitRating.MISS }
  }

  const rating = getRatingByTimeDifference(timeDifference)
  return { hit: true, rating }
}

/**
 * 计算准确率百分比（0-100）
 * @param perfectCount 完美击打数
 * @param greatCount 很好击打数
 * @param goodCount 良好击打数
 * @param missCount 未击中数
 * @returns 准确率百分比
 */
export function calculateAccuracy(
  perfectCount: number,
  greatCount: number,
  goodCount: number,
  missCount: number
): number {
  const total = perfectCount + greatCount + goodCount + missCount
  if (total === 0) return 0

  // 权重计算：Perfect=100%, Great=90%, Good=70%, Miss=0%
  const weightedScore =
    perfectCount * 100 + greatCount * 90 + goodCount * 70 + missCount * 0
  return Math.round((weightedScore / (total * 100)) * 100)
}
