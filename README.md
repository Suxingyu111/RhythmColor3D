# 炫彩节奏3D

基于 Three.js 的 3D 球形跳跃节奏游戏。球在太空轨道上自动弹跳前进，玩家通过左右切换车道踩中颜色方块得分，配合程序化生成的电子音乐，体验音画同步的节奏快感。

## 游戏玩法

球在三条车道（左/中/右）上自动跳跃前进，每次落地需要踩中前方的颜色方块。方块分为四种类型：

| 类型 | 外观 | 效果 |
|------|------|------|
| 变色方块 | 宽矩形，覆盖全车道 | 踩到后球变为方块颜色 |
| 分裂方块（三块） | 三个小方块分布在三条车道 | 必须踩到与球颜色一致的方块，否则失败 |
| 分裂方块（两块） | 两个小方块在相邻车道 | 同上，颜色不匹配则失败 |
| 加速方块 | 白色发光矩形 | 踩到后球加速，音乐 BPM 同步提升 |

到达关卡目标距离即通关，踩错颜色或踩空则失败。

### 复活机制

每局游戏最多 3 次复活机会，失败后弹出复活选择界面：

| 方式 | 条件 | 效果 |
|------|------|------|
| 观看广告复活 | 免费，3 秒倒计时 | 倒计时结束后原地复活 |
| 分数复活 | 当前分数 ≥ 50 | 消耗 50% 分数，立即复活 |
| 连击护盾 | 失败前连击 ≥ 10，每局限 1 次 | 免费立即复活 |

复活后处理：
- 球传送到失败位置前方的安全方块上（优先：变色方块 > 加速方块 > 颜色匹配分裂方块）
- 球颜色自动匹配目标方块
- 2 秒无敌保护（球体闪烁提示），期间踩错不会失败
- 加速状态清除，恢复基础速度
- 3 次机会用完或玩家放弃后进入正常失败结算

### 操作方式

| 按键 | 功能 |
|------|------|
| `←` / `→` 方向键 | 切换车道（每次移动一格） |
| `ESC` | 暂停 / 退出 |
| `空格` | 继续 / 重试 |

支持触屏滑动操作。

## 关卡系统

10 个太空主题关卡，4 个难度梯度，逐关解锁：

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

每个关卡拥有独立的场景主题（背景色、雾效、环境光）和程序化音乐配置。

### 难度参数

| 难度 | 速度倍率 | 变色轨道 | 三块轨道 | 两块轨道 | 加速轨道 | 加速倍率 |
|------|----------|----------|----------|----------|----------|----------|
| EASY | 1.0x | 45% | 15% | 30% | 10% | 1.5x |
| NORMAL | 1.2x | 30% | 25% | 25% | 20% | 2.0x |
| HARD | 1.5x | 20% | 28% | 27% | 25% | 2.5x |
| EXTREME | 1.8x | 12% | 30% | 30% | 28% | 3.0x |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run typecheck

# 代码格式化
npm run format
```

## 技术栈

- **构建工具**：Vite 5 + TypeScript 5
- **3D 渲染**：Three.js 0.160（PerspectiveCamera + UnrealBloomPass 后处理）
- **音频引擎**：Web Audio API（AudioContext 前瞻调度，16 步序列器）
- **UI**：原生 DOM，无框架依赖

## 项目结构

```
src/
├── 3d/
│   └── Renderer3D.ts           # Three.js 渲染系统（1400+ 行）
│                                 # 球体、轨道方块、粒子系统、后处理、视觉特效
├── audio/
│   ├── AudioManager.ts          # 音频引擎（前瞻调度 BGM + 音效）
│   └── MusicConfig.ts           # 10 关卡程序化音乐配置
├── game/
│   ├── GameCore.ts              # 游戏核心（状态机、碰撞协调、事件分发）
│   ├── BallPhysics.ts           # 球体物理（跳跃、重力、车道切换、加速）
│   ├── ColorMatcher.ts          # 颜色十六进制映射
│   └── types.ts                 # 类型定义（GameState、TrackBlock、BallState 等）
├── managers/
│   └── TrackManager.ts          # 轨道动态生成（确定性种子随机、难度配置、关卡预设）
├── ui/
│   └── UIManager.ts             # DOM UI 管理
├── utils/
│   └── EventEmitter.ts          # 自定义事件系统
└── main.ts                      # 应用入口（GameApp 类：菜单、关卡选择、设置、结算）
```

### 路径别名

| 别名 | 路径 |
|------|------|
| `@game/*` | `src/game/*` |
| `@3d/*` | `src/3d/*` |
| `@audio/*` | `src/audio/*` |
| `@managers/*` | `src/managers/*` |
| `@ui/*` | `src/ui/*` |
| `@utils/*` | `src/utils/*` |

## 核心架构

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

### 物理系统

球的跳跃参数经过精确计算，保证不同速度下落点始终对齐方块间距：

- 基础参数：`jumpForce=20, gravity=32, moveSpeed=4, blockSpacing=5`
- 跳跃高度：`h = jumpForce² / (2 × gravity) = 6.25`（恒定）
- 落点距离：`d = moveSpeed × jumpDuration = 5 = blockSpacing`（恒定）
- 速度倍率 k：`moveSpeed×k, jumpForce×k, gravity×k²` → 高度不变，节奏加快

### 音频系统

基于 AudioContext 的前瞻调度引擎，零延迟节拍同步：

- 16 步序列器驱动鼓组（kick/snare/hihat）
- 独立 Bass 和 Melody 声部，支持不同步进分辨率
- Pad 持续和弦 + 小节级和弦进行
- ADSR 包络 + 可选低通滤波器
- BeatInfo 接口实时暴露节拍状态给视觉层

### 视觉特效

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
| 星空脉动 | 2000 颗星随强拍闪烁 |
| UnrealBloom | 全局辉光后处理 |

### 性能策略

- 方块共享 Geometry + 缓存 Material，零运行时分配
- 粒子系统全部预分配对象池
- 每 5 帧检查可见方块创建，每 30 帧清理身后方块
- 真实 dt 计算（`performance.now()`），防止切标签页后物理爆炸
- 单 `requestAnimationFrame` 循环，渲染合并到游戏循环

## 许可证

MIT
