# 炫彩节奏3D — 项目状态文档

> 最后更新：2026-04-11
> 仓库地址：https://github.com/Suxingyu111/RhythmColor3D

## 项目概述

基于 Three.js 的 3D 球形跳跃节奏游戏。球在太空轨道上自动弹跳前进，玩家通过左右切换车道（左/中/右）踩中颜色方块得分，配合程序化生成的电子音乐，体验音画同步的节奏快感。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vite | 5 | 构建工具 + 开发服务器（端口 5173） |
| TypeScript | 5 | 类型系统（`strict: false`） |
| Three.js | 0.160 | 3D 渲染（PerspectiveCamera + UnrealBloomPass） |
| Web Audio API | - | 音频引擎（AudioContext 前瞻调度，16 步序列器） |
| 原生 DOM | - | UI 层，无框架依赖 |

## 常用命令

```bash
npm run dev          # 启动开发服务器（端口 5173）
npm run build        # 构建生产版本（输出到 dist/）
npm run typecheck    # TypeScript 类型检查（tsc --noEmit）
npm run format       # Prettier 自动格式化
```

## 项目结构

```
src/
├── 3d/
│   └── Renderer3D.ts           # Three.js 渲染系统（1500+ 行）
│                                 # 球体、轨道方块、粒子系统、后处理、视觉特效
│                                 # 含复活特效：restoreBall / playReviveEffect / 无敌闪烁
├── audio/
│   ├── AudioManager.ts          # 音频引擎（前瞻调度 BGM + 音效）
│   └── MusicConfig.ts           # 10 关卡程序化音乐配置
├── game/
│   ├── GameCore.ts              # 游戏核心（状态机、碰撞协调、事件分发、复活逻辑）
│   ├── BallPhysics.ts           # 球体物理（跳跃、重力、车道切换、加速、softReset）
│   ├── ColorMatcher.ts          # 颜色十六进制映射
│   └── types.ts                 # 类型定义（GameState 含 REVIVING、TrackBlock、BallState 等）
├── managers/
│   └── TrackManager.ts          # 轨道动态生成（确定性种子随机、难度配置、findNextSafeBlock）
├── ui/
│   └── UIManager.ts             # DOM UI 管理
├── utils/
│   └── EventEmitter.ts          # 自定义事件系统
└── main.ts                      # 应用入口（GameApp 类：菜单、关卡选择、设置、结算、复活UI）
```

### 路径别名（vite.config.ts + tsconfig.json）

| 别名 | 路径 |
|------|------|
| `@game/*` | `src/game/*` |
| `@3d/*` | `src/3d/*` |
| `@audio/*` | `src/audio/*` |
| `@managers/*` | `src/managers/*` |
| `@ui/*` | `src/ui/*` |
| `@utils/*` | `src/utils/*` |

### 遗留文件（未使用）

- `src/main.old.ts` — 旧版节奏游戏入口
- `src/game/GameCore.old.ts` — 旧版游戏核心
- `src/game/RhythmDetector.ts` — 旧版节奏检测
- `src/game/ScoreManager.ts` — 旧版计分
- `src/managers/LevelManager.ts` — 旧版关卡管理

---

## 核心架构

### 游戏状态机

```
GameState: IDLE → PLAYING → PAUSED → PLAYING → ...
                         ↓
                    FINISHED（通关）
                         ↓
                    failGame() → REVIVING（复活选择）→ PLAYING（复活成功）
                                                    → FINISHED（放弃/次数用完）
```

### 游戏循环

```
GameCore.startGameLoop()  [requestAnimationFrame]
  ├── BallPhysics.update(dt)        → 物理模拟（重力、跳跃、前进）
  ├── TrackManager.updateTrack()    → 动态加载/回收方块
  ├── AudioManager.getBeatInfo()    → 获取当前节拍信息
  ├── Renderer3D.updateBallState()  → 球体渲染 + 节拍视觉响应
  ├── Renderer3D.updateCameraPosition() → 相机跟踪 + 震动 + FOV 脉冲
  └── Renderer3D.render()           → 合成输出
```

### 事件流

```
BallPhysics.landed → GameCore.handleBallLanded()
  ├── TrackManager.checkBlockCollision()  → 车道精确匹配
  ├── TrackManager.findNearestBlockAnyLane() → 自动吸附（防踩空）
  ├── 颜色匹配检查 → 成功：snapToBlock + 计分 / 失败：failGame
  │     └── failGame → 爆炸动画（1秒）
  │           ├── 复活次数 < 3 → state=REVIVING → 复活选择 UI
  │           │     ├── 玩家选择复活 → reviveGame → softReset + 2秒无敌
  │           │     └── 玩家放弃 → 失败结算
  │           └── 复活次数 ≥ 3 → 直接失败结算
  └── Renderer3D 视觉反馈（弹跳、涟漪、粒子、震动）
```

### 系统间通信

所有系统通过自定义 `EventEmitter`（src/utils/）解耦通信：
- `BallPhysics` 发出 `landed`、`color-changed`、`snapped-to-block`、`boost-activated`、`boost-deactivated`
- `GameCore` 监听物理事件并协调 TrackManager 和 Renderer3D
- `GameCore` 发出 `game-update`、`game-finished`、`game-failed`、`game-revive-offer`、`game-revived`、`block-hit`、`boost-activated`、`boost-deactivated`
- `GameApp`（main.ts）监听 GameCore 事件更新 UI

---

## 物理系统

球的跳跃参数经过精确计算，保证不同速度下落点始终对齐方块间距：

- 基础参数：`jumpForce=20, gravity=32, moveSpeed=4, blockSpacing=5`
- 跳跃高度：`h = jumpForce² / (2 × gravity) = 6.25`（恒定）
- 落点距离：`d = moveSpeed × jumpDuration = 5 = blockSpacing`（恒定）
- 速度倍率 k：`moveSpeed×k, jumpForce×k, gravity×k²` → 高度不变，节奏加快
- 车道宽度：1（X 轴间距），球半径 0.5，落地 Y=0.75

---

## 关卡系统

10 个太空主题关卡，4 个难度梯度，逐关解锁（localStorage 持久化）：

| 关卡 | 名称 | 难度 | BPM | 目标距离 | 音阶风格 |
|------|------|------|-----|----------|----------|
| 1 | 月球漫步 | EASY | 96 | 200m | A 小调五声 |
| 2 | 火星风暴 | EASY | 96 | 300m | D Dorian |
| 3 | 金星熔炉 | NORMAL | 115 | 400m | E Phrygian |
| 4 | 木星漩涡 | NORMAL | 115 | 500m | G Mixolydian |
| 5 | 土星光环 | NORMAL | 115 | 600m | C Lydian |
| 6 | 天王星冰原 | HARD | 144 | 750m | E 自然小调 |
| 7 | 海王星深渊 | HARD | 144 | 900m | C# 和声小调 |
| 8 | 天狼星闪耀 | HARD | 144 | 1050m | A 大调五声 |
| 9 | 参宿四脉动 | EXTREME | 173 | 1200m | Bb 全音阶 |
| 10 | 黑洞边界 | EXTREME | 173 | 1500m | E 半音阶 |

### 难度参数

| 难度 | 速度倍率 | 变色轨道 | 三块轨道 | 两块轨道 | 加速轨道 | 加速倍率 |
|------|----------|----------|----------|----------|----------|----------|
| EASY | 1.0x | 45% | 15% | 30% | 10% | 1.5x |
| NORMAL | 1.2x | 30% | 25% | 25% | 20% | 2.0x |
| HARD | 1.5x | 20% | 28% | 27% | 25% | 2.5x |
| EXTREME | 1.8x | 12% | 30% | 30% | 28% | 3.0x |

---

## 方块类型

| 类型 | 外观 | 效果 |
|------|------|------|
| 变色方块 | 宽矩形，覆盖全车道（lane=1） | 踩到后球变为方块颜色 |
| 分裂方块（三块） | 三个小方块分布在三条车道 | 必须踩到与球颜色一致的方块 |
| 分裂方块（两块） | 两个小方块在相邻车道 [0,1] 或 [1,2] | 同上，颜色不匹配则失败 |
| 加速方块 | 白色发光矩形 | 踩到后球加速，音乐 BPM 同步提升 |

颜色系统使用三色：粉（PINK）、黄（YELLOW）、蓝（BLUE）。

### 轨道生成规则（TrackManager）

- 确定性种子随机（`seededRandom`），每局 `loadLevel` 时 `seed = Date.now()`
- 第一个方块强制为变色方块（避免开局失败）
- 两块轨道只使用相邻车道对 [0,1] 或 [1,2]（避免跨两格移动）
- 球颜色链追踪：只有变色方块改变球颜色，两块/三块轨道的颜色组合保证包含当前球颜色
- 动态加载：提前 150 单位加载，身后 20 单位清理

### 碰撞检测

- 精确碰撞范围 1.0 单位，扩展搜索 1.5 单位
- 自动吸附（`findNearestBlockAnyLane`）：2.5 单位范围内按优先级搜索（颜色匹配 > 变色/加速 > 其他）
- 无敌状态下跳过颜色检查和踩空检查

---

## 复活机制（最新实现）

每局游戏最多 3 次复活机会，失败爆炸动画播完后弹出复活选择 UI：

### 三种复活方式

| 方式 | 条件 | 效果 |
|------|------|------|
| 观看广告复活 | 免费，3 秒倒计时 | 倒计时结束后复活 |
| 分数复活 | 当前分数 ≥ 50 | 消耗 50% 分数，立即复活 |
| 连击护盾 | 失败前连击 ≥ 10，每局限 1 次 | 免费立即复活 |

### 复活后处理

- 球传送到失败位置前方安全方块（`findNextSafeBlock`，优先级：变色 > 加速 > 颜色匹配分裂）
- 球颜色自动匹配目标方块
- 2 秒无敌保护（球体 100ms 间隔闪烁），期间踩错/踩空不失败
- 加速状态清除，恢复基础速度
- 分数和已踩方块数保留（分数复活除外）

### 技术实现

| 文件 | 关键方法/字段 |
|------|--------------|
| `types.ts` | `GameState.REVIVING` |
| `BallPhysics.ts` | `softReset(z, lane, color)` — 保留难度倍率，清除 boost |
| `TrackManager.ts` | `findNextSafeBlock(ballZ, ballColor)` — 前方 5-50 单位搜索 |
| `Renderer3D.ts` | `restoreBall()` / `playReviveEffect()` / `startInvincibleBlink()` / `stopInvincibleBlink()` |
| `GameCore.ts` | `reviveGame(method)` / `giveUpRevive()` / `startInvincibleProtection()` / `getReviveInfo()` |
| `main.ts` | `showReviveScreen(data)` / `hideReviveScreen()` / `startAdCountdown()` |

---

## 视觉特效系统

| 特效 | 描述 |
|------|------|
| 球体拖尾 | 自定义 ShaderMaterial，20 点二次衰减渐变 |
| 落地粒子 | 30 颗对象池粒子爆发 |
| 加速风暴 | 1000 颗粒子翻涌 + FOV 拉宽至 82° |
| 涟漪冲击波 | 双层 Shader 矩形 SDF + 36 颗火花扩散 |
| 跳板弹性 | 方块下压回弹动画 |
| 变色闪光 | 白色 emissive 爆闪 + 缩放弹跳过渡 |
| 方块入场 | scale.y 从 0 升起，ease-out cubic |
| 球体破裂 | 12 碎片飞散 + 环境光红闪 + bloom 飙升 |
| 复活重生 | 球体 scale 0→1.2→1.0 弹跳 + 点光源闪亮 + 粒子爆发 |
| 无敌闪烁 | 复活后 2 秒球体 100ms 间隔闪烁 |
| 摄像机震动 | 落地/死亡触发，随机偏移 + 线性衰减 |
| 节拍脉冲 | 点光源 + bloom 随四分/半音符拍点呼吸 |
| FOV 脉冲 | 强拍时 FOV +2°，lerp 恢复 |
| 星空脉动 | 2000 颗星随强拍闪烁 |
| UnrealBloom | 全局辉光后处理 |

### 性能策略

- 方块共享 Geometry + 缓存 Material，零运行时分配
- 粒子系统全部预分配对象池
- 每 5 帧检查可见方块创建，每 30 帧清理身后方块
- 真实 dt 计算（`performance.now()`），防止切标签页后物理爆炸
- 单 `requestAnimationFrame` 循环，渲染合并到游戏循环
- `startGame()` 时先 `destroy()` 旧渲染器，防止 WebGL 上下文泄漏

---

## 音频系统

基于 AudioContext 的前瞻调度引擎，零延迟节拍同步：

- 16 步序列器驱动鼓组（kick/snare/hihat）
- 独立 Bass 和 Melody 声部，支持不同步进分辨率
- Pad 持续和弦 + 小节级和弦进行
- ADSR 包络 + 可选低通滤波器
- BeatInfo 接口实时暴露节拍状态给视觉层
- 加速时 BPM 同步提升（`activateBoostBPM` / `deactivateBoostBPM`）

---

## 操作方式

| 按键 | 功能 |
|------|------|
| `←` / `→` 方向键 | 切换车道（每次移动一格，过滤长按重复） |
| `ESC` | 暂停 / 退出到菜单 |
| `空格` | 继续 / 重试 |

支持触屏点击操作（屏幕三等分：左区=左移，右区=右移，中区=回中间）。

注意方向映射：摄像机在 Z=-8 向 +Z 方向看，屏幕左 = 世界 X+（lane 增大），屏幕右 = 世界 X-（lane 减小）。

---

## UI 系统

- 主菜单：开始游戏 / 选择关卡 / 设置
- 关卡选择：10 关卡片网格，锁定/解锁状态，环境光颜色作为主题色
- 游戏 HUD：分数、踩中方块数、时间、距离进度条、连击提示、加速指示器
- 暂停弹窗：空格继续 / ESC 退出 / 选择关卡
- 通关结算：分数、踩中数、准确率、行进距离、下一关/重试/返回菜单
- 失败结算：分数、踩中数、重试/返回菜单
- 复活选择：观看广告（3秒倒计时）/ 分数复活 / 连击护盾 / 放弃

---

## 已解决的关键问题

1. **双格移动问题**：两块轨道改为只使用相邻车道对 [0,1] 或 [1,2]，避免玩家需要按两次方向键
2. **球体闪烁**：移除球体 emissiveIntensity 节拍脉冲，改为仅点光源 + bloom 响应节拍
3. **自动吸附防踩空**：`findNearestBlockAnyLane` 按颜色优先级搜索最近方块并自动调整车道
4. **重启卡顿**：`startGame()` 开头调用 `destroy()` 清理旧 WebGL 上下文
5. **切标签页物理爆炸**：使用 `performance.now()` 计算真实 dt，限制最大 deltaTime

---

## Git 信息

- 分支：`main`
- 远程：`origin` → `https://github.com/Suxingyu111/RhythmColor3D.git`
- 最新提交：`fe3fcc1` — feat: 实现游戏复活机制 — 3种复活方式 + 无敌保护
