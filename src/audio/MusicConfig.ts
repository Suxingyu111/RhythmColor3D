/**
 * 音乐配置系统 — 10 个关卡的程序化合成音乐定义
 * BPM 从物理系统推导：每次弹跳 = 2 拍，BPM = 96 × k
 */

// ============================================================
// 接口定义
// ============================================================

/** 振荡器音色 + ADSR 包络 */
export interface ToneConfig {
  type: OscillatorType
  gain: number
  attack: number
  decay: number
  sustain: number
  release: number
  detune?: number
  filterFreq?: number
  filterQ?: number
}

/** 鼓组单个声部的节拍模式（16 步序列器，每步 = 十六分音符） */
export interface DrumPattern {
  steps: boolean[]
  tone: ToneConfig
  pitchStart?: number
  pitchEnd?: number
  duration: number
}

/** 低音声部配置 */
export interface BassConfig {
  tone: ToneConfig
  pattern: (number | null)[]
  stepDiv: number
  noteDuration: number
}

/** 旋律/琶音声部配置 */
export interface MelodyConfig {
  tone: ToneConfig
  pattern: (number | null)[]
  stepDiv: number
  noteDuration: number
}

/** Pad/Drone 持续音配置 */
export interface PadConfig {
  tone: ToneConfig
  chord: number[]
  progression?: number[][]
}

/** 完整的关卡音乐配置 */
export interface MusicConfig {
  id: string
  name: string
  bpm: number
  beatsPerMeasure: number
  scale: number[]
  root: number
  kick: DrumPattern
  snare: DrumPattern
  hihat: DrumPattern
  bass: BassConfig
  melody: MelodyConfig
  pad?: PadConfig
  drumGain: number
  bassGain: number
  melodyGain: number
  padGain: number
}

// ============================================================
// 工具函数
// ============================================================

/** MIDI 音符号 → 频率 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** 从根音和音程模式生成音阶 */
function buildScale(root: number, intervals: number[]): number[] {
  return intervals.map(i => root + i)
}

// 常用音程模式
const MINOR_PENTA = [0, 3, 5, 7, 10]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10]
const LYDIAN = [0, 2, 4, 6, 7, 9, 11]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]
const MAJOR_PENTA = [0, 2, 4, 7, 9]
const WHOLE_TONE = [0, 2, 4, 6, 8, 10]
const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

// ============================================================
// 10 个关卡音乐配置
// ============================================================

/** Level 1: 月球漫步 — 宁静梦幻 (EASY, 96 BPM, A 小调五声) */
const LEVEL_1_MUSIC: MusicConfig = {
  id: 'level_1_moon', name: '月球漫步', bpm: 96, beatsPerMeasure: 4,
  root: 57, scale: buildScale(57, MINOR_PENTA),
  kick: {
    steps: [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false],
    tone: { type: 'sine', gain: 0.35, attack: 0.005, decay: 0.08, sustain: 0, release: 0.02 },
    pitchStart: 120, pitchEnd: 40, duration: 0.1,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
    tone: { type: 'triangle', gain: 0.12, attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 },
    pitchStart: 300, pitchEnd: 200, duration: 0.08,
  },
  hihat: {
    steps: [true,false,true,false, true,false,true,false, true,false,true,false, true,false,true,false],
    tone: { type: 'square', gain: 0.04, attack: 0.001, decay: 0.02, sustain: 0, release: 0.01, filterFreq: 8000 },
    pitchStart: 6000, pitchEnd: 6000, duration: 0.03,
  },
  bass: {
    tone: { type: 'sine', gain: 0.3, attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.1 },
    pattern: [45, null, 45, null, 48, null, 45, null],
    stepDiv: 2, noteDuration: 0.4,
  },
  melody: {
    tone: { type: 'sine', gain: 0.15, attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.3, detune: 5 },
    pattern: [69, 72, 76, 67, 74, 72, 69, null],
    stepDiv: 2, noteDuration: 0.5,
  },
  pad: {
    tone: { type: 'sine', gain: 0.08, attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0, detune: 3 },
    chord: [57, 60, 64],
    progression: [[57,60,64], [55,60,64], [53,57,60], [55,59,62]],
  },
  drumGain: 0.7, bassGain: 0.5, melodyGain: 0.6, padGain: 0.4,
}

/** Level 2: 火星风暴 — 沙漠温暖 (EASY, 96 BPM, D Dorian) */
const LEVEL_2_MUSIC: MusicConfig = {
  id: 'level_2_mars', name: '火星风暴', bpm: 96, beatsPerMeasure: 4,
  root: 50, scale: buildScale(50, DORIAN),
  kick: {
    steps: [true,false,false,true, false,false,true,false, true,false,false,false, true,false,false,true],
    tone: { type: 'sine', gain: 0.4, attack: 0.003, decay: 0.1, sustain: 0, release: 0.02 },
    pitchStart: 140, pitchEnd: 35, duration: 0.12,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
    tone: { type: 'sawtooth', gain: 0.15, attack: 0.001, decay: 0.04, sustain: 0, release: 0.03, filterFreq: 3000 },
    pitchStart: 400, pitchEnd: 250, duration: 0.06,
  },
  hihat: {
    steps: [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
    tone: { type: 'square', gain: 0.03, attack: 0.001, decay: 0.015, sustain: 0, release: 0.01, filterFreq: 9000 },
    pitchStart: 7000, pitchEnd: 7000, duration: 0.02,
  },
  bass: {
    tone: { type: 'sawtooth', gain: 0.22, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.08, filterFreq: 400 },
    pattern: [38, null, 38, 40, null, 43, 40, null, 38, null, 45, null, 43, null, 40, null],
    stepDiv: 4, noteDuration: 0.15,
  },
  melody: {
    tone: { type: 'triangle', gain: 0.14, attack: 0.03, decay: 0.15, sustain: 0.4, release: 0.2 },
    pattern: [62, 64, 65, 67, null, 69, 67, 65, 62, null, 60, 62, null, 64, 62, null],
    stepDiv: 4, noteDuration: 0.2,
  },
  drumGain: 0.75, bassGain: 0.55, melodyGain: 0.55, padGain: 0.3,
}

/** Level 3: 金星熔炉 — 炽热紧张 (NORMAL, 115.2 BPM, E Phrygian) */
const LEVEL_3_MUSIC: MusicConfig = {
  id: 'level_3_venus', name: '金星熔炉', bpm: 115.2, beatsPerMeasure: 4,
  root: 52, scale: buildScale(52, PHRYGIAN),
  kick: {
    steps: [true,false,false,false, true,false,false,true, true,false,false,false, true,false,false,false],
    tone: { type: 'sine', gain: 0.45, attack: 0.003, decay: 0.1, sustain: 0, release: 0.02 },
    pitchStart: 160, pitchEnd: 38, duration: 0.12,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,true, false,false,false,false, true,false,true,false],
    tone: { type: 'sawtooth', gain: 0.18, attack: 0.001, decay: 0.05, sustain: 0, release: 0.03, filterFreq: 4000 },
    pitchStart: 450, pitchEnd: 200, duration: 0.07,
  },
  hihat: {
    steps: [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
    tone: { type: 'square', gain: 0.05, attack: 0.001, decay: 0.02, sustain: 0, release: 0.01, filterFreq: 10000 },
    pitchStart: 8000, pitchEnd: 8000, duration: 0.025,
  },
  bass: {
    tone: { type: 'sawtooth', gain: 0.28, attack: 0.005, decay: 0.08, sustain: 0.5, release: 0.06, filterFreq: 500 },
    pattern: [40, null, 40, 41, null, 40, 39, null, 40, null, 43, null, 41, null, 40, null],
    stepDiv: 4, noteDuration: 0.12,
  },
  melody: {
    tone: { type: 'square', gain: 0.1, attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.15, filterFreq: 2500, filterQ: 2 },
    pattern: [64, 65, 64, null, 67, 68, 67, 65, 64, null, 63, 64, null, 60, 63, null],
    stepDiv: 4, noteDuration: 0.15,
  },
  pad: {
    tone: { type: 'sawtooth', gain: 0.05, attack: 0.8, decay: 0.5, sustain: 0.5, release: 1.5, filterFreq: 800, filterQ: 1 },
    chord: [52, 53, 59],
  },
  drumGain: 0.8, bassGain: 0.6, melodyGain: 0.5, padGain: 0.35,
}

/** Level 4: 木星漩涡 — 壮丽旋转 (NORMAL, 115.2 BPM, G Mixolydian) */
const LEVEL_4_MUSIC: MusicConfig = {
  id: 'level_4_jupiter', name: '木星漩涡', bpm: 115.2, beatsPerMeasure: 4,
  root: 55, scale: buildScale(55, MIXOLYDIAN),
  kick: {
    steps: [true,false,false,false, true,false,false,false, true,false,false,true, true,false,false,false],
    tone: { type: 'sine', gain: 0.42, attack: 0.003, decay: 0.1, sustain: 0, release: 0.02 },
    pitchStart: 150, pitchEnd: 36, duration: 0.12,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
    tone: { type: 'triangle', gain: 0.2, attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 },
    pitchStart: 350, pitchEnd: 180, duration: 0.08,
  },
  hihat: {
    steps: [true,false,true,false, true,false,true,true, true,false,true,false, true,false,true,true],
    tone: { type: 'square', gain: 0.04, attack: 0.001, decay: 0.02, sustain: 0, release: 0.01, filterFreq: 9000 },
    pitchStart: 7500, pitchEnd: 7500, duration: 0.025,
  },
  bass: {
    tone: { type: 'triangle', gain: 0.3, attack: 0.01, decay: 0.12, sustain: 0.5, release: 0.1 },
    pattern: [43, null, 43, 45, 47, null, 45, null, 43, null, 41, null, 40, null, 43, null],
    stepDiv: 4, noteDuration: 0.18,
  },
  melody: {
    tone: { type: 'sine', gain: 0.15, attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.25, detune: 7 },
    pattern: [67, 71, 74, 77, 79, 77, 74, 71, 67, 65, 62, 65, 67, null, null, null],
    stepDiv: 4, noteDuration: 0.2,
  },
  pad: {
    tone: { type: 'sine', gain: 0.07, attack: 0.6, decay: 0.4, sustain: 0.6, release: 1.0, detune: 4 },
    chord: [55, 59, 62, 65],
    progression: [[55,59,62,65], [53,57,60], [55,59,62], [50,53,57]],
  },
  drumGain: 0.75, bassGain: 0.55, melodyGain: 0.6, padGain: 0.4,
}

/** Level 5: 土星光环 — 空灵水晶 (NORMAL, 115.2 BPM, C Lydian) */
const LEVEL_5_MUSIC: MusicConfig = {
  id: 'level_5_saturn', name: '土星光环', bpm: 115.2, beatsPerMeasure: 4,
  root: 60, scale: buildScale(60, LYDIAN),
  kick: {
    steps: [true,false,false,false, false,false,false,false, true,false,false,false, false,false,false,false],
    tone: { type: 'sine', gain: 0.3, attack: 0.005, decay: 0.12, sustain: 0, release: 0.03 },
    pitchStart: 100, pitchEnd: 40, duration: 0.15,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,true],
    tone: { type: 'triangle', gain: 0.1, attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    pitchStart: 500, pitchEnd: 400, duration: 0.04,
  },
  hihat: {
    steps: [true,false,true,true, true,false,true,false, true,true,true,false, true,false,true,true],
    tone: { type: 'sine', gain: 0.06, attack: 0.001, decay: 0.03, sustain: 0, release: 0.02, filterFreq: 12000 },
    pitchStart: 10000, pitchEnd: 10000, duration: 0.03,
  },
  bass: {
    tone: { type: 'sine', gain: 0.2, attack: 0.03, decay: 0.2, sustain: 0.4, release: 0.15 },
    pattern: [48, null, null, null, 50, null, null, null, 48, null, 52, null, 50, null, null, null],
    stepDiv: 4, noteDuration: 0.35,
  },
  melody: {
    tone: { type: 'sine', gain: 0.12, attack: 0.08, decay: 0.3, sustain: 0.2, release: 0.5, detune: 8 },
    pattern: [72, 76, 79, 83, null, 84, 83, 79, 76, null, 74, 72, null, null, 71, 72],
    stepDiv: 4, noteDuration: 0.35,
  },
  pad: {
    tone: { type: 'sine', gain: 0.1, attack: 1.0, decay: 0.5, sustain: 0.8, release: 2.0, detune: 5 },
    chord: [60, 64, 66, 71],
  },
  drumGain: 0.6, bassGain: 0.45, melodyGain: 0.65, padGain: 0.5,
}

/** Level 6: 天王星冰原 — 冰冷驱动 (HARD, 144 BPM, E 自然小调) */
const LEVEL_6_MUSIC: MusicConfig = {
  id: 'level_6_uranus', name: '天王星冰原', bpm: 144, beatsPerMeasure: 4,
  root: 52, scale: buildScale(52, NATURAL_MINOR),
  kick: {
    steps: [true,false,false,false, true,false,false,false, true,false,true,false, true,false,false,false],
    tone: { type: 'sine', gain: 0.5, attack: 0.002, decay: 0.08, sustain: 0, release: 0.02 },
    pitchStart: 180, pitchEnd: 35, duration: 0.1,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
    tone: { type: 'sawtooth', gain: 0.22, attack: 0.001, decay: 0.05, sustain: 0, release: 0.03, filterFreq: 5000 },
    pitchStart: 500, pitchEnd: 200, duration: 0.06,
  },
  hihat: {
    steps: [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
    tone: { type: 'square', gain: 0.06, attack: 0.001, decay: 0.015, sustain: 0, release: 0.01, filterFreq: 11000 },
    pitchStart: 9000, pitchEnd: 9000, duration: 0.02,
  },
  bass: {
    tone: { type: 'sawtooth', gain: 0.3, attack: 0.005, decay: 0.06, sustain: 0.5, release: 0.05, filterFreq: 600, filterQ: 2 },
    pattern: [40, 40, null, 40, null, 40, 40, null, 42, null, 40, null, 39, null, 40, null],
    stepDiv: 4, noteDuration: 0.1,
  },
  melody: {
    tone: { type: 'square', gain: 0.08, attack: 0.005, decay: 0.08, sustain: 0.3, release: 0.1, filterFreq: 3000, filterQ: 3 },
    pattern: [64, null, 67, 64, null, 63, 64, null, 67, null, 71, 67, null, 64, 63, null],
    stepDiv: 4, noteDuration: 0.12,
  },
  drumGain: 0.85, bassGain: 0.65, melodyGain: 0.5, padGain: 0.25,
}

/** Level 7: 海王星深渊 — 深邃黑暗 (HARD, 144 BPM, C# 和声小调) */
const LEVEL_7_MUSIC: MusicConfig = {
  id: 'level_7_neptune', name: '海王星深渊', bpm: 144, beatsPerMeasure: 4,
  root: 49, scale: buildScale(49, HARMONIC_MINOR),
  kick: {
    steps: [true,false,false,true, false,false,true,false, true,false,false,true, false,false,true,false],
    tone: { type: 'sine', gain: 0.48, attack: 0.002, decay: 0.09, sustain: 0, release: 0.02 },
    pitchStart: 170, pitchEnd: 32, duration: 0.11,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,true,false, true,false,false,false],
    tone: { type: 'sawtooth', gain: 0.2, attack: 0.001, decay: 0.04, sustain: 0, release: 0.03, filterFreq: 4500 },
    pitchStart: 480, pitchEnd: 180, duration: 0.06,
  },
  hihat: {
    steps: [true,false,true,true, true,false,true,false, true,false,true,true, true,false,true,false],
    tone: { type: 'square', gain: 0.05, attack: 0.001, decay: 0.02, sustain: 0, release: 0.01, filterFreq: 10000 },
    pitchStart: 8500, pitchEnd: 8500, duration: 0.02,
  },
  bass: {
    tone: { type: 'sawtooth', gain: 0.32, attack: 0.003, decay: 0.07, sustain: 0.5, release: 0.05, filterFreq: 450, filterQ: 3 },
    pattern: [37, null, 37, null, 40, null, 37, 36, null, 37, null, 40, null, 44, null, 37],
    stepDiv: 4, noteDuration: 0.1,
  },
  melody: {
    tone: { type: 'sawtooth', gain: 0.07, attack: 0.01, decay: 0.1, sustain: 0.25, release: 0.12, filterFreq: 2000, filterQ: 2 },
    pattern: [61, 60, 61, null, 64, null, 68, 64, 61, null, 60, 56, null, 61, null, null],
    stepDiv: 4, noteDuration: 0.12,
  },
  pad: {
    tone: { type: 'sawtooth', gain: 0.04, attack: 1.0, decay: 0.5, sustain: 0.5, release: 1.5, filterFreq: 600, filterQ: 1 },
    chord: [49, 52, 56, 60],
  },
  drumGain: 0.85, bassGain: 0.7, melodyGain: 0.45, padGain: 0.3,
}

/** Level 8: 天狼星闪耀 — 明亮能量 (HARD, 144 BPM, A 大调五声) */
const LEVEL_8_MUSIC: MusicConfig = {
  id: 'level_8_sirius', name: '天狼星闪耀', bpm: 144, beatsPerMeasure: 4,
  root: 57, scale: buildScale(57, MAJOR_PENTA),
  kick: {
    steps: [true,false,false,false, true,false,true,false, true,false,false,false, true,false,true,false],
    tone: { type: 'sine', gain: 0.45, attack: 0.002, decay: 0.08, sustain: 0, release: 0.02 },
    pitchStart: 160, pitchEnd: 38, duration: 0.1,
  },
  snare: {
    steps: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,true],
    tone: { type: 'triangle', gain: 0.22, attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    pitchStart: 420, pitchEnd: 220, duration: 0.07,
  },
  hihat: {
    steps: [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
    tone: { type: 'square', gain: 0.05, attack: 0.001, decay: 0.015, sustain: 0, release: 0.01, filterFreq: 11000 },
    pitchStart: 9500, pitchEnd: 9500, duration: 0.02,
  },
  bass: {
    tone: { type: 'triangle', gain: 0.28, attack: 0.008, decay: 0.08, sustain: 0.5, release: 0.06 },
    pattern: [45, null, 45, 47, null, 50, 47, null, 45, null, 52, null, 50, null, 47, null],
    stepDiv: 4, noteDuration: 0.14,
  },
  melody: {
    tone: { type: 'sine', gain: 0.14, attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.15, detune: 6 },
    pattern: [69, 71, 74, 76, 78, 76, 74, 71, 69, null, 74, 78, 81, null, 78, 74],
    stepDiv: 4, noteDuration: 0.15,
  },
  pad: {
    tone: { type: 'sine', gain: 0.08, attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0, detune: 4 },
    chord: [57, 61, 64],
    progression: [[57,61,64], [59,62,66], [57,61,64], [54,57,61]],
  },
  drumGain: 0.8, bassGain: 0.6, melodyGain: 0.65, padGain: 0.35,
}

/** Level 9: 参宿四脉动 — 脉动不安 (EXTREME, 172.8 BPM, Bb 全音阶) */
const LEVEL_9_MUSIC: MusicConfig = {
  id: 'level_9_betelgeuse', name: '参宿四脉动', bpm: 172.8, beatsPerMeasure: 4,
  root: 58, scale: buildScale(58, WHOLE_TONE),
  kick: {
    steps: [true,false,true,false, true,false,true,false, true,false,true,false, true,false,true,true],
    tone: { type: 'sine', gain: 0.55, attack: 0.002, decay: 0.07, sustain: 0, release: 0.02 },
    pitchStart: 200, pitchEnd: 30, duration: 0.09,
  },
  snare: {
    steps: [false,false,false,true, true,false,false,true, false,false,true,false, true,false,false,true],
    tone: { type: 'sawtooth', gain: 0.25, attack: 0.001, decay: 0.04, sustain: 0, release: 0.02, filterFreq: 6000 },
    pitchStart: 550, pitchEnd: 180, duration: 0.05,
  },
  hihat: {
    steps: [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
    tone: { type: 'square', gain: 0.07, attack: 0.001, decay: 0.012, sustain: 0, release: 0.008, filterFreq: 12000 },
    pitchStart: 10000, pitchEnd: 10000, duration: 0.015,
  },
  bass: {
    tone: { type: 'sawtooth', gain: 0.35, attack: 0.003, decay: 0.05, sustain: 0.5, release: 0.04, filterFreq: 700, filterQ: 3 },
    pattern: [46, null, 46, 48, null, 50, 52, null, 46, null, 54, null, 52, 50, 48, null],
    stepDiv: 4, noteDuration: 0.08,
  },
  melody: {
    tone: { type: 'sawtooth', gain: 0.09, attack: 0.005, decay: 0.06, sustain: 0.3, release: 0.08, filterFreq: 3500, filterQ: 2 },
    pattern: [70, 72, 74, null, 76, 78, null, 76, 74, 72, 70, null, 68, 70, null, 72],
    stepDiv: 4, noteDuration: 0.1,
  },
  drumGain: 0.9, bassGain: 0.7, melodyGain: 0.5, padGain: 0.2,
}

/** Level 10: 黑洞边界 — 混沌引力 (EXTREME, 172.8 BPM, E 半音阶) */
const LEVEL_10_MUSIC: MusicConfig = {
  id: 'level_10_blackhole', name: '黑洞边界', bpm: 172.8, beatsPerMeasure: 4,
  root: 52, scale: buildScale(52, CHROMATIC),
  kick: {
    steps: [true,false,true,true, true,false,true,false, true,true,false,true, true,false,true,true],
    tone: { type: 'sine', gain: 0.55, attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    pitchStart: 220, pitchEnd: 28, duration: 0.08,
  },
  snare: {
    steps: [false,true,false,false, true,false,true,false, false,false,true,false, true,true,false,true],
    tone: { type: 'sawtooth', gain: 0.28, attack: 0.001, decay: 0.035, sustain: 0, release: 0.02, filterFreq: 7000 },
    pitchStart: 600, pitchEnd: 150, duration: 0.045,
  },
  hihat: {
    steps: [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
    tone: { type: 'square', gain: 0.08, attack: 0.001, decay: 0.01, sustain: 0, release: 0.006, filterFreq: 13000 },
    pitchStart: 11000, pitchEnd: 11000, duration: 0.012,
  },
  bass: {
    tone: { type: 'sawtooth', gain: 0.38, attack: 0.002, decay: 0.04, sustain: 0.5, release: 0.03, filterFreq: 800, filterQ: 4 },
    pattern: [40, 41, null, 40, 39, null, 40, 43, null, 42, 41, 40, null, 39, 40, null],
    stepDiv: 4, noteDuration: 0.07,
  },
  melody: {
    tone: { type: 'square', gain: 0.07, attack: 0.003, decay: 0.05, sustain: 0.25, release: 0.06, filterFreq: 4000, filterQ: 4 },
    pattern: [64, 65, 63, 66, null, 62, 67, null, 64, 63, 65, null, 68, 64, null, 63],
    stepDiv: 4, noteDuration: 0.08,
  },
  pad: {
    tone: { type: 'sawtooth', gain: 0.04, attack: 0.8, decay: 0.4, sustain: 0.4, release: 1.0, filterFreq: 500, filterQ: 2 },
    chord: [52, 53, 58, 63],
  },
  drumGain: 0.95, bassGain: 0.75, melodyGain: 0.45, padGain: 0.25,
}

// ============================================================
// 配置查询
// ============================================================

const ALL_MUSIC_CONFIGS: MusicConfig[] = [
  LEVEL_1_MUSIC, LEVEL_2_MUSIC, LEVEL_3_MUSIC, LEVEL_4_MUSIC, LEVEL_5_MUSIC,
  LEVEL_6_MUSIC, LEVEL_7_MUSIC, LEVEL_8_MUSIC, LEVEL_9_MUSIC, LEVEL_10_MUSIC,
]

/** 根据关卡 ID 获取音乐配置，未找到则返回第一关 */
export function getMusicConfig(levelId: string): MusicConfig {
  return ALL_MUSIC_CONFIGS.find(c => c.id === levelId) || LEVEL_1_MUSIC
}
