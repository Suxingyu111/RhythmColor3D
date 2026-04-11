# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

炫彩节奏3D — 一款基于 Three.js 的 3D 球形跳跃游戏。球在轨道上自动跳跃前进，玩家通过切换车道（左/中/右）踩中颜色方块得分。方块分两种：颜色改变块（改变球的颜色）和颜色匹配块（要求球颜色一致，否则失败）。

## 常用命令

- `npm run dev` — 启动 Vite 开发服务器（端口 5173）
- `npm run build` — 构建生产版本（输出到 dist/，使用 terser 压缩）
- `npm run typecheck` — TypeScript 类型检查（tsc --noEmit）
- `npm run lint` — Prettier 格式检查
- `npm run format` — Prettier 自动格式化

## 架构

项目使用 Vite + TypeScript + Three.js，无框架，纯原生 DOM 操作 UI。

### 核心运行机制

球的 Z 位置固定不动，方块以 `blockSpeed=6` 的速度向球移动（反向滚动）。球只做 Y 轴跳跃和 X 轴车道切换。游戏循环在 `GameCore.startGameLoop()` 中通过 `requestAnimationFrame` 驱动。

### 方块生成规则（TrackManager）

方块按 3 个一组的周期动态生成：
- 周期第 0 个：颜色改变块（`isColorChanger=true`），踩到后球变色
- 周期第 1-2 个：颜色匹配块，要求球颜色与方块一致
- 所有方块当前都在中间车道（lane=1）
- 方块间距 `blockSpacing=3`，提前加载 50 单位

### 系统间通信

所有系统通过自定义 `EventEmitter`（src/utils/）解耦通信：
- `BallPhysics` 发出 `landed`、`color-changed`、`snapped-to-block` 事件
- `GameCore` 监听物理事件并协调 TrackManager 和 Renderer3D
- `GameApp`（main.ts）监听 GameCore 的 `game-update`、`game-finished`、`game-failed` 更新 UI

### 碰撞检测流程

球落地时（Y<=0.7）→ BallPhysics 发出 `landed` → GameCore.handleBallLanded() 在 TrackManager 中搜索碰撞方块（碰撞范围 1.5，还会搜索附近 ±2.5 范围）→ 颜色匹配检查 → 成功则 snapToBlock + 自动跳跃，失败则 failGame()。

### 路径别名

vite.config.ts 和 tsconfig.json 中配置了路径别名：
- `@game` → src/game/
- `@3d` → src/3d/
- `@ui` → src/ui/
- `@managers` → src/managers/
- `@utils` → src/utils/
- `@audio` → src/audio/

### 遗留文件

`src/main.old.ts` 和 `src/game/GameCore.old.ts` 是旧版节奏游戏代码，当前未使用。README.md 中描述的节奏检测/音频系统（RhythmDetector、AudioManager、ScoreManager、LevelManager）属于旧版设计，当前实际运行的是球形跳跃版本。

## 关键物理参数

- 跳跃力：20，重力：50
- 车道宽度：2（X 轴间距）
- 方块尺寸：1.5 x 0.5 x 1.5
- 球半径：0.5，落地 Y 位置：0.75
- 失败条件：Y < -5

## 注意事项

- tsconfig.json 中 `strict: false`，类型检查较宽松
- Renderer3D 依赖 ColorMatcher 的 `colorHexMap` 做颜色转换
- TrackManager 的 `getVisibleBlocks()` 内部会调用 `updateTrack()` 移动方块，GameCore 的游戏循环中也调用了 `updateTrack()`，存在双重调用
