# 炫彩节奏 3D

基于 Vite、TypeScript、Three.js 和 Web Audio API 构建的 3D 色彩节奏游戏。玩家操控一颗发光球体在三条太空轨道间跳跃，跟随程序化电子音乐踩中对应颜色方块，完成从月球漫步到黑洞边界的 10 个关卡挑战。

项目当前重点已经从原型玩法推进到稳定可维护版本：菜单和游戏 HUD 完成沉浸式视觉升级，核心事件已类型化，渲染资源释放路径更完整，生产构建会将 Three.js 拆分为独立 chunk。

## 功能亮点

- 3D 轨道跳跃玩法：三车道移动、颜色匹配、自动吸附、安全复活。
- 程序化音乐：Web Audio 前瞻调度驱动鼓组、Bass、旋律和 Pad。
- 音画同步反馈：节拍脉冲、Bloom、粒子、摄像机震动、加速风暴。
- 关卡难度曲线：10 个太空主题关卡，覆盖 EASY、NORMAL、HARD、EXTREME。
- 沉浸式界面：深空主菜单、任务面板、驾驶舱 HUD、统一弹窗系统。
- 稳定性优化：键盘监听、倒计时、复活回调和 WebGL 资源在退出/销毁时统一清理。
- 构建优化：Vite 手动拆包，将 Three.js 从主业务 chunk 中分离。

## 快速开始

```bash
npm install
npm run dev
```

开发服务器默认运行在：

```text
http://localhost:5173
```

常用脚本：

| 命令                | 说明                     |
| ------------------- | ------------------------ |
| `npm run dev`       | 启动 Vite 开发服务器     |
| `npm run build`     | 生成生产构建到 `dist/`   |
| `npm run preview`   | 本地预览生产构建         |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm run lint`      | 使用 Prettier 检查格式   |
| `npm run format`    | 自动格式化源码和配置     |

## 游戏玩法

球体会自动向前跳跃，玩家通过左右移动切换车道，在落地时踩中正确方块。

| 方块类型   | 外观                     | 规则                         |
| ---------- | ------------------------ | ---------------------------- |
| 变色方块   | 宽矩形，覆盖安全车道     | 踩中后球体切换为方块颜色     |
| 三分裂方块 | 三个小方块分布在三条车道 | 必须踩中与球体颜色一致的方块 |
| 双分裂方块 | 两个小方块分布在相邻车道 | 同样要求颜色匹配             |
| 加速方块   | 白色发光轨道             | 触发短时间加速和音乐节奏提升 |

失败条件：

- 落地时没有踩到可吸附方块。
- 踩中分裂方块但颜色不匹配。
- 放弃复活或复活次数耗尽。

通关条件：

- 到达当前关卡目标距离。

## 操作方式

| 输入      | 功能             |
| --------- | ---------------- |
| `←` / `→` | 左右切换车道     |
| `ESC`     | 暂停或返回       |
| `空格`    | 继续、重试或确认 |
| 触屏滑动  | 移动车道         |

## 复活机制

每局最多 3 次复活机会。失败后会进入复活选择界面：

| 方式     | 条件                           | 效果                 |
| -------- | ------------------------------ | -------------------- |
| 广告复活 | 免费，倒计时后生效             | 原地附近安全复活     |
| 分数复活 | 当前分数不低于 50              | 消耗部分分数立即复活 |
| 连击护盾 | 失败前连击达到要求，每局限一次 | 免费立即复活         |

复活后会自动寻找安全目标方块，优先保证球体颜色和落点规则一致，并提供短暂无敌保护，避免旧局倒计时或回调影响新一局。

## 关卡列表

| 关卡 | 名称       | 难度    | BPM | 目标距离 | 音阶风格     |
| ---- | ---------- | ------- | --- | -------- | ------------ |
| 1    | 月球漫步   | EASY    | 96  | 200m     | A 小调五声   |
| 2    | 火星风暴   | EASY    | 96  | 300m     | D Dorian     |
| 3    | 金星熔炉   | NORMAL  | 115 | 400m     | E Phrygian   |
| 4    | 木星漩涡   | NORMAL  | 115 | 500m     | G Mixolydian |
| 5    | 土星光环   | NORMAL  | 115 | 600m     | C Lydian     |
| 6    | 天王星冰原 | HARD    | 144 | 750m     | E 自然小调   |
| 7    | 海王星深渊 | HARD    | 144 | 900m     | C# 和声小调  |
| 8    | 天狼星闪耀 | HARD    | 144 | 1050m    | A 大调五声   |
| 9    | 参宿四脉动 | EXTREME | 173 | 1200m    | Bb 全音阶    |
| 10   | 黑洞边界   | EXTREME | 173 | 1500m    | E 半音阶     |

难度会同时影响前进速度、方块类型概率、加速倍率和容错压力。

## 技术栈

| 模块     | 技术                       |
| -------- | -------------------------- |
| 应用框架 | Vite 5 + TypeScript        |
| 3D 渲染  | Three.js + UnrealBloomPass |
| 音频     | Web Audio API              |
| UI       | 原生 DOM + CSS             |
| 构建优化 | Rollup manualChunks        |
| 代码质量 | TypeScript + Prettier      |

## 项目结构

```text
src/
├── 3d/
│   └── Renderer3D.ts        # Three.js 场景、球体、方块、粒子、后处理和资源释放
├── audio/
│   ├── AudioManager.ts      # Web Audio 引擎、音效、音量设置和调度
│   └── MusicConfig.ts       # 关卡音乐参数和节奏配置
├── game/
│   ├── BallPhysics.ts       # 球体跳跃、车道移动、速度和落地事件
│   ├── ColorMatcher.ts      # 游戏颜色映射
│   ├── GameCore.ts          # 游戏状态机、碰撞、计分、复活和事件分发
│   └── types.ts             # 共享类型和事件类型定义
├── managers/
│   └── TrackManager.ts      # 关卡配置、轨道生成、碰撞查询和自动吸附
├── ui/
│   └── UIManager.ts         # 主菜单、HUD、弹窗和 DOM 生命周期管理
├── utils/
│   └── EventEmitter.ts      # 类型化事件发射器
└── main.ts                  # 应用入口、页面流转、设置持久化和全局清理
```

路径别名：

| 别名          | 目标             |
| ------------- | ---------------- |
| `@/*`         | `src/*`          |
| `@game/*`     | `src/game/*`     |
| `@3d/*`       | `src/3d/*`       |
| `@audio/*`    | `src/audio/*`    |
| `@managers/*` | `src/managers/*` |
| `@ui/*`       | `src/ui/*`       |
| `@utils/*`    | `src/utils/*`    |

## 核心架构

游戏由 `GameCore` 驱动单一 `requestAnimationFrame` 主循环：

```text
GameCore.startGameLoop()
├── BallPhysics.update(dt)
├── TrackManager.updateTrack(ballZ)
├── AudioManager.getBeatInfo()
├── Renderer3D.updateBallState()
├── Renderer3D.updateCameraPosition()
├── Renderer3D.updateBeatEffects()
└── Renderer3D.render()
```

事件通信通过类型化 `EventEmitter` 完成，主要事件包括：

- `game-update`
- `block-hit`
- `game-finished`
- `game-failed`
- `game-revive-offer`
- `game-revived`
- `boost-activated`
- `boost-deactivated`
- `ball-color-changed`
- `lane-changed`

UI 层只订阅事件并更新 DOM，游戏规则保持在 `GameCore`、`BallPhysics` 和 `TrackManager` 内。

## 视觉与界面

主菜单采用深空任务控制台风格，包含轨道动效、任务状态、关卡入口和设置入口。游戏内 HUD 使用悬浮式驾驶舱布局，弱化传统网页面板感，让玩家视线集中在 3D 轨道上。

主要 CSS 入口位于 `public/style.css`，结构大致分为：

- 全局背景、字体和布局。
- 主菜单和任务面板。
- 游戏 HUD、距离条、连击、加速提示。
- 关卡选择、设置页、结果页。
- 暂停、复活等模态弹窗。
- 移动端响应式适配。

## 渲染与资源生命周期

`Renderer3D` 负责管理 Three.js 资源，并在销毁时释放：

- renderer、composer、scene、geometry、material、texture。
- resize 监听器。
- 背景星场、网格、灯光和动态粒子。
- 临时动画通过运行状态保护，避免销毁后继续访问旧 scene。

UI 和主流程同样会在返回菜单、通关、失败、重试和销毁时清理键盘监听、倒计时和复活回调，降低连续开局后的状态残留风险。

## 构建说明

生产构建配置位于 `vite.config.ts`：

- `target: "ES2020"`
- `minify: "terser"`
- `sourcemap: true`
- `three` 单独拆分为 `three` chunk
- 其他第三方依赖拆分为 `vendor` chunk

当前构建输出会将业务代码和 Three.js 分开，降低主 chunk 体积并避免 Vite 默认 500 kB 警告。

## 质量检查

提交前建议运行：

```bash
npm run format
npm run typecheck
npm run lint
npm run build
```

手动验收建议：

- 主菜单、设置、关卡选择之间来回切换，不应残留旧 DOM。
- 连续开始、失败、复活、返回菜单多次，控制台不应出现旧倒计时或事件监听异常。
- 游戏中偏离当前车道落地时，自动吸附应优先选择安全或颜色匹配方块。
- 通关、失败、复活、放弃复活期间返回菜单，不应触发旧局回调。

## 开发约定

- 优先保持原生 DOM 架构，不额外引入 UI 框架。
- 玩法规则优先放在 `src/game` 和 `src/managers`，UI 只展示状态。
- 新增事件时先补充 `src/game/types.ts` 中的事件映射。
- 新增 Three.js 资源时必须确认对应释放路径。
- 样式修改后运行 `npm run format`，保持 CSS 和 TypeScript 统一格式。
