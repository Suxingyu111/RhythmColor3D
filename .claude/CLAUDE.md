# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 自更新规则（必须执行）

当你完成任何代码修改（新增功能、bug 修复、重构、配置变更）后，必须自动执行以下步骤：
1. 扫描本次所有变更文件，识别新增/修改/删除的功能模块
2. 更新本文件（CLAUDE.md）中受影响的章节，保持文档与代码同步
3. 如果新增了全新的系统或模块，在对应章节补充说明
4. 如果修改了物理参数、事件名、方法签名等关键接口，同步更新对应描述
5. 同步更新 PROJECT_STATUS.md（如果存在）

不需要用户提醒，每次代码变更后自动执行。

## 项目概述

炫彩节奏3D — 基于 Three.js 的 3D 球形跳跃节奏游戏。球在太空轨道上自动弹跳前进，玩家通过左右切换车道踩中颜色方块得分，配合程序化生成的电子音乐，体验音画同步的节奏快感。10 个太空主题关卡，4 个难度梯度，逐关解锁。

## 常用命令

- `npm run dev` — 启动 Vite 开发服务器（端口 5173）
- `npm run build` — 构建生产版本（输出到 dist/，使用 terser 压缩）
- `npm run typecheck` — TypeScript 类型检查（tsc --noEmit）
- `npm run lint` — Prettier 格式检查
- `npm run format` — Prettier 自动格式化

## 架构

项目使用 Vite 5 + TypeScript 5 + Three.js 0.160，无框架，纯原生 DOM 操作 UI。

### 核心运行机制

球自动沿 Z 轴前进（`moveSpeed=4`），方块固定在世界坐标中不动。球做 Y 轴跳跃和 X 轴车道切换。游戏循环在 `GameCore.startGameLoop()` 中通过单个 `requestAnimationFrame` 驱动，渲染合并到游戏循环中（无双重 rAF）。

### 方块类型与生成规则（TrackManager）

四种轨道类型，按难度配置的概率分布随机生成（确定性种子随机 `seededRandom`）：
- **变色方块**（straight）：宽矩形覆盖全车道（lane=1），`isColorChanger=true`，踩到后球变色
- **三块轨道**（triple）：三个小方块分布在三条车道，粉/黄/蓝随机排列，必须踩到与球颜色一致的
- **两块轨道**（double）：两个小方块在相邻车道 [0,1] 或 [1,2]，从包含球颜色的组合中选
- **加速方块**（boost）：白色发光矩形，踩到后加速 + BPM 同步提升

颜色系统使用三色：粉（PINK）、黄（YELLOW）、蓝（BLUE）。
- 方块间距 `blockSpacing=5`，提前加载 150 单位，身后 20 单位清理
- 第一个方块强制为变色方块（避免开局失败）
- 每局 `loadLevel` 时 `seed = Date.now()`，确保每局轨道不同

### 游戏状态机

```
GameState: IDLE → PLAYING ⇄ PAUSED
                    ↓
               FINISHED（通关）
                    ↓
              failGame() → REVIVING（复活选择，最多3次）→ PLAYING
                                                       → FINISHED（放弃/次数用完）
```

### 系统间通信

所有系统通过自定义 `EventEmitter`（src/utils/）解耦通信：
- `BallPhysics` 发出 `landed`、`color-changed`、`snapped-to-block`、`boost-activated`、`boost-deactivated`
- `GameCore` 发出 `game-update`、`game-finished`、`game-failed`、`game-revive-offer`、`game-revived`、`block-hit`、`boost-activated`、`boost-deactivated`
- `GameApp`（main.ts）监听 GameCore 事件更新 UI

### 碰撞检测流程

球落地时（Y<=0.7）→ BallPhysics 发出 `landed` → GameCore.handleBallLanded()：
1. `TrackManager.checkBlockCollision(z, lane)` — 精确碰撞范围 1.0，扩展搜索 1.5
2. 未命中时 `findNearestBlockAnyLane(z, color)` — 2.5 范围内按优先级自动吸附（颜色匹配 > 变色/加速 > 其他）
3. 无敌状态（`isInvincible`）下跳过颜色检查和踩空检查
4. 颜色匹配 → snapToBlock + 计分；不匹配 → failGame()（触发复活判断）

### 复活机制

每局最多 3 次复活，失败爆炸动画后弹出选择 UI：
- **观看广告**：3 秒倒计时，免费（预留广告 SDK 接口）
- **分数复活**：消耗 50% 分数，需 ≥ 50 分
- **连击护盾**：失败前连击 ≥ 10 时免费，每局限 1 次

复活后：`softReset` 到前方安全方块（`findNextSafeBlock`），2 秒无敌保护（球体闪烁），加速清除。

关键方法：
- `GameCore.reviveGame(method)` / `giveUpRevive()` / `startInvincibleProtection()`
- `BallPhysics.softReset(z, lane, color)` — 保留难度倍率，清除 boost
- `TrackManager.findNextSafeBlock(ballZ, ballColor)` — 优先级：变色 > 加速 > 颜色匹配分裂
- `Renderer3D.restoreBall()` / `playReviveEffect()` / `startInvincibleBlink()` / `stopInvincibleBlink()`

### 路径别名

vite.config.ts 和 tsconfig.json 中配置了路径别名：
- `@game` → src/game/
- `@3d` → src/3d/
- `@ui` → src/ui/
- `@managers` → src/managers/
- `@utils` → src/utils/
- `@audio` → src/audio/

### 遗留文件（未使用）

`src/main.old.ts`、`src/game/GameCore.old.ts`、`src/game/RhythmDetector.ts`、`src/game/ScoreManager.ts`、`src/managers/LevelManager.ts` 是旧版代码，当前未使用。

## 关键物理参数

- 跳跃力：20，重力：32
- 车道宽度：1（X 轴间距）
- 方块间距：5（blockSpacing）
- 球半径：0.5，落地 Y 位置：0.75
- 跳跃高度：6.25（恒定），跳跃周期：1.25 秒
- 速度倍率 k：`moveSpeed×k, jumpForce×k, gravity×k²` → 高度不变，节奏加快
- 难度倍率：EASY=1.0, NORMAL=1.2, HARD=1.5, EXTREME=1.8

## 视觉特效系统（Renderer3D.ts）

- 球体拖尾：ShaderMaterial，20 点二次衰减渐变
- 落地粒子：30 颗对象池粒子爆发
- 加速风暴：1000 颗粒子 + FOV 拉宽至 82°
- 涟漪冲击波：双层 Shader 矩形 SDF + 36 颗火花
- 跳板弹性：方块下压回弹动画
- 变色闪光：白色 emissive 爆闪 + 缩放弹跳
- 方块入场：scale.y 从 0 升起，ease-out cubic
- 球体破裂：12 碎片飞散 + 环境光红闪 + bloom 飙升
- 复活重生：scale 0→1.2→1.0 + 点光源闪亮 + 粒子爆发
- 无敌闪烁：100ms 间隔切换球体可见性
- 摄像机震动：随机偏移 + 线性衰减
- 节拍脉冲：点光源 + bloom 随拍点呼吸（不影响球体 emissive，避免颜色不可辨）
- FOV 脉冲：强拍 +2°，lerp 恢复
- 星空脉动：2000 颗星随强拍闪烁

## 音频系统（AudioManager.ts + MusicConfig.ts）

- 16 步序列器驱动鼓组（kick/snare/hihat）
- 独立 Bass 和 Melody 声部
- Pad 持续和弦 + 小节级和弦进行
- BeatInfo 接口实时暴露节拍状态给视觉层
- 加速时 BPM 同步提升

## 性能策略

- 方块共享 Geometry + 缓存 Material
- 粒子系统全部预分配对象池
- 每 5 帧检查可见方块创建，每 30 帧清理身后方块
- 真实 dt 计算（`performance.now()`），防止切标签页后物理爆炸
- `startGame()` 时先 `destroy()` 旧渲染器，防止 WebGL 上下文泄漏

## 注意事项

- tsconfig.json 中 `strict: false`，类型检查较宽松
- Renderer3D 依赖 ColorMatcher 的 `colorHexMap` 做颜色转换
- 关卡解锁状态存储在 localStorage（key: `rhythmColor3D_unlockedLevels`）
- 详细项目状态文档见 `PROJECT_STATUS.md`
