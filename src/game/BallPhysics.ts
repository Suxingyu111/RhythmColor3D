/**
 * 球的物理和运动系统
 * 处理球的跳跃、运动轨迹和碰撞检测
 */

import {
  BallPhysicsEvents,
  BallState,
  ColorType,
  TrackBlock,
} from "@game/types";
import EventEmitter from "@utils/EventEmitter";

export class BallPhysics extends EventEmitter<BallPhysicsEvents> {
  // 球的状态
  private ball: BallState = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isJumping: false,
    currentLane: 1, // 中间车道
    currentColor: ColorType.CYAN, // 初始颜色
  };

  // 物理参数
  // 跳跃参数：jumpForce=20，gravity=32 => 跳跃周期=1.25秒，跳跃高度=6.25
  // 球前进距离 = moveSpeed * 1.25 = 4 * 1.25 = 5 单位 = blockSpacing（完美对齐）
  private jumpForce: number = 20; // 跳跃力度（更高弹跳）
  private gravity: number = 32; // 重力加速度（更慢下落）
  private laneWidth: number = 1; // 车道宽度
  private blockSpacing: number = 5; // 方块间距（更远）
  private jumpDuration: number = 1.25; // 跳跃持续时间（秒）
  private moveSpeed: number = 4; // 球沿 Z 轴的前进速度（单位/秒）

  // 加速状态
  // 数学保证：jumpForce×k, gravity×k², moveSpeed×k 时，跳跃高度不变，速度加快
  // 高度 = (jumpForce×k)² / (2×gravity×k²) = jumpForce²/(2×gravity) = 不变
  // 周期 = 2×jumpForce×k / (gravity×k²) = 2×jumpForce/(gravity×k) = 原周期/k
  // 距离 = moveSpeed×k × 周期/k... 不对，距离 = moveSpeed×k × (2×jumpForce×k)/(gravity×k²) = moveSpeed×2×jumpForce/gravity = blockSpacing
  private baseJumpForce: number = 20; // 基础跳跃力
  private baseGravity: number = 32; // 基础重力
  private baseMoveSpeed: number = 4; // 基础移速
  private boostMultiplier: number = 1; // 当前加速倍率（1=正常）
  private boostEndTime: number = 0; // 加速结束时间戳（秒）

  private isAutoJumping: boolean = false;

  // 防止重复落地
  private lastLandingTime: number = 0;
  private minLandingInterval: number = 0.1; // 最少100ms才能再次着陆

  // 下一帧跳跃标志
  private shouldJumpNextFrame: boolean = false;

  constructor() {
    super();
    this.reset();
  }

  /**
   * 重置球的状态
   */
  reset(): void {
    this.ball = {
      position: { x: 0, y: 0.75, z: 0 }, // 初始化在块表面（Y=0.75）
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      isJumping: false,
      currentLane: 1,
      currentColor: ColorType.CYAN,
    };
    this.isAutoJumping = false;
    this.lastLandingTime = 0;
    this.shouldJumpNextFrame = false;
    // 重置加速状态
    this.boostMultiplier = 1;
    this.boostEndTime = 0;
    this.jumpForce = this.baseJumpForce;
    this.gravity = this.baseGravity;
    this.moveSpeed = this.baseMoveSpeed;
  }

  /**
   * 设置速度倍率（按关卡难度调整物理参数）
   * 公式：moveSpeed×k, jumpForce×k, gravity×k²
   * 保证跳跃高度不变（6.25），落点距离不变（blockSpacing=5）
   * @param k 速度倍率（1.0=EASY, 1.2=NORMAL, 1.5=HARD, 1.8=EXTREME）
   */
  setSpeedMultiplier(k: number): void {
    this.baseMoveSpeed = 4 * k;
    this.baseJumpForce = 20 * k;
    this.baseGravity = 32 * k * k;
    // 同步当前值（非加速状态下）
    if (this.boostMultiplier === 1) {
      this.moveSpeed = this.baseMoveSpeed;
      this.jumpForce = this.baseJumpForce;
      this.gravity = this.baseGravity;
    }
  }

  /**
   * 启动自动跳跃
   */
  jump(): void {
    if (this.isAutoJumping) return;

    this.isAutoJumping = true;
    this.ball.isJumping = true;
    this.ball.velocity.y = this.jumpForce;
  }

  /**
   * 改变车道 - 带方向限制
   * 规则：
   * - 球在左边(lane 0)时：只能往右移动
   * - 球在右边(lane 2)时：只能往左移动
   * - 球在中间(lane 1)时：可以往任何方向移动
   * 关键：改变车道时立即更新X位置，确保球能准确落在新车道的方块上
   * @param newLane 新车道（0 = 左, 1 = 中, 2 = 右）
   */
  changeLane(newLane: number): void {
    // 边界检查
    if (newLane < 0 || newLane > 2) return;

    // 不改变当前车道
    if (newLane === this.ball.currentLane) return;

    const currentLane = this.ball.currentLane;

    if (currentLane === 0) {
      // 球在左边，只能往右（新车道必须 > 0）
      if (newLane <= currentLane) {
        return;
      }
    } else if (currentLane === 2) {
      // 球在右边，只能往左（新车道必须 < 2）
      if (newLane >= currentLane) {
        return;
      }
    }

    this.ball.currentLane = newLane;
    // 改变车道时立即更新X位置
    this.ball.position.x = (newLane - 1) * this.laneWidth;
  }

  /**
   * 相对移动车道 - 每次只移动一个位置
   * 规则同样适用于方向限制
   * @param direction 移动方向：-1 左移，0 移到中间，1 右移
   */
  moveLane(direction: number): void {
    const currentLane = this.ball.currentLane;
    let newLane: number;

    if (direction === 0) {
      // 移到中间
      newLane = 1;
    } else if (direction > 0) {
      // 往右移动一格
      newLane = currentLane + 1;
    } else {
      // 往左移动一格
      newLane = currentLane - 1;
    }

    // 使用 changeLane 来应用方向限制逻辑
    this.changeLane(newLane);
  }

  /**
   * 设置球的颜色
   * @param color 新的颜色
   */
  setColor(color: ColorType): void {
    if (this.ball.currentColor !== color) {
      this.ball.currentColor = color;
      this.emit("color-changed", color);
    }
  }

  /**
   * 获取当前颜色
   */
  getColor(): ColorType {
    return this.ball.currentColor;
  }

  /**
   * 将球快照到方块位置 - 改进版本
   * 规则：
   * - 普通方块（整块）：球保持当前车道位置
   * - 分裂方块：球保持当前车道位置
   * - 其他：对齐到方块的车道
   * @param block 方块对象
   */
  snapToBlock(block: TrackBlock): void {
    let targetX: number;
    let targetLane: number;

    if (!block.isSplit && block.lane === 1) {
      // 长直轨道（宽矩形）：球保持当前车道位置
      targetLane = this.ball.currentLane;
      targetX = (targetLane - 1) * this.laneWidth;
    } else {
      // 分裂方块（两块/三块轨道）：球对齐到方块的车道
      targetLane = block.lane;
      targetX = (block.lane - 1) * this.laneWidth;
      this.ball.currentLane = targetLane;
    }

    // 立即将球X位置设置到目标位置
    this.ball.position.x = targetX;

    // 正确设置球的Y位置：
    // 方块中心在Y=0，高度0.5（范围 Y=-0.25 到 Y=0.25）
    // 方块表面在Y=0.25，球半径0.5
    // 球心应该在Y=0.75（球的底部恰好与方块表面接触）
    this.ball.position.y = 0.75;
    this.ball.velocity.y = 0;

    // Z位置精确对齐到方块位置
    // 这是关键：确保球的Z位置与方块完全匹配，避免浮点精度问题
    this.ball.position.z = block.position;

    // 重置跳跃状态，准备下一次跳跃
    this.isAutoJumping = false;
    this.ball.isJumping = false;

    // 只有长直轨道（非加速方块）才改变球的颜色
    if (!block.isSplit && !block.isBoost) {
      this.setColor(block.color);
    }

    this.emit("snapped-to-block", { block, position: this.ball.position });

    // 检查加速是否到期（只在 snapToBlock 时切换，保证跳跃途中参数恒定）
    this.checkBoostExpiry();
  }

  /**
   * 激活加速 — 保持跳跃高度不变，加快弹跳速度
   * jumpForce×k, gravity×k², moveSpeed×k
   * 高度 = (jumpForce×k)² / (2×gravity×k²) = jumpForce²/(2×gravity) = 不变
   * 周期 = 2×jumpForce×k / (gravity×k²) = 原周期/k（弹跳更快）
   * 距离 = moveSpeed×k × 周期 = moveSpeed×k × 原周期/k = blockSpacing（落点不变）
   * @param multiplier 加速倍率（如 3 表示 3 倍速）
   * @param duration 持续时间（秒）
   */
  activateBoost(multiplier: number, duration: number): void {
    this.boostMultiplier = multiplier;
    this.boostEndTime = Date.now() / 1000 + duration;
    this.jumpForce = this.baseJumpForce * multiplier;
    this.gravity = this.baseGravity * multiplier * multiplier;
    this.moveSpeed = this.baseMoveSpeed * multiplier;
    this.emit("boost-activated", { multiplier, duration });
  }

  /**
   * 取消加速 — 恢复基础物理参数
   */
  deactivateBoost(): void {
    this.boostMultiplier = 1;
    this.boostEndTime = 0;
    this.jumpForce = this.baseJumpForce;
    this.gravity = this.baseGravity;
    this.moveSpeed = this.baseMoveSpeed;
    this.emit("boost-deactivated");
  }

  /**
   * 检查加速是否到期（在 snapToBlock 中调用）
   * 只在球精确对齐方块时切换参数，避免跳跃途中变速导致落点偏移
   */
  private checkBoostExpiry(): void {
    if (this.boostMultiplier > 1 && Date.now() / 1000 >= this.boostEndTime) {
      this.deactivateBoost();
    }
  }

  /**
   * 查询加速是否激活
   */
  isBoostActive(): boolean {
    return this.boostMultiplier > 1;
  }

  /**
   * 更新球的物理状态
   * @param deltaTime 时间差（秒）
   */
  update(deltaTime: number): void {
    // 如果上一帧标记需要跳跃，立即启动跳跃
    if (this.shouldJumpNextFrame) {
      this.shouldJumpNextFrame = false;
      this.isAutoJumping = false;
      this.ball.isJumping = true;
      this.ball.velocity.y = this.jumpForce;
    }

    // 应用重力
    this.ball.velocity.y -= this.gravity * deltaTime;

    // 更新位置
    this.ball.position.y += this.ball.velocity.y * deltaTime;

    // 球自动沿 Z 轴前进
    this.ball.position.z += this.moveSpeed * deltaTime;

    // X轴位置直接对应当前车道
    const targetX = (this.ball.currentLane - 1) * this.laneWidth;
    this.ball.position.x = targetX;

    // 旋转球体（旋转轴 = 运动方向）
    const rotationSpeed = 10;
    this.ball.rotation.x += rotationSpeed * deltaTime;
    this.ball.rotation.z += this.ball.velocity.x * 0.1 * deltaTime;

    // 检查是否着地
    // 块的表面在 Y=0.25 (块高0.5，中心在Y=0)
    // 球的半径0.5，球心与块表面接触时 Y = 0.75
    // 预留缓冲区，Y <= 0.7 时检测落地
    const currentTime = Date.now() / 1000;
    if (
      this.ball.position.y <= 0.7 &&
      this.ball.isJumping &&
      currentTime - this.lastLandingTime > this.minLandingInterval
    ) {
      this.lastLandingTime = currentTime;
      this.ball.position.y = 0.75; // 固定在块表面上方
      this.ball.velocity.y = 0;
      this.ball.isJumping = false;

      // emit 落地事件，让GameCore处理块碰撞
      this.emit("landed", {
        position: this.ball.position,
        lane: this.ball.currentLane,
      });

      // 标记在下一帧跳跃
      this.shouldJumpNextFrame = true;
    }
  }

  /**
   * 检测与方块的碰撞 - 返回碰撞的块对象
   * @param block 方块对象
   * @returns 如果碰撞返回块，否则返回null
   */
  checkCollision(block: TrackBlock): TrackBlock | null {
    // 方块在球的前面或后面太远时不计算
    const distanceToBlock = block.position - this.ball.position.z;
    if (Math.abs(distanceToBlock) > 2) return null;

    // 检查车道是否匹配
    if (this.ball.currentLane !== block.lane) return null;

    // 检查Y轴碰撞（球在方块表面）
    if (this.ball.position.y < 1.5) {
      return block;
    }

    return null;
  }

  /**
   * 获取球的状态
   */
  getState(): BallState {
    return this.ball;
  }

  /**
   * 获取球的位置
   */
  getPosition() {
    return this.ball.position;
  }

  /**
   * 获取球的旋转
   */
  getRotation() {
    return this.ball.rotation;
  }

  /**
   * 获取球的速度
   */
  getVelocity() {
    return this.ball.velocity;
  }

  /**
   * 获取当前车道
   */
  getCurrentLane(): number {
    return this.ball.currentLane;
  }

  /**
   * 轻量重置 — 复活时使用，保留难度倍率，清除加速状态
   * @param z 目标 Z 位置
   * @param lane 目标车道
   * @param color 目标颜色
   */
  softReset(z: number, lane: number, color: ColorType): void {
    this.ball.position.x = (lane - 1) * this.laneWidth;
    this.ball.position.y = 0.75;
    this.ball.position.z = z;
    this.ball.velocity = { x: 0, y: 0, z: 0 };
    this.ball.rotation = { x: 0, y: 0, z: 0 };
    this.ball.isJumping = false;
    this.ball.currentLane = lane;
    this.ball.currentColor = color;
    this.isAutoJumping = false;
    this.shouldJumpNextFrame = false;
    this.lastLandingTime = 0;
    // 保留 baseMoveSpeed/baseJumpForce/baseGravity（难度不变），清除 boost
    this.boostMultiplier = 1;
    this.boostEndTime = 0;
    this.jumpForce = this.baseJumpForce;
    this.gravity = this.baseGravity;
    this.moveSpeed = this.baseMoveSpeed;
  }

  /**
   * isFailed() 方法已移除 - 游戏失败功能已禁用
   */
}

export default BallPhysics;
