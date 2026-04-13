/**
 * 球形跳跃游戏 - 主程序入口
 */

import GameCore from "@game/GameCore";
import UIManager from "@ui/UIManager";
import TrackManager from "@managers/TrackManager";
import {
  BlockHitEvent,
  BoostEvent,
  GameResult,
  GameState,
  GameUpdateEvent,
  ReviveOfferEvent,
} from "@game/types";

interface AppSettings {
  volume: number;
}

export class GameApp {
  private gameCore: GameCore;
  private uiManager: UIManager;
  private trackManager: TrackManager;
  private failKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private gameKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private adCountdownTimer: number | null = null;
  private comboCount: number = 0;
  private currentLevelId: string = "";
  private settings: AppSettings;

  // localStorage 存储键
  private readonly UNLOCK_KEY = "rhythmColor3D_unlockedLevels";
  private readonly SETTINGS_KEY = "rhythmColor3D_settings";

  constructor() {
    this.gameCore = new GameCore();
    this.uiManager = new UIManager("app");
    this.trackManager = new TrackManager();
    this.settings = this.loadSettings();

    this.applySettings();
    this.setupEventListeners();
    this.init();
  }

  /**
   * 初始化应用
   */
  private init(): void {
    this.clearAdCountdown();
    this.hideReviveScreen();
    this.hidePauseLevelSelect();
    this.hidePauseOverlay();
    this.removeFailKeyListener();

    // 清空UI
    this.uiManager.clear();

    // 创建主菜单
    this.uiManager.createMainMenu();

    // 注册菜单按钮事件
    this.uiManager.onButtonClick("btn-start", () => this.startGame());
    this.uiManager.onButtonClick("btn-levels", () => this.showLevelSelect());
    this.uiManager.onButtonClick("btn-settings", () => this.showSettings());

    console.log("GameApp: Initialized");
  }

  private returnToMenu(): void {
    this.removeGameKeyListener();
    this.gameCore.destroy();
    this.init();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 游戏事件
    this.gameCore.on("game-started", () => {
      console.log("GameApp: Game started");
    });

    this.gameCore.on("game-update", (data: GameUpdateEvent) => {
      this.uiManager.updateScore(data.score);
      this.uiManager.updateBlocksHit(data.blocksHit);
      this.uiManager.updateTime(data.time);
      this.uiManager.updateDistance(data.distance, data.targetDistance);
    });

    this.gameCore.on("block-hit", (data: BlockHitEvent) => {
      this.comboCount++;
      this.uiManager.showComboEffect(this.comboCount);
      console.log(
        `Block hit: ${data.points} points, combo: ${this.comboCount}`,
      );
    });

    this.gameCore.on("game-finished", (result: GameResult) => {
      this.uiManager.hideBoostIndicator();
      // 通关成功，解锁下一关
      if (this.currentLevelId) {
        this.unlockNextLevel(this.currentLevelId);
      }
      this.showResultScreen(result);
    });

    // 游戏失败事件监听
    this.gameCore.on("game-failed", (result: GameResult) => {
      this.comboCount = 0;
      this.uiManager.hideCombo();
      this.uiManager.hideBoostIndicator();
      this.showFailScreen(result);
    });

    // 复活选择事件监听
    this.gameCore.on("game-revive-offer", (data: ReviveOfferEvent) => {
      this.showReviveScreen(data);
    });

    // 复活成功事件监听
    this.gameCore.on("game-revived", () => {
      this.hideReviveScreen();
    });

    // 加速事件监听
    this.gameCore.on("boost-activated", (data: BoostEvent) => {
      this.uiManager.showBoostIndicator(data.duration);
    });

    this.gameCore.on("boost-deactivated", () => {
      this.uiManager.hideBoostIndicator();
    });

    this.gameCore.on("error", (error: Error) => {
      console.error("GameApp: Game error", error);
      alert("游戏出错：" + error.message);
    });
  }

  /**
   * 开始游戏
   */
  private async startGame(): Promise<void> {
    this.clearAdCountdown();
    this.hideReviveScreen();
    this.hidePauseLevelSelect();
    this.hidePauseOverlay();
    this.removeFailKeyListener();
    this.removeGameKeyListener();

    // 重置连击计数
    this.comboCount = 0;
    this.uiManager.hideCombo();

    // 清理旧的渲染器和 canvas（防止重试时 WebGL 上下文泄漏）
    this.gameCore.destroy();

    // 获取第一个关卡
    let level = this.trackManager.getCurrentLevel();
    if (!level) {
      const levels = this.trackManager.getAllLevels();
      if (levels.length > 0) {
        this.trackManager.loadLevel(levels[0].id);
        level = this.trackManager.getCurrentLevel();
      }
    }

    if (!level) {
      alert("没有可用的关卡");
      return;
    }

    // 记录当前关卡ID（用于通关解锁）
    this.currentLevelId = level.id;

    // 清空菜单
    this.uiManager.clear();

    // 创建游戏UI
    this.uiManager.createGameUI();

    // 初始化3D渲染
    const canvasContainer = this.uiManager.getCanvasContainer();
    if (!canvasContainer) {
      alert("无法创建Canvas容器");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvasContainer.appendChild(canvas);

    // 初始化游戏
    this.gameCore.initRenderer(canvas);
    this.gameCore.loadLevel(level);
    this.gameCore.startGame();

    // 注册暂停按钮
    this.uiManager.onButtonClick("btn-pause", () => {
      if (this.gameCore.getState() === GameState.PLAYING) {
        this.gameCore.pauseGame();
      }
    });

    // 先移除旧的键盘监听器（防止重试游戏时重复注册）
    if (this.gameKeyListener) {
      document.removeEventListener("keydown", this.gameKeyListener);
    }

    // 注册键盘事件改变车道 - 过滤长按重复，每次按下只移动一格
    // 注意：摄像机在 Z=-8 向 +Z 方向看，Three.js 右手坐标系下
    // 屏幕左 = 世界 X+（lane 增大），屏幕右 = 世界 X-（lane 减小）
    this.gameKeyListener = (e: KeyboardEvent) => {
      if (e.repeat) return; // 忽略长按重复事件，防止一下子移到最边上

      if (e.key === "Escape") {
        if (this.gameCore.getState() === GameState.PLAYING) {
          // 游戏中按 ESC：暂停并弹出暂停弹框
          this.gameCore.pauseGame();
          this.showPauseOverlay();
        } else if (this.gameCore.getState() === GameState.PAUSED) {
          // 暂停中按 ESC：退出游戏回菜单
          this.returnToMenu();
        }
        return;
      }

      if (e.key === " ") {
        if (this.gameCore.getState() === GameState.PAUSED) {
          // 暂停中按空格：继续游戏
          e.preventDefault();
          this.hidePauseOverlay();
          this.gameCore.resumeGame();
          return;
        }
      }

      // 游戏进行中的方向键控制
      if (this.gameCore.getState() === GameState.PLAYING) {
        if (e.key === "ArrowLeft") this.gameCore.moveLane(1); // 屏幕左 = lane 增大
        if (e.key === "ArrowRight") this.gameCore.moveLane(-1); // 屏幕右 = lane 减小
        if (e.key === "ArrowUp" || e.key === " ") this.gameCore.moveLane(0); // 移到中间
      }
    };
    document.addEventListener("keydown", this.gameKeyListener);

    // 注册触屏事件 - 相对移动
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width / 3) {
        // 屏幕左区域：lane 增大（世界 X+）
        this.gameCore.moveLane(1);
      } else if (x > (width * 2) / 3) {
        // 屏幕右区域：lane 减小（世界 X-）
        this.gameCore.moveLane(-1);
      } else {
        // 中间区域：移到中间
        this.gameCore.moveLane(0);
      }
    });
  }

  /**
   * 显示关卡选择界面
   */
  private showLevelSelect(): void {
    // 清空UI
    this.uiManager.clear();

    const levels = this.trackManager.getAllLevels();

    // 难度中文映射
    const difficultyLabel: { [key: string]: string } = {
      easy: "简单",
      normal: "普通",
      hard: "困难",
      extreme: "极限",
    };

    let html = `
      <div id="level-select" class="menu-container panel-screen">
        <span class="eyebrow">MISSION ARCHIVE</span>
        <h2 class="screen-title">选择关卡</h2>
        <div class="levels-grid">
    `;

    const unlocked = this.getUnlockedLevels();

    levels.forEach((level, index) => {
      // 用环境光颜色作为卡片主题色
      const themeColor = level.sceneTheme
        ? "#" + level.sceneTheme.ambientColor.toString(16).padStart(6, "0")
        : "#00d4ff";
      const isUnlocked = unlocked.includes(level.id);
      const lockedClass = isUnlocked ? "" : " locked";
      const lockIcon = isUnlocked
        ? ""
        : '<div class="lock-icon">&#128274;</div>';

      html += `
        <div class="level-card${lockedClass}" data-index="${index}" style="border-color: ${themeColor};">
          ${lockIcon}
          <div class="level-number" style="color: ${themeColor};">${index + 1}</div>
          <h3>${level.name}</h3>
          <p>目标距离: ${level.targetDistance}m</p>
          <span class="difficulty ${level.difficulty}">${difficultyLabel[level.difficulty] || level.difficulty}</span>
        </div>
      `;
    });

    html += `
        </div>
        <button class="btn btn-secondary screen-back" id="btn-back">返回</button>
      </div>
    `;

    const container = document.getElementById("app");
    if (container) {
      container.innerHTML = html;

      // 只为已解锁关卡注册点击事件
      document.querySelectorAll(".level-card:not(.locked)").forEach((card) => {
        card.addEventListener("click", () => {
          const index = parseInt((card as HTMLElement).dataset.index || "0");
          const selectedLevel = levels[index];
          this.trackManager.loadLevel(selectedLevel.id);
          this.startGame();
        });
      });

      document.getElementById("btn-back")?.addEventListener("click", () => {
        this.init();
      });
    }
  }

  /**
   * 显示设置界面
   */
  private showSettings(): void {
    // 清空UI
    this.uiManager.clear();

    const html = `
      <div id="settings" class="menu-container panel-screen settings-screen">
        <span class="eyebrow">SIGNAL CONTROL</span>
        <h2 class="screen-title">设置</h2>
        <div class="settings-group">
          <label>
            <span>主音量</span>
            <input type="range" id="volume" min="0" max="100" value="${this.settings.volume}">
          </label>
        </div>
        <button class="btn btn-secondary screen-back" id="btn-back">返回</button>
      </div>
    `;

    const container = document.getElementById("app");
    if (container) {
      container.innerHTML = html;
      const volumeInput = document.getElementById(
        "volume",
      ) as HTMLInputElement | null;
      volumeInput?.addEventListener("input", () => {
        this.settings.volume = this.clampVolume(Number(volumeInput.value));
        this.applySettings();
        this.saveSettings();
      });
      document.getElementById("btn-back")?.addEventListener("click", () => {
        this.init();
      });
    }
  }

  /**
   * 显示成功结果界面
   */
  private showResultScreen(result: GameResult): void {
    // 清空UI
    this.uiManager.clear();

    // 创建结果屏幕
    this.uiManager.createResultScreen();

    // 更新结果屏幕内容
    const resultScreen = document.getElementById("result-screen");
    if (resultScreen) {
      resultScreen.innerHTML = `
        <div class="result-content">
          <h2>🎉 通关成功！</h2>
          <div class="result-stats">
            <div class="stat">
              <span class="stat-label">最终分数</span>
              <span class="stat-value">${result.score}</span>
            </div>
            <div class="stat">
              <span class="stat-label">踩中方块</span>
              <span class="stat-value">${result.blocksHit}</span>
            </div>
            <div class="stat">
              <span class="stat-label">准确率</span>
              <span class="stat-value">${result.accuracy}%</span>
            </div>
          </div>
          <div class="result-details">
            <div class="detail">
              <span>行进距离</span>
              <span>${Math.floor(result.distanceTraveled || 0)}m</span>
            </div>
          </div>
          <div class="result-buttons">
            <button class="btn btn-primary" id="btn-next-level">下一关</button>
            <button class="btn btn-primary" id="btn-retry">重试</button>
            <button class="btn btn-secondary" id="btn-menu">返回菜单</button>
          </div>
        </div>
      `;
    }

    // 检查是否有下一关，没有则隐藏按钮
    const currentIndex = this.trackManager.getLevelIndex(this.currentLevelId);
    const nextLevelId = this.trackManager.getLevelIdByIndex(currentIndex + 1);

    // 下一关按钮
    const btnNext = document.getElementById("btn-next-level");
    if (!nextLevelId && btnNext) {
      // 已经是最后一关，隐藏下一关按钮
      btnNext.style.display = "none";
    } else if (btnNext) {
      btnNext.addEventListener("click", () => {
        this.trackManager.loadLevel(nextLevelId!);
        this.currentLevelId = nextLevelId!;
        this.startGame();
      });
    }

    this.uiManager.onButtonClick("btn-retry", () => {
      this.startGame();
    });

    this.uiManager.onButtonClick("btn-menu", () => {
      this.returnToMenu();
    });
  }

  /**
   * 移除失败界面快捷键监听
   */
  private removeFailKeyListener(): void {
    if (this.failKeyListener) {
      document.removeEventListener("keydown", this.failKeyListener);
      this.failKeyListener = null;
    }
  }

  /**
   * 移除游戏键盘监听器
   */
  private removeGameKeyListener(): void {
    if (this.gameKeyListener) {
      document.removeEventListener("keydown", this.gameKeyListener);
      this.gameKeyListener = null;
    }
  }

  /**
   * 显示暂停弹框
   */
  private showPauseOverlay(): void {
    // 避免重复创建
    if (document.getElementById("pause-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "pause-overlay";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-panel">
        <span class="eyebrow">HOLD POSITION</span>
        <h2>游戏暂停</h2>
        <p>空格继续航行，ESC 退出到菜单。</p>
        <button class="btn btn-tertiary" id="btn-pause-levels">选择关卡</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // 注册"选择关卡"按钮事件
    document
      .getElementById("btn-pause-levels")
      ?.addEventListener("click", () => {
        this.showPauseLevelSelect();
      });
  }

  /**
   * 隐藏暂停弹框
   */
  private hidePauseOverlay(): void {
    const overlay = document.getElementById("pause-overlay");
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * 显示复活选择界面
   */
  private showReviveScreen(data: ReviveOfferEvent): void {
    // 避免重复创建
    if (document.getElementById("revive-overlay")) return;

    const { revivesLeft, comboShieldAvailable, score } = data;
    const canScoreRevive = score >= 50;

    const overlay = document.createElement("div");
    overlay.id = "revive-overlay";
    overlay.className = "modal-overlay";

    let buttonsHtml = "";

    // 观看广告复活
    buttonsHtml += `
      <button class="btn btn-primary revive-action" id="btn-revive-ad">
        ▶ 观看广告复活 <span style="color: #8f8; font-size: 13px;">（免费）</span>
      </button>
    `;

    // 分数复活
    buttonsHtml += `
      <button class="btn btn-primary revive-action" id="btn-revive-score" style="${canScoreRevive ? "" : "opacity: 0.4; pointer-events: none;"}">
        ⚡ 分数复活 <span style="color: #ff8; font-size: 13px;">（-50% 分数）</span>
      </button>
    `;

    // 连击护盾
    if (comboShieldAvailable) {
      buttonsHtml += `
        <button class="btn btn-primary revive-action shield-action" id="btn-revive-shield">
          🛡 连击护盾 <span style="color: #8ff; font-size: 13px;">（免费）</span>
        </button>
      `;
    }

    overlay.innerHTML = `
      <div class="modal-panel revive-panel">
        <span class="eyebrow">REBOOT WINDOW</span>
        <h2>还有 ${revivesLeft} 次复活机会</h2>
        <p>选择一种方式继续接入轨道。</p>
        ${buttonsHtml}
        <button class="btn btn-secondary" id="btn-revive-giveup">
          放弃，查看结算
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // 注册按钮事件
    document.getElementById("btn-revive-ad")?.addEventListener("click", () => {
      this.startAdCountdown();
    });

    if (canScoreRevive) {
      document
        .getElementById("btn-revive-score")
        ?.addEventListener("click", () => {
          this.hideReviveScreen();
          this.gameCore.reviveGame("score");
        });
    }

    if (comboShieldAvailable) {
      document
        .getElementById("btn-revive-shield")
        ?.addEventListener("click", () => {
          this.hideReviveScreen();
          this.gameCore.reviveGame("shield");
        });
    }

    document
      .getElementById("btn-revive-giveup")
      ?.addEventListener("click", () => {
        this.hideReviveScreen();
        this.gameCore.giveUpRevive();
      });
  }

  /**
   * 模拟广告倒计时（3 秒）
   */
  private startAdCountdown(): void {
    const btn = document.getElementById("btn-revive-ad");
    if (!btn) return;
    this.clearAdCountdown();

    // 禁用所有复活按钮
    const overlay = document.getElementById("revive-overlay");
    if (overlay) {
      overlay.querySelectorAll("button").forEach((b) => {
        (b as HTMLButtonElement).disabled = true;
        b.style.pointerEvents = "none";
      });
    }

    let countdown = 3;
    btn.textContent = `广告播放中... ${countdown}s`;
    btn.style.opacity = "0.7";

    this.adCountdownTimer = window.setInterval(() => {
      countdown--;
      if (countdown > 0) {
        btn.textContent = `广告播放中... ${countdown}s`;
      } else {
        this.clearAdCountdown();
        this.hideReviveScreen();
        this.gameCore.reviveGame("ad");
      }
    }, 1000);
  }

  /**
   * 隐藏复活选择界面
   */
  private hideReviveScreen(): void {
    const overlay = document.getElementById("revive-overlay");
    if (overlay) overlay.remove();
  }

  private clearAdCountdown(): void {
    if (this.adCountdownTimer !== null) {
      clearInterval(this.adCountdownTimer);
      this.adCountdownTimer = null;
    }
  }

  /**
   * 显示失败结果界面
   */
  private showFailScreen(result: GameResult): void {
    // 清空UI
    this.uiManager.clear();

    // 创建结果屏幕
    this.uiManager.createResultScreen();

    const resultScreen = document.getElementById("result-screen");
    if (resultScreen) {
      resultScreen.innerHTML = `
        <div class="result-content">
          <h2 style="color: #ff4444;">游戏失败</h2>
          <p style="color: #aaa; margin-bottom: 20px;">颜色不匹配，球体破裂！</p>
          <div class="result-stats">
            <div class="stat">
              <span class="stat-label">最终分数</span>
              <span class="stat-value">${result.score}</span>
            </div>
            <div class="stat">
              <span class="stat-label">踩中方块</span>
              <span class="stat-value">${result.blocksHit}</span>
            </div>
          </div>
          <div class="result-buttons">
            <button class="btn btn-primary" id="btn-retry">重试</button>
            <button class="btn btn-secondary" id="btn-menu">返回菜单</button>
          </div>
        </div>
      `;
    }

    this.uiManager.onButtonClick("btn-retry", () => {
      this.removeFailKeyListener();
      this.startGame();
    });
    this.uiManager.onButtonClick("btn-menu", () => {
      this.removeFailKeyListener();
      this.returnToMenu();
    });

    // 注册快捷键：空格重试，ESC返回菜单
    this.failKeyListener = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        this.removeFailKeyListener();
        this.startGame();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.removeFailKeyListener();
        this.returnToMenu();
      }
    };
    document.addEventListener("keydown", this.failKeyListener);
  }

  /**
   * 销毁应用
   */
  destroy(): void {
    this.clearAdCountdown();
    this.hideReviveScreen();
    this.hidePauseLevelSelect();
    this.hidePauseOverlay();
    this.removeFailKeyListener();
    if (this.gameKeyListener) {
      document.removeEventListener("keydown", this.gameKeyListener);
      this.gameKeyListener = null;
    }
    this.gameCore.destroy();
    this.uiManager.clear();
  }

  /**
   * 获取已解锁的关卡ID列表
   */
  private getUnlockedLevels(): string[] {
    try {
      const data = localStorage.getItem(this.UNLOCK_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    // 默认只解锁第一关
    return ["level_1_moon"];
  }

  private loadSettings(): AppSettings {
    try {
      const data = localStorage.getItem(this.SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Partial<AppSettings>;
        if (typeof parsed.volume === "number") {
          return { volume: this.clampVolume(parsed.volume) };
        }
      }
    } catch {}
    return { volume: 80 };
  }

  private saveSettings(): void {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
  }

  private applySettings(): void {
    const normalized = this.clampVolume(this.settings.volume) / 100;
    this.gameCore.setMusicVolume(normalized * 0.25);
    this.gameCore.setSfxVolume(normalized * 0.75);
  }

  private clampVolume(volume: number): number {
    if (!Number.isFinite(volume)) return 80;
    return Math.max(0, Math.min(100, Math.round(volume)));
  }

  /**
   * 解锁下一个关卡
   * @param currentLevelId 当前通关的关卡ID
   */
  private unlockNextLevel(currentLevelId: string): void {
    const unlocked = this.getUnlockedLevels();
    const currentIndex = this.trackManager.getLevelIndex(currentLevelId);
    const nextId = this.trackManager.getLevelIdByIndex(currentIndex + 1);
    if (nextId && !unlocked.includes(nextId)) {
      unlocked.push(nextId);
      localStorage.setItem(this.UNLOCK_KEY, JSON.stringify(unlocked));
    }
  }

  /**
   * 显示暂停时的关卡选择弹窗
   */
  private showPauseLevelSelect(): void {
    if (document.getElementById("pause-level-select")) return;

    const levels = this.trackManager.getAllLevels();
    const unlocked = this.getUnlockedLevels();
    const difficultyLabel: { [key: string]: string } = {
      easy: "简单",
      normal: "普通",
      hard: "困难",
      extreme: "极限",
    };

    let cardsHtml = "";
    levels.forEach((level, index) => {
      const themeColor = level.sceneTheme
        ? "#" + level.sceneTheme.ambientColor.toString(16).padStart(6, "0")
        : "#00d4ff";
      const isUnlocked = unlocked.includes(level.id);
      const lockedClass = isUnlocked ? "" : " locked";
      const lockIcon = isUnlocked
        ? ""
        : '<div class="lock-icon">&#128274;</div>';

      cardsHtml += `
        <div class="level-card${lockedClass}" data-index="${index}" style="border-color: ${themeColor};">
          ${lockIcon}
          <div class="level-number" style="color: ${themeColor};">${index + 1}</div>
          <h3>${level.name}</h3>
          <p>目标距离: ${level.targetDistance}m</p>
          <span class="difficulty ${level.difficulty}">${difficultyLabel[level.difficulty] || level.difficulty}</span>
        </div>
      `;
    });

    const overlay = document.createElement("div");
    overlay.id = "pause-level-select";
    overlay.className = "modal-overlay level-modal";
    overlay.innerHTML = `
      <div class="modal-panel level-modal-panel">
        <span class="eyebrow">MISSION ARCHIVE</span>
        <h2>选择关卡</h2>
        <div class="levels-grid">${cardsHtml}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="btn-pause-level-back">返回</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 已解锁关卡的点击事件
    overlay.querySelectorAll(".level-card:not(.locked)").forEach((card) => {
      card.addEventListener("click", () => {
        const index = parseInt((card as HTMLElement).dataset.index || "0");
        const selectedLevel = levels[index];
        this.hidePauseLevelSelect();
        this.hidePauseOverlay();
        this.removeGameKeyListener();
        this.gameCore.destroy();
        this.trackManager.loadLevel(selectedLevel.id);
        this.currentLevelId = selectedLevel.id;
        this.startGame();
      });
    });

    // 返回按钮
    document
      .getElementById("btn-pause-level-back")
      ?.addEventListener("click", () => {
        this.hidePauseLevelSelect();
      });
  }

  /**
   * 隐藏暂停时的关卡选择弹窗
   */
  private hidePauseLevelSelect(): void {
    const el = document.getElementById("pause-level-select");
    if (el) el.remove();
  }
}

/**
 * 应用入口
 */
let app: GameApp;

document.addEventListener("DOMContentLoaded", () => {
  app = new GameApp();
  console.log("GameApp: Application started");
});

// 页面卸载时销毁应用
window.addEventListener("beforeunload", () => {
  if (app) {
    app.destroy();
  }
});

export default GameApp;
