/**
 * 音频管理系统 — 节奏同步版本
 * 用 AudioContext.currentTime 前瞻调度替代 setInterval
 * BPM 从物理系统推导，确保弹跳与节拍精确对齐
 */

import { MusicConfig, ToneConfig, midiToFreq } from "@audio/MusicConfig";

/**
 * 节拍信息 — 供视觉层读取，实现音画同步
 */
export interface BeatInfo {
  /** 0-15，当前十六分音符步 */
  step: number;
  /** 0.0-1.0，当前步内进度 */
  stepProgress: number;
  /** 四分音符拍点（步 0,4,8,12） */
  isDownbeat: boolean;
  /** 半音符强拍（步 0,8） */
  isStrongBeat: boolean;
  /** 当前 BPM（含 Boost） */
  bpm: number;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // BGM 调度状态
  private bgmPlaying: boolean = false;
  private currentConfig: MusicConfig | null = null;
  private currentStep: number = 0; // 当前十六分音符步（0-15 循环）
  private nextStepTime: number = 0; // 下一步的 AudioContext 时间
  private sixteenthDuration: number = 0; // 一个十六分音符的时长（秒）
  private schedulerTimer: number | null = null;
  private scheduleAhead: number = 0.2; // 前瞻调度窗口（秒）
  private schedulerInterval: number = 25; // 调度器检查间隔（毫秒）

  // Bass/Melody 步进追踪（独立于鼓组的 16 步）
  private bassStep: number = 0;
  private melodyStep: number = 0;

  // Pad 持续音节点
  private padOscillators: OscillatorNode[] = [];
  private padGains: GainNode[] = [];
  private padMeasure: number = 0; // 当前小节（用于和弦进行）

  // BPM 管理（支持 Boost 变速）
  private baseBPM: number = 96;
  private currentBPM: number = 96;
  private boostActive: boolean = false;

  // 静音状态
  private muted: boolean = false;

  constructor() {
    this.initContext();
  }

  /**
   * 初始化 AudioContext 和增益链
   */
  private initContext(): void {
    try {
      const audioWindow = window as Window &
        typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        };
      const AC = audioWindow.AudioContext || audioWindow.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      // 主增益
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);

      // 音乐增益
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.2;
      this.musicGain.connect(this.masterGain);

      // 音效增益
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn("AudioManager: 无法初始化 AudioContext", e);
    }
  }

  /**
   * 恢复 AudioContext（需要在用户交互后调用）
   */
  resumeContext(): void {
    if (!this.ctx || this.ctx.state === "closed") {
      this.initContext();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // ==================== BGM 节奏引擎 ====================

  /**
   * 播放背景音乐 — 基于 MusicConfig 的前瞻调度
   * @param config 关卡音乐配置
   */
  playBGM(config?: MusicConfig): void {
    if (!this.ctx || !this.musicGain || this.bgmPlaying) return;
    if (!config) return;

    this.bgmPlaying = true;
    this.currentConfig = config;
    this.baseBPM = config.bpm;
    this.currentBPM = config.bpm;
    this.currentStep = 0;
    this.bassStep = 0;
    this.melodyStep = 0;
    this.padMeasure = 0;

    // 计算十六分音符时长：一拍 = 4 个十六分音符
    this.sixteenthDuration = 60 / this.currentBPM / 4;

    // 从当前时间开始调度
    this.nextStepTime = this.ctx.currentTime + 0.05;

    // 启动 Pad 持续音
    this.startPad(config);

    // 启动调度器
    this.schedulerTimer = window.setInterval(() => {
      this.scheduleBeat();
    }, this.schedulerInterval);
  }

  /**
   * 核心调度器 — 前瞻调度所有声部
   */
  private scheduleBeat(): void {
    if (!this.ctx || !this.currentConfig || !this.musicGain) return;

    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      const time = this.nextStepTime;
      const config = this.currentConfig;
      const step16 = this.currentStep % 16;

      // 鼓组调度（16 步序列器）
      this.scheduleDrum(config.kick, time, config.drumGain, "kick");
      this.scheduleDrum(config.snare, time, config.drumGain, "snare");
      this.scheduleDrum(config.hihat, time, config.drumGain, "hihat");

      // Bass 调度
      this.scheduleBass(config, time);

      // Melody 调度
      this.scheduleMelody(config, time);

      // 每 16 步（一小节）更新 Pad 和弦
      if (step16 === 0 && this.currentStep > 0) {
        this.padMeasure++;
        this.updatePadChord(config);
      }

      // 推进步进
      this.nextStepTime += this.sixteenthDuration;
      this.currentStep++;
    }
  }

  /**
   * 调度单个鼓声部
   */
  private scheduleDrum(
    drum: MusicConfig["kick"],
    time: number,
    drumGain: number,
    _type: string,
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const step = this.currentStep % drum.steps.length;
    if (!drum.steps[step]) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = drum.tone.type;
    const startFreq = drum.pitchStart || 200;
    const endFreq = drum.pitchEnd || startFreq;

    osc.frequency.setValueAtTime(startFreq, time);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(endFreq, 1),
        time + drum.duration * 0.8,
      );
    }

    // ADSR 包络
    const peak = drum.tone.gain * drumGain;
    this.applyEnvelope(gain, time, peak, drum.tone, drum.duration);

    // 可选滤波器
    const lastNode = this.applyFilter(osc, drum.tone);
    lastNode.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + drum.duration + drum.tone.release + 0.01);
  }

  /**
   * 调度 Bass 声部
   */
  private scheduleBass(config: MusicConfig, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const bass = config.bass;

    // Bass 步进分辨率：stepDiv=4 表示每个十六分音符一步，stepDiv=2 表示每个八分音符一步
    const stepsPerSixteenth = 4 / bass.stepDiv;
    if (this.currentStep % stepsPerSixteenth !== 0) return;

    const noteIdx = this.bassStep % bass.pattern.length;
    const midi = bass.pattern[noteIdx];
    this.bassStep++;

    if (midi === null) return;

    const freq = midiToFreq(midi);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = bass.tone.type;
    osc.frequency.setValueAtTime(freq, time);
    if (bass.tone.detune) osc.detune.setValueAtTime(bass.tone.detune, time);

    const peak = bass.tone.gain * config.bassGain;
    this.applyEnvelope(gain, time, peak, bass.tone, bass.noteDuration);

    const lastNode = this.applyFilter(osc, bass.tone);
    lastNode.connect(gain);
    gain.connect(this.musicGain);

    const totalDuration = bass.noteDuration + bass.tone.release + 0.01;
    osc.start(time);
    osc.stop(time + totalDuration);
  }

  /**
   * 调度 Melody 声部
   */
  private scheduleMelody(config: MusicConfig, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const melody = config.melody;

    const stepsPerSixteenth = 4 / melody.stepDiv;
    if (this.currentStep % stepsPerSixteenth !== 0) return;

    const noteIdx = this.melodyStep % melody.pattern.length;
    const midi = melody.pattern[noteIdx];
    this.melodyStep++;

    if (midi === null) return;

    const freq = midiToFreq(midi);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = melody.tone.type;
    osc.frequency.setValueAtTime(freq, time);
    if (melody.tone.detune) osc.detune.setValueAtTime(melody.tone.detune, time);

    const peak = melody.tone.gain * config.melodyGain;
    this.applyEnvelope(gain, time, peak, melody.tone, melody.noteDuration);

    const lastNode = this.applyFilter(osc, melody.tone);
    lastNode.connect(gain);
    gain.connect(this.musicGain);

    const totalDuration = melody.noteDuration + melody.tone.release + 0.01;
    osc.start(time);
    osc.stop(time + totalDuration);
  }

  // ==================== Pad 持续音 ====================

  /**
   * 启动 Pad 持续和弦
   */
  private startPad(config: MusicConfig): void {
    if (!this.ctx || !this.musicGain || !config.pad) return;
    this.stopPad();

    const pad = config.pad;
    const chord = pad.chord;
    const now = this.ctx.currentTime;

    for (const midi of chord) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = pad.tone.type;
      osc.frequency.setValueAtTime(midiToFreq(midi), now);
      if (pad.tone.detune) osc.detune.setValueAtTime(pad.tone.detune, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(
        pad.tone.gain * config.padGain,
        now + pad.tone.attack,
      );

      const lastNode = this.applyFilter(osc, pad.tone);
      lastNode.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      this.padOscillators.push(osc);
      this.padGains.push(gain);
    }
  }

  /**
   * 更新 Pad 和弦（按小节切换和弦进行）
   */
  private updatePadChord(config: MusicConfig): void {
    if (!this.ctx || !config.pad?.progression) return;
    const progression = config.pad.progression;
    if (progression.length === 0) return;

    const chordIdx = this.padMeasure % progression.length;
    const chord = progression[chordIdx];
    const now = this.ctx.currentTime;

    // 更新每个振荡器的频率
    for (let i = 0; i < this.padOscillators.length && i < chord.length; i++) {
      this.padOscillators[i].frequency.setTargetAtTime(
        midiToFreq(chord[i]),
        now,
        0.1,
      );
    }
  }

  /**
   * 停止 Pad 持续音
   */
  private stopPad(): void {
    for (const osc of this.padOscillators) {
      try {
        osc.stop();
      } catch (_) {}
    }
    this.padOscillators = [];
    this.padGains = [];
  }

  // ==================== ADSR + 滤波器 ====================

  /**
   * 应用 ADSR 包络到 GainNode
   */
  private applyEnvelope(
    gainNode: GainNode,
    startTime: number,
    peak: number,
    tone: ToneConfig,
    noteDuration: number,
  ): void {
    const g = gainNode.gain;
    const a = tone.attack;
    const d = tone.decay;
    const s = tone.sustain;
    const r = tone.release;

    g.setValueAtTime(0, startTime);
    g.linearRampToValueAtTime(peak, startTime + a);
    g.linearRampToValueAtTime(peak * s, startTime + a + d);
    // 持续到音符结束，然后释放
    g.setValueAtTime(peak * s, startTime + noteDuration);
    g.linearRampToValueAtTime(0, startTime + noteDuration + r);
  }

  /**
   * 可选低通滤波器 — 如果 ToneConfig 指定了 filterFreq 则插入
   * @returns 最终输出节点（滤波器或原始振荡器）
   */
  private applyFilter(osc: OscillatorNode, tone: ToneConfig): AudioNode {
    if (!this.ctx || !tone.filterFreq) return osc;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = tone.filterFreq;
    filter.Q.value = tone.filterQ || 1;
    osc.connect(filter);
    return filter;
  }

  // ==================== Boost 变速 ====================

  /**
   * 激活 Boost 变速 — BPM 乘以倍率
   */
  activateBoostBPM(multiplier: number): void {
    if (this.boostActive) return;
    this.boostActive = true;
    this.currentBPM = this.baseBPM * multiplier;
    this.sixteenthDuration = 60 / this.currentBPM / 4;
  }

  /**
   * 取消 Boost 变速 — 恢复原始 BPM
   */
  deactivateBoostBPM(): void {
    if (!this.boostActive) return;
    this.boostActive = false;
    this.currentBPM = this.baseBPM;
    this.sixteenthDuration = 60 / this.currentBPM / 4;
  }

  // ==================== BGM 控制 ====================

  /**
   * 停止背景音乐
   */
  stopBGM(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.stopPad();
    this.bgmPlaying = false;
    this.currentConfig = null;
    this.boostActive = false;
  }

  /**
   * 暂停 BGM（降音量到 0，停止调度器）
   */
  pauseBGM(): void {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * 恢复 BGM 音量和调度器
   */
  resumeBGM(): void {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.1);
    }
    // 重新启动调度器，从当前时间继续
    if (this.bgmPlaying && this.ctx && this.schedulerTimer === null) {
      this.nextStepTime = this.ctx.currentTime + 0.05;
      this.schedulerTimer = window.setInterval(() => {
        this.scheduleBeat();
      }, this.schedulerInterval);
    }
  }

  // ==================== 音效 ====================

  /**
   * 弹跳音效
   */
  playBounceSound(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 命中音效
   */
  playHitSound(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1600, now);
    osc2.frequency.exponentialRampToValueAtTime(2000, now + 0.04);
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.08);
  }

  /**
   * 加速音效
   */
  playBoostSound(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(200, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(800, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.25);
    gain2.gain.setValueAtTime(0.1, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.25);
  }

  /**
   * 失败音效
   */
  playFailSound(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.linearRampToValueAtTime(0, now + 0.5);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.5);
  }

  // ==================== 音量控制 ====================

  setMusicVolume(v: number): void {
    if (this.musicGain) {
      this.musicGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  setSfxVolume(v: number): void {
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.8;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ==================== 节拍信息（供视觉层读取） ====================

  /**
   * 获取当前节拍信息 — 每帧调用一次，供 Renderer3D 实现音画同步
   */
  getBeatInfo(): BeatInfo | null {
    if (!this.ctx || !this.bgmPlaying || this.sixteenthDuration <= 0)
      return null;

    const now = this.ctx.currentTime;
    // 计算当前步内的进度（0.0 = 刚开始，1.0 = 即将进入下一步）
    const elapsed = now - (this.nextStepTime - this.sixteenthDuration);
    const stepProgress = Math.max(
      0,
      Math.min(1, elapsed / this.sixteenthDuration),
    );
    const step = this.currentStep % 16;

    return {
      step,
      stepProgress,
      isDownbeat: step % 4 === 0,
      isStrongBeat: step % 8 === 0,
      bpm: this.currentBPM,
    };
  }

  // ==================== 生命周期 ====================

  destroy(): void {
    this.stopBGM();
  }
}

export default AudioManager;
