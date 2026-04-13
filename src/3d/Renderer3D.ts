/**
 * 3D渲染系统 - 球形跳跃游戏版本
 * 使用Three.js渲染球、轨道和环境
 * 性能优化版：共享Geometry/Material、精简后处理、无阴影、粒子池化
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BallState, SceneTheme, TrackBlock, ColorType } from "@game/types";
import { colorHexMap } from "@game/ColorMatcher";
import { BeatInfo } from "@audio/AudioManager";

export class Renderer3D {
  // Three.js 场景、相机、渲染器
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  // 后处理（精简版：仅 RenderPass + Bloom）
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  // 灯光
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;

  // 游戏对象
  private ballMesh: THREE.Mesh | null = null;
  private trackBlocks: Map<string, THREE.Mesh> = new Map();

  // 共享 Geometry（避免每个方块独立创建）
  private sharedSplitGeo: THREE.BoxGeometry;
  private sharedFullGeo: THREE.BoxGeometry;
  // Material 缓存（相同颜色+类型复用同一 Material）
  private materialCache: Map<string, THREE.MeshStandardMaterial> = new Map();

  // 球体跟随点光源（局部照明）
  private ballPointLight: THREE.PointLight | null = null;

  // 分裂方块顶面箭头纹理
  private arrowTexture: THREE.CanvasTexture | null = null;
  private sharedArrowGeo: THREE.PlaneGeometry | null = null;
  private sharedArrowMat: THREE.MeshBasicMaterial | null = null;

  // 星空背景
  private starField: THREE.Points | null = null;
  private backgroundObjects: THREE.Object3D[] = [];

  // 球体拖尾
  private trailMesh: THREE.Points | null = null;
  private trailGeometry: THREE.BufferGeometry | null = null;
  private trailPositions: Float32Array | null = null;
  private readonly TRAIL_LENGTH = 20;

  // 落地粒子池（预分配，避免每次 new）
  private landingParticles: THREE.Points | null = null;
  private landingParticleGeo: THREE.BufferGeometry | null = null;
  private landingParticleMat: THREE.PointsMaterial | null = null;
  private landingVelocities: Float32Array | null = null;
  private landingAnimating: boolean = false;
  private landingStartTime: number = 0;
  private readonly PARTICLE_COUNT = 30;
  private readonly PARTICLE_DURATION = 500;

  // 车道切换平滑
  private visualBallX: number = 0;
  private targetBallX: number = 0;
  private readonly LANE_LERP_SPEED = 15;

  // 球体落地缓冲 Y 偏移（视觉层，不影响物理）
  private ballBounceOffsetY: number = 0;

  // 加速粒子风暴（boost 期间持续显示）
  private boostParticles: THREE.Points | null = null;
  private boostParticleGeo: THREE.BufferGeometry | null = null;
  private boostParticleMat: THREE.PointsMaterial | null = null;
  private boostParticleVelocities: Float32Array | null = null;
  private boostActive: boolean = false;
  private readonly BOOST_PARTICLE_COUNT = 1000;

  // 相机跟踪（复用 Vector3 避免每帧 new）
  private cameraOffset = { x: 0, y: 5, z: -8 };
  private lookAtTarget = new THREE.Vector3();

  // 轨道坡度：10度上倾（视觉效果，物理层不变）
  private trackSlope: number = Math.tan((10 * Math.PI) / 180);

  // 渲染状态
  private isRunning: boolean = false;
  private disposed: boolean = false;
  private readonly resizeHandler = () => this.onWindowResize();
  private animationFrameIds: Set<number> = new Set();

  // 节拍视觉响应状态
  private baseFOV: number = 75;
  private cameraShakeDecay: number = 0;
  private cameraShakeIntensity: number = 0;
  private lastUpdateTime: number = 0;
  private currentDt: number = 0.016;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.Fog(0x050510, 80, 300);

    // 初始化相机
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, -8);

    // 初始化渲染器（开启原生 MSAA 抗锯齿，替代 FXAA）
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 灯光 — 中性偏亮环境光
    this.ambientLight = new THREE.AmbientLight(0x8899bb, 0.6);
    this.scene.add(this.ambientLight);

    // 主方向光（无阴影，增强反光）
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.directionalLight.position.set(10, 20, 10);
    this.scene.add(this.directionalLight);

    // 蓝色补光（增强，减少暗面死黑）
    const fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
    fillLight.position.set(-5, -3, 5);
    this.scene.add(fillLight);
    this.backgroundObjects.push(fillLight);

    // 预创建共享 Geometry
    this.sharedSplitGeo = new THREE.BoxGeometry(0.8, 0.15, 1.0);
    this.sharedFullGeo = new THREE.BoxGeometry(5.0, 0.15, 1.0);

    // 生成箭头纹理（用于分裂方块顶面）
    this.arrowTexture = this.createArrowTexture();
    this.sharedArrowGeo = new THREE.PlaneGeometry(0.5, 0.6);
    this.sharedArrowMat = new THREE.MeshBasicMaterial({
      map: this.arrowTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    // 创建背景
    this.createBackground();

    // 设置后处理管线（精简版）
    this.setupPostProcessing();

    // 预分配落地粒子池
    this.initLandingParticlePool();

    // 预分配加速粒子池
    this.initBoostParticlePool();

    // 处理窗口resize
    window.addEventListener("resize", this.resizeHandler);

    console.log("Renderer3D: Initialized");
  }

  private scheduleAnimationFrame(callback: () => void): void {
    if (this.disposed) return;
    const id = requestAnimationFrame(() => {
      this.animationFrameIds.delete(id);
      if (!this.disposed) {
        callback();
      }
    });
    this.animationFrameIds.add(id);
  }

  /**
   * 设置后处理管线：仅 RenderPass + Bloom（精简版）
   */
  private setupPostProcessing(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.composer = new EffectComposer(this.renderer);

    // Pass 1: 渲染场景
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Pass 2: Bloom — 降低强度
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.7, // strength（辉光更明显）
      0.4, // radius（辉光扩散更柔和）
      0.6, // threshold（降低阈值，更多物体产生辉光）
    );
    this.composer.addPass(this.bloomPass);
  }

  /**
   * 创建星空粒子背景
   */
  private createBackground(): void {
    // 网格（低可见度）
    const gridHelper = new THREE.GridHelper(200, 20, 0x222233, 0x111122);
    gridHelper.position.z = 100;
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.opacity = 0.3;
    gridMat.transparent = true;
    this.scene.add(gridHelper);
    this.backgroundObjects.push(gridHelper);

    // 星空粒子 — 2000 个点，球形分布
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 100 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = Math.abs(radius * Math.cos(phi)) * 0.5 + 5;
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const b = 0.5 + Math.random() * 0.5;
      colors[i3] = b * (0.7 + Math.random() * 0.3);
      colors[i3 + 1] = b * (0.7 + Math.random() * 0.3);
      colors[i3 + 2] = b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.starField = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    );
    this.scene.add(this.starField);
    this.backgroundObjects.push(this.starField);
  }

  /**
   * 预分配落地粒子池
   */
  private initLandingParticlePool(): void {
    const positions = new Float32Array(this.PARTICLE_COUNT * 3);
    this.landingVelocities = new Float32Array(this.PARTICLE_COUNT * 3);

    this.landingParticleGeo = new THREE.BufferGeometry();
    this.landingParticleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );

    this.landingParticleMat = new THREE.PointsMaterial({
      size: 0.2,
      color: 0x00aaff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.landingParticles = new THREE.Points(
      this.landingParticleGeo,
      this.landingParticleMat,
    );
    this.landingParticles.visible = false;
    this.scene.add(this.landingParticles);
  }

  /**
   * 预分配加速粒子池 — 背景翻涌粒子风暴
   * 120 颗粒子在球周围大范围翻涌，颜色跟随球体
   */
  private initBoostParticlePool(): void {
    const count = this.BOOST_PARTICLE_COUNT;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    this.boostParticleVelocities = new Float32Array(count * 3);

    // 初始化粒子在原点附近（启动时会重置到球周围）
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 60;
      positions[i3 + 1] = Math.random() * 25 + 0.5;
      positions[i3 + 2] = (Math.random() - 0.5) * 70;
      sizes[i] = 0.08 + Math.random() * 0.25; // 适中粒子，清晰可见

      // 速度：主要向后飘（模拟高速前进的风），加上随机翻涌
      this.boostParticleVelocities[i3] = (Math.random() - 0.5) * 6;
      this.boostParticleVelocities[i3 + 1] = (Math.random() - 0.5) * 4;
      this.boostParticleVelocities[i3 + 2] = -(12 + Math.random() * 18); // 向后飘
    }

    this.boostParticleGeo = new THREE.BufferGeometry();
    this.boostParticleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.boostParticleGeo.setAttribute(
      "size",
      new THREE.BufferAttribute(sizes, 1),
    );

    this.boostParticleMat = new THREE.PointsMaterial({
      size: 0.15,
      color: 0x00aaff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.boostParticles = new THREE.Points(
      this.boostParticleGeo,
      this.boostParticleMat,
    );
    this.boostParticles.visible = false;
    this.boostParticles.frustumCulled = false; // 禁用视锥体剔除，防止球远离原点后粒子被错误裁剪
    this.scene.add(this.boostParticles);
  }

  /**
   * 启动加速粒子风暴
   */
  startBoostParticles(): void {
    if (
      !this.boostParticles ||
      !this.boostParticleMat ||
      !this.boostParticleGeo ||
      !this.boostParticleVelocities
    )
      return;
    this.boostActive = true;
    this.boostParticles.visible = true;
    this.boostParticleMat.opacity = 0.7;

    // 加速 FOV 拉宽 + bloom 增强
    this.baseFOV = 82;
    if (this.bloomPass) this.bloomPass.threshold = 0.4;

    // 同步粒子颜色为球体当前颜色
    if (this.ballMesh) {
      const ballColor = (
        this.ballMesh.material as THREE.MeshStandardMaterial
      ).color.getHex();
      this.boostParticleMat.color.setHex(ballColor);

      // 关键：每次激活时重置所有粒子位置到球周围，防止二次激活时粒子不可见
      const posAttr = this.boostParticleGeo.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const bx = this.ballMesh.position.x;
      const by = this.ballMesh.position.y;
      const bz = this.ballMesh.position.z;
      const count = this.BOOST_PARTICLE_COUNT;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // 在球周围超大范围随机分布，覆盖整个视野，密密麻麻
        arr[i3] = bx + (Math.random() - 0.5) * 60;
        arr[i3 + 1] = by + Math.random() * 25 + 0.5;
        arr[i3 + 2] = bz + (Math.random() - 0.5) * 70;

        // 重置速度
        this.boostParticleVelocities[i3] = (Math.random() - 0.5) * 6;
        this.boostParticleVelocities[i3 + 1] = (Math.random() - 0.5) * 4;
        this.boostParticleVelocities[i3 + 2] = -(12 + Math.random() * 18);
      }
      posAttr.needsUpdate = true;
    }
  }

  /**
   * 停止加速粒子风暴
   */
  stopBoostParticles(): void {
    this.boostActive = false;
    // 恢复 FOV + bloom
    this.baseFOV = 75;
    if (this.bloomPass) this.bloomPass.threshold = 0.6;
    // 淡出后隐藏
    if (this.boostParticles) this.boostParticles.visible = false;
    if (this.boostParticleMat) this.boostParticleMat.opacity = 0;
  }

  /**
   * 更新加速粒子（每帧调用）
   * 粒子围绕球体翻涌，向后飘散，循环重生
   */
  private updateBoostParticles(): void {
    if (
      !this.boostActive ||
      !this.boostParticleGeo ||
      !this.boostParticleVelocities ||
      !this.ballMesh
    )
      return;

    const posAttr = this.boostParticleGeo.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const ballPos = this.ballMesh.position;
    const dt = this.currentDt;
    const count = this.BOOST_PARTICLE_COUNT;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // 更新位置
      arr[i3] += this.boostParticleVelocities[i3] * dt;
      arr[i3 + 1] += this.boostParticleVelocities[i3 + 1] * dt;
      arr[i3 + 2] += this.boostParticleVelocities[i3 + 2] * dt;

      // 轻微翻涌扰动（正弦波）
      const time = Date.now() * 0.001;
      arr[i3] += Math.sin(time * 2 + i) * 0.06;
      arr[i3 + 1] += Math.cos(time * 1.5 + i * 0.7) * 0.04;

      // 检查粒子是否飘出范围，重生到球前方
      const relZ = arr[i3 + 2] - ballPos.z;
      const relX = arr[i3] - ballPos.x;
      const relY = arr[i3 + 1] - ballPos.y;

      if (
        relZ < -40 ||
        relZ > 40 ||
        Math.abs(relX) > 35 ||
        relY < -3 ||
        relY > 28
      ) {
        // 重生到球周围随机位置（偏前方）
        arr[i3] = ballPos.x + (Math.random() - 0.5) * 50;
        arr[i3 + 1] = ballPos.y + Math.random() * 20 + 0.5;
        arr[i3 + 2] = ballPos.z + 5 + Math.random() * 35;

        // 重新分配速度
        this.boostParticleVelocities[i3] = (Math.random() - 0.5) * 6;
        this.boostParticleVelocities[i3 + 1] = (Math.random() - 0.5) * 4;
        this.boostParticleVelocities[i3 + 2] = -(12 + Math.random() * 18);
      }
    }

    posAttr.needsUpdate = true;
  }

  /**
   * 创建球体
   */
  createBall(radius: number = 0.5): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x00aaff,
      emissiveIntensity: 0.8,
    });

    this.ballMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.ballMesh);

    // 创建球体跟随点光源
    this.ballPointLight = new THREE.PointLight(0xffffff, 0.8, 15, 2);
    this.scene.add(this.ballPointLight);

    // 初始化拖尾
    this.initTrail();

    return this.ballMesh;
  }

  /**
   * 初始化球体拖尾效果
   */
  private initTrail(): void {
    this.trailPositions = new Float32Array(this.TRAIL_LENGTH * 3);

    // 预计算每个点的大小和透明度（头大尾小，二次衰减）
    const sizes = new Float32Array(this.TRAIL_LENGTH);
    const opacities = new Float32Array(this.TRAIL_LENGTH);
    for (let i = 0; i < this.TRAIL_LENGTH; i++) {
      const t = i / (this.TRAIL_LENGTH - 1); // 0=头部, 1=尾部
      sizes[i] = 0.5 * (1 - t * t); // 0.5→0 二次衰减
      opacities[i] = 1.0 - t * t; // 1.0→0 二次衰减
    }

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPositions, 3),
    );
    this.trailGeometry.setAttribute(
      "aSize",
      new THREE.BufferAttribute(sizes, 1),
    );
    this.trailGeometry.setAttribute(
      "aOpacity",
      new THREE.BufferAttribute(opacities, 1),
    );

    const trailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x00aaff) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        varying float vOpacity;
        void main() {
          vOpacity = aOpacity;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = vOpacity * (1.0 - d * 2.0);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.trailMesh = new THREE.Points(this.trailGeometry, trailMaterial);
    this.scene.add(this.trailMesh);
  }

  /**
   * 更新拖尾效果（每帧调用）
   */
  private updateTrail(): void {
    if (!this.ballMesh || !this.trailPositions || !this.trailGeometry) return;

    for (let i = this.TRAIL_LENGTH - 1; i > 0; i--) {
      this.trailPositions[i * 3] = this.trailPositions[(i - 1) * 3];
      this.trailPositions[i * 3 + 1] = this.trailPositions[(i - 1) * 3 + 1];
      this.trailPositions[i * 3 + 2] = this.trailPositions[(i - 1) * 3 + 2];
    }

    this.trailPositions[0] = this.ballMesh.position.x;
    this.trailPositions[1] = this.ballMesh.position.y;
    this.trailPositions[2] = this.ballMesh.position.z;

    const posAttr = this.trailGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }

  /**
   * 更新落地粒子动画（每帧调用，池化版本）
   */
  private updateLandingParticles(): void {
    if (
      !this.landingAnimating ||
      !this.landingParticleGeo ||
      !this.landingParticleMat ||
      !this.landingVelocities
    )
      return;

    const elapsed = Date.now() - this.landingStartTime;
    const t = Math.min(elapsed / this.PARTICLE_DURATION, 1.0);
    const posArray = (
      this.landingParticleGeo.getAttribute("position") as THREE.BufferAttribute
    ).array as Float32Array;

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArray[i3] += this.landingVelocities[i3] * this.currentDt;
      posArray[i3 + 1] += this.landingVelocities[i3 + 1] * this.currentDt;
      posArray[i3 + 2] += this.landingVelocities[i3 + 2] * this.currentDt;
      this.landingVelocities[i3 + 1] -= 5 * this.currentDt;
    }
    (
      this.landingParticleGeo.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    this.landingParticleMat.opacity = 0.8 * (1 - t);

    if (t >= 1.0) {
      this.landingAnimating = false;
      if (this.landingParticles) this.landingParticles.visible = false;
    }
  }

  /**
   * 更新球的颜色
   */
  updateBallColor(color: ColorType): void {
    if (!this.ballMesh || !this.ballMesh.material) return;

    const hexColorString = colorHexMap[color];
    const hexColor = parseInt(hexColorString.substring(1), 16);
    const material = this.ballMesh.material as THREE.MeshStandardMaterial;

    // 变色闪光：先白闪 + 缩放弹跳，再过渡到目标颜色
    material.emissive.setHex(0xffffff);
    material.emissiveIntensity = 2.5;
    this.ballMesh.scale.setScalar(1.3);

    const targetColor = new THREE.Color(hexColor);
    const flashStart = Date.now();
    const flashDuration = 300;

    const animateFlash = () => {
      const t = Math.min((Date.now() - flashStart) / flashDuration, 1.0);
      // emissive 从白色 lerp 到目标颜色
      material.emissive.setRGB(
        1 + (targetColor.r - 1) * t,
        1 + (targetColor.g - 1) * t,
        1 + (targetColor.b - 1) * t,
      );
      material.emissiveIntensity = 2.5 + (0.8 - 2.5) * t;
      // 缩放弹回
      const s = 1.3 + (1.0 - 1.3) * t;
      this.ballMesh!.scale.setScalar(s);

      if (t < 1.0) {
        this.scheduleAnimationFrame(animateFlash);
      }
    };
    this.scheduleAnimationFrame(animateFlash);

    material.color.setHex(hexColor);

    // 同步拖尾颜色（ShaderMaterial uniform）
    if (this.trailMesh) {
      const trailMat = this.trailMesh.material as THREE.ShaderMaterial;
      if (trailMat.uniforms?.uColor) {
        trailMat.uniforms.uColor.value.setHex(hexColor);
      }
    }
  }

  /**
   * 播放球的反弹效果（挤压动画 + 下沉缓冲）
   */
  playBallBounceEffect(): void {
    if (!this.ballMesh) return;

    // 下沉缓冲动画：球先下压再弹回
    const cushionDuration = 250;
    const cushionDepth = -0.25;
    const cushionStart = Date.now();

    const animateCushion = () => {
      const elapsed = Date.now() - cushionStart;
      const t = Math.min(elapsed / cushionDuration, 1.0);
      if (t < 0.3) {
        // 快速下沉
        this.ballBounceOffsetY = cushionDepth * (t / 0.3);
      } else {
        // 弹性回弹
        const bt = (t - 0.3) / 0.7;
        this.ballBounceOffsetY =
          cushionDepth * (1 - bt) * Math.cos(bt * Math.PI * 0.5);
      }
      if (t < 1.0) {
        this.scheduleAnimationFrame(animateCushion);
      } else {
        this.ballBounceOffsetY = 0;
      }
    };
    this.scheduleAnimationFrame(animateCushion);

    // 挤压动画
    const squashFrames = [
      { sx: 1.2, sy: 0.7, sz: 1.2 },
      { sx: 0.9, sy: 1.15, sz: 0.9 },
      { sx: 1.0, sy: 1.0, sz: 1.0 },
    ];
    let frameIndex = 0;

    const bounceInterval = setInterval(() => {
      if (this.disposed) {
        clearInterval(bounceInterval);
        return;
      }
      if (frameIndex < squashFrames.length && this.ballMesh) {
        const f = squashFrames[frameIndex];
        this.ballMesh.scale.set(f.sx, f.sy, f.sz);
        frameIndex++;
      } else {
        clearInterval(bounceInterval);
        if (this.ballMesh) this.ballMesh.scale.set(1, 1, 1);
      }
    }, 60);
  }

  /**
   * 播放涟漪扩散效果 — 能量冲击波 + 水平扩散粒子 + 方块闪烁
   *
   * 视觉构成：
   *   1) 两层自定义 Shader 矩形冲击波（内层实心脉冲 + 外层边缘环）
   *   2) 水平扩散粒子（边缘火花 24 颗 + 中心放射 12 颗，贴地扩散）
   *   3) 方块自身 emissive 爆闪
   *
   * 性能预算：2 ShaderMaterial + 1 PointsMaterial
   * 全部在 700ms 后 dispose
   */
  playRippleEffect(blockId: string): void {
    const mesh = this.trackBlocks.get(blockId);
    if (!mesh) return;

    const blockColor = (
      mesh.material as THREE.MeshStandardMaterial
    ).color.getHex();
    const color3 = new THREE.Color(blockColor);
    const pos = mesh.position.clone();
    const isSplit = mesh.geometry === this.sharedSplitGeo;
    // 方块基础尺寸
    const baseW = isSplit ? 0.8 : 5.0;
    const baseD = 1.0;

    // 收集所有需要清理的对象
    const disposables: {
      obj: THREE.Object3D;
      geo?: THREE.BufferGeometry;
      mat?: THREE.Material;
    }[] = [];

    // ========== 1) 自定义 Shader 矩形冲击波 ==========
    // 顶点着色器：标准平面变换，传递 UV
    const shockwaveVert = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    // 片元着色器：矩形 SDF 驱动的能量环
    // uProgress 0→1 控制扩散，uMode 区分内层脉冲(0)和外层环(1)
    const shockwaveFrag = /* glsl */ `
      uniform vec3 uColor;
      uniform float uProgress;
      uniform float uMode;
      varying vec2 vUv;

      void main() {
        // 将 UV 映射到 [-1, 1]
        vec2 p = (vUv - 0.5) * 2.0;

        // 矩形 SDF（切比雪夫距离）
        float rectDist = max(abs(p.x), abs(p.y));

        // 当前冲击波前沿位置（缓出曲线）
        float front = uProgress * uProgress * (3.0 - 2.0 * uProgress);

        if (uMode < 0.5) {
          // 内层：实心能量脉冲，从中心向外填充再消散
          float fill = smoothstep(front, front - 0.3, rectDist);
          // 边缘额外亮度
          float edgeGlow = smoothstep(0.02, 0.0, abs(rectDist - front)) * 2.0;
          float alpha = (fill * 0.4 + edgeGlow) * (1.0 - uProgress);
          // 颜色从白色核心渐变到主色
          vec3 col = mix(vec3(1.0), uColor, smoothstep(0.0, 0.5, rectDist));
          gl_FragColor = vec4(col, alpha);
        } else {
          // 外层：纯边缘能量环
          float ringWidth = 0.08 + 0.04 * sin(uProgress * 12.0);
          float ring = smoothstep(ringWidth, 0.0, abs(rectDist - front));
          // 四角额外强化（矩形特征）
          float corner = smoothstep(0.6, 1.0, abs(p.x) + abs(p.y));
          float alpha = ring * (1.2 + corner * 0.8) * (1.0 - uProgress * uProgress);
          gl_FragColor = vec4(uColor * 1.5, alpha);
        }
      }
    `;

    // 创建两层冲击波（内层脉冲 + 外层环，外层稍大稍延迟）
    const waveConfigs = [
      { mode: 0, scale: 1.8, delay: 0.0 }, // 内层实心脉冲
      { mode: 1, scale: 2.5, delay: 0.08 }, // 外层能量环
    ];

    for (const cfg of waveConfigs) {
      const geo = new THREE.PlaneGeometry(baseW * cfg.scale, baseD * cfg.scale);
      const mat = new THREE.ShaderMaterial({
        vertexShader: shockwaveVert,
        fragmentShader: shockwaveFrag,
        uniforms: {
          uColor: { value: color3.clone() },
          uProgress: { value: 0.0 },
          uMode: { value: cfg.mode },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const wave = new THREE.Mesh(geo, mat);
      wave.position.set(pos.x, pos.y + 0.12, pos.z);
      wave.rotation.x = -Math.PI / 2;
      this.scene.add(wave);
      disposables.push({ obj: wave, geo, mat });
    }

    // ========== 2) 水平扩散粒子（边缘火花 + 中心爆发） ==========
    const sparkCount = 36;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    const halfW = baseW / 2;
    const halfD = baseD / 2;

    for (let i = 0; i < sparkCount; i++) {
      const i3 = i * 3;

      if (i < 24) {
        // 前 24 颗：沿矩形边缘均匀分布
        const edge = i % 4;
        let ex = 0,
          ez = 0;
        const ratio = (Math.floor(i / 4) + Math.random()) / Math.ceil(24 / 4);
        if (edge === 0) {
          ex = -halfW + ratio * baseW;
          ez = -halfD;
        } else if (edge === 1) {
          ex = halfW;
          ez = -halfD + ratio * baseD;
        } else if (edge === 2) {
          ex = halfW - ratio * baseW;
          ez = halfD;
        } else {
          ex = -halfW;
          ez = halfD - ratio * baseD;
        }

        sparkPositions[i3] = pos.x + ex;
        sparkPositions[i3 + 1] = pos.y + 0.15;
        sparkPositions[i3 + 2] = pos.z + ez;

        // 速度：纯水平向外扩散，不向上
        const nx =
          edge === 1 ? 1 : edge === 3 ? -1 : (Math.random() - 0.5) * 0.5;
        const nz =
          edge === 0 ? -1 : edge === 2 ? 1 : (Math.random() - 0.5) * 0.5;
        const speed = 2.5 + Math.random() * 3.5;
        sparkVelocities[i3] = nx * speed;
        sparkVelocities[i3 + 1] = 0.1 + Math.random() * 0.3; // 极小的 Y 分量，贴地扩散
        sparkVelocities[i3 + 2] = nz * speed;
      } else {
        // 后 12 颗：从中心向四周放射状爆发
        const angle = ((i - 24) / 12) * Math.PI * 2 + Math.random() * 0.3;
        sparkPositions[i3] = pos.x;
        sparkPositions[i3 + 1] = pos.y + 0.15;
        sparkPositions[i3 + 2] = pos.z;

        const speed = 3.0 + Math.random() * 4.0;
        sparkVelocities[i3] = Math.cos(angle) * speed;
        sparkVelocities[i3 + 1] = 0.05 + Math.random() * 0.2; // 贴地
        sparkVelocities[i3 + 2] = Math.sin(angle) * speed;
      }
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(sparkPositions, 3),
    );
    const sparkMat = new THREE.PointsMaterial({
      size: 0.15,
      color: blockColor,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    this.scene.add(sparks);
    disposables.push({ obj: sparks, geo: sparkGeo, mat: sparkMat });

    // ========== 3) 方块自身闪烁 ==========
    const origMat = mesh.material as THREE.MeshStandardMaterial;
    const origEmissive = origMat.emissiveIntensity;
    origMat.emissiveIntensity = 3.0; // 瞬间爆闪

    // ========== 动画循环 ==========
    const duration = 700;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1.0);

      // --- 方块闪烁衰减（前 30% 时间内快速回落）---
      if (origMat.emissiveIntensity > origEmissive) {
        const flashT = Math.min(t / 0.3, 1.0);
        origMat.emissiveIntensity =
          origEmissive + (3.0 - origEmissive) * (1.0 - flashT * flashT);
      }

      // --- 冲击波 Shader uniform 更新 ---
      for (let i = 0; i < waveConfigs.length; i++) {
        const cfg = waveConfigs[i];
        const mat = disposables[i].mat as THREE.ShaderMaterial;
        const localT = Math.max(0, (t - cfg.delay) / (1.0 - cfg.delay));
        mat.uniforms.uProgress.value = Math.min(localT, 1.0);
      }

      // --- 火花粒子物理更新（纯水平扩散） ---
      const dt = this.currentDt;
      const sparkPosAttr = sparkGeo.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const arr = sparkPosAttr.array as Float32Array;
      for (let i = 0; i < sparkCount; i++) {
        const i3 = i * 3;
        arr[i3] += sparkVelocities[i3] * dt;
        arr[i3 + 1] += sparkVelocities[i3 + 1] * dt;
        arr[i3 + 2] += sparkVelocities[i3 + 2] * dt;
        // 轻微下沉（贴地效果）
        sparkVelocities[i3 + 1] -= 0.5 * dt;
        if (arr[i3 + 1] < pos.y + 0.05) {
          arr[i3 + 1] = pos.y + 0.05;
          sparkVelocities[i3 + 1] = 0;
        }
        // 空气阻力
        sparkVelocities[i3] *= 0.96;
        sparkVelocities[i3 + 2] *= 0.96;
      }
      sparkPosAttr.needsUpdate = true;
      // 火花透明度：快速出现，后半段衰减
      sparkMat.opacity = Math.max(0, 1.0 - t * t);
      // 火花尺寸随时间缩小
      sparkMat.size = 0.18 * (1.0 - t * 0.6);

      if (t < 1.0) {
        this.scheduleAnimationFrame(animate);
      } else {
        // 确保方块恢复
        origMat.emissiveIntensity = origEmissive;
        // 清理所有临时对象
        for (const d of disposables) {
          this.scene.remove(d.obj);
          d.geo?.dispose();
          d.mat?.dispose();
        }
      }
    };

    this.scheduleAnimationFrame(animate);
  }

  /**
   * 播放跳板反弹动画
   */
  playPadBounceEffect(blockId: string): void {
    const mesh = this.trackBlocks.get(blockId);
    if (!mesh) return;

    const originalY = mesh.position.y;
    const pressDepth = -0.15;
    const duration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1.0);

      if (t < 0.3) {
        mesh.position.y = originalY + pressDepth * (t / 0.3);
      } else {
        const bounceT = (t - 0.3) / 0.7;
        const elastic =
          1 - Math.pow(1 - bounceT, 3) * Math.cos(bounceT * Math.PI * 2);
        mesh.position.y = originalY + pressDepth * (1 - elastic);
      }

      if (t < 1.0) {
        this.scheduleAnimationFrame(animate);
      } else {
        mesh.position.y = originalY;
      }
    };

    this.scheduleAnimationFrame(animate);
  }

  /**
   * 播放落地粒子爆发效果（池化版本，无 new 操作）
   */
  playLandingParticlesAtBall(): void {
    if (
      !this.ballMesh ||
      !this.landingParticleGeo ||
      !this.landingParticleMat ||
      !this.landingVelocities ||
      !this.landingParticles
    )
      return;

    const pos = this.ballMesh.position;
    const ballColor = (
      this.ballMesh.material as THREE.MeshStandardMaterial
    ).color.getHex();
    const posArray = (
      this.landingParticleGeo.getAttribute("position") as THREE.BufferAttribute
    ).array as Float32Array;

    // 重置所有粒子位置和速度
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArray[i3] = pos.x;
      posArray[i3 + 1] = pos.y;
      posArray[i3 + 2] = pos.z;
      this.landingVelocities[i3] = (Math.random() - 0.5) * 4;
      this.landingVelocities[i3 + 1] = Math.random() * 2 + 0.5;
      this.landingVelocities[i3 + 2] = (Math.random() - 0.5) * 4;
    }
    (
      this.landingParticleGeo.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;

    this.landingParticleMat.color.setHex(ballColor);
    this.landingParticleMat.opacity = 0.8;
    this.landingParticles.visible = true;
    this.landingAnimating = true;
    this.landingStartTime = Date.now();
  }

  /**
   * 播放球体破裂效果
   */
  playBallExplodeEffect(): void {
    if (!this.ballMesh) return;

    const pos = this.ballMesh.position.clone();
    const ballColor = (
      this.ballMesh.material as THREE.MeshStandardMaterial
    ).color.getHex();

    // 隐藏球体和拖尾
    this.ballMesh.visible = false;
    if (this.trailMesh) this.trailMesh.visible = false;

    const fragments: THREE.Mesh[] = [];
    const fragmentVelocities = new Map<THREE.Mesh, THREE.Vector3>();
    const fragmentCount = 12;
    const fragmentGeo = new THREE.SphereGeometry(0.12, 8, 8);

    for (let i = 0; i < fragmentCount; i++) {
      const fragMat = new THREE.MeshStandardMaterial({
        color: ballColor,
        emissive: ballColor,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 1.0,
      });
      const frag = new THREE.Mesh(fragmentGeo, fragMat);
      frag.position.copy(pos);
      fragmentVelocities.set(
        frag,
        new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 6,
        ),
      );
      this.scene.add(frag);
      fragments.push(frag);
    }

    const startTime = Date.now();
    const duration = 800;

    const animateFragments = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1.0);

      for (const frag of fragments) {
        const vel = fragmentVelocities.get(frag);
        if (!vel) continue;
        frag.position.x += vel.x * 0.016;
        frag.position.y += vel.y * 0.016;
        frag.position.z += vel.z * 0.016;
        vel.y -= 9.8 * 0.016;
        const scale = 1.0 - t * 0.8;
        frag.scale.set(scale, scale, scale);
        (frag.material as THREE.MeshStandardMaterial).opacity = 1.0 - t;
      }

      if (t < 1.0) {
        this.scheduleAnimationFrame(animateFragments);
      } else {
        for (const frag of fragments) {
          this.scene.remove(frag);
          (frag.material as THREE.MeshStandardMaterial).dispose();
        }
        fragmentGeo.dispose();
      }
    };

    this.scheduleAnimationFrame(animateFragments);

    // 死亡红闪：环境光变红 + bloom 飙升，600ms 恢复
    const savedAmbientColor = this.ambientLight.color.clone();
    const savedAmbientIntensity = this.ambientLight.intensity;
    const savedBloomStrength = this.bloomPass ? this.bloomPass.strength : 0.7;

    this.ambientLight.color.set(0xff2222);
    this.ambientLight.intensity = 1.5;
    if (this.bloomPass) this.bloomPass.strength = 1.5;

    const flashStart = Date.now();
    const flashDuration = 600;
    const animateRedFlash = () => {
      const t = Math.min((Date.now() - flashStart) / flashDuration, 1.0);
      this.ambientLight.color.lerpColors(
        new THREE.Color(0xff2222),
        savedAmbientColor,
        t,
      );
      this.ambientLight.intensity = 1.5 + (savedAmbientIntensity - 1.5) * t;
      if (this.bloomPass) {
        this.bloomPass.strength = 1.5 + (savedBloomStrength - 1.5) * t;
      }
      if (t < 1.0) this.scheduleAnimationFrame(animateRedFlash);
    };
    this.scheduleAnimationFrame(animateRedFlash);
  }

  /**
   * 用 Canvas 动态生成白色向前箭头纹理（透明背景）
   */
  private createArrowTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // 透明背景
    ctx.clearRect(0, 0, size, size);

    // 白色箭头，指向 +Z 方向（球的前进方向）
    // canvas 顶部经 -PI/2 旋转后映射到 -Z，所以箭头尖端画在 canvas 底部
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    // 箭头矩形尾部（canvas 顶部 → 世界 -Z）
    ctx.moveTo(size * 0.4, size * 0.15); // 左上
    ctx.lineTo(size * 0.6, size * 0.15); // 右上
    ctx.lineTo(size * 0.6, size * 0.5); // 右内
    // 箭头三角形头部（canvas 底部 → 世界 +Z）
    ctx.lineTo(size * 0.8, size * 0.5); // 右翼
    ctx.lineTo(size * 0.5, size * 0.85); // 尖端
    ctx.lineTo(size * 0.2, size * 0.5); // 左翼
    ctx.lineTo(size * 0.4, size * 0.5); // 左内
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 获取或创建缓存 Material
   */
  private getCachedMaterial(
    hexColor: number,
    isColorChanger: boolean,
  ): THREE.MeshStandardMaterial {
    const key = `${hexColor}_${isColorChanger ? 1 : 0}`;
    let mat = this.materialCache.get(key);
    if (!mat) {
      mat = isColorChanger
        ? new THREE.MeshStandardMaterial({
            color: hexColor,
            metalness: 0.7,
            roughness: 0.15,
            emissive: hexColor,
            emissiveIntensity: 0.8,
          })
        : new THREE.MeshStandardMaterial({
            color: hexColor,
            metalness: 0.6,
            roughness: 0.2,
            emissive: hexColor,
            emissiveIntensity: 0.4,
          });
      this.materialCache.set(key, mat);
    }
    return mat;
  }

  /**
   * 创建轨道方块 - 共享 Geometry + 缓存 Material
   */
  createTrackBlock(block: TrackBlock): THREE.Mesh {
    const hexColorString = colorHexMap[block.color];
    const hexColor = parseInt(hexColorString.substring(1), 16);

    // 加速方块使用特殊发光白色材质
    let material: THREE.MeshStandardMaterial;
    if (block.isBoost) {
      const boostKey = "boost_white";
      let mat = this.materialCache.get(boostKey);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.3,
          roughness: 0.1,
          emissive: 0xffffff,
          emissiveIntensity: 0.8,
        });
        this.materialCache.set(boostKey, mat);
      }
      material = mat;
    } else {
      material = this.getCachedMaterial(hexColor, block.isColorChanger);
    }
    const geometry = block.isSplit ? this.sharedSplitGeo : this.sharedFullGeo;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (block.lane - 1) * 1;
    mesh.position.z = block.position;
    mesh.position.y = 0.075 + block.position * this.trackSlope;

    // 分裂方块（正方形）顶面贴白色箭头
    if (block.isSplit && this.sharedArrowGeo && this.sharedArrowMat) {
      const arrowMesh = new THREE.Mesh(
        this.sharedArrowGeo,
        this.sharedArrowMat,
      );
      // 放在方块顶面上方一点，避免 Z-fighting
      arrowMesh.rotation.x = -Math.PI / 2; // 平铺在 XZ 平面
      arrowMesh.position.y = 0.076 + 0.001; // 略高于方块顶面
      mesh.add(arrowMesh);
    }

    this.scene.add(mesh);
    this.trackBlocks.set(block.id, mesh);

    // 入场动画：从地面升起（scale.y: 0→1，300ms ease-out）
    mesh.scale.y = 0;
    const entranceStart = Date.now();
    const entranceDuration = 300;
    const animateEntrance = () => {
      const t = Math.min((Date.now() - entranceStart) / entranceDuration, 1.0);
      // ease-out cubic: 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      mesh.scale.y = eased;
      if (t < 1.0) {
        this.scheduleAnimationFrame(animateEntrance);
      }
    };
    this.scheduleAnimationFrame(animateEntrance);

    return mesh;
  }

  /**
   * 检查块是否已创建
   */
  hasBlock(blockId: string): boolean {
    return this.trackBlocks.has(blockId);
  }

  /**
   * 更新球的位置和旋转（含车道平滑过渡 + 拖尾 + 粒子更新）
   */
  updateBallState(ballState: BallState, beatInfo?: BeatInfo | null): void {
    if (!this.ballMesh) return;

    // 计算真实 dt（防止切标签页后物理爆炸）
    const now = performance.now();
    if (this.lastUpdateTime > 0) {
      this.currentDt = Math.min((now - this.lastUpdateTime) / 1000, 0.05);
    }
    this.lastUpdateTime = now;
    const dt = this.currentDt;

    // 车道切换平滑过渡
    this.targetBallX = ballState.position.x;
    this.visualBallX +=
      (this.targetBallX - this.visualBallX) *
      Math.min(this.LANE_LERP_SPEED * dt, 1);

    this.ballMesh.position.x = this.visualBallX;
    this.ballMesh.position.y =
      ballState.position.y +
      ballState.position.z * this.trackSlope +
      this.ballBounceOffsetY;
    this.ballMesh.position.z = ballState.position.z;

    this.ballMesh.rotation.set(
      ballState.rotation.x,
      ballState.rotation.y,
      ballState.rotation.z,
    );

    // 更新拖尾
    this.updateTrail();

    // 点光源跟随球
    if (this.ballPointLight) {
      this.ballPointLight.position.set(
        this.ballMesh.position.x,
        this.ballMesh.position.y + 1.5,
        this.ballMesh.position.z,
      );
    }

    // 节拍视觉响应（仅影响点光源和 bloom，不改变球体自身 emissive）
    if (beatInfo) {
      // 半音符强拍：点光源 intensity 脉冲
      if (this.ballPointLight) {
        if (beatInfo.isStrongBeat && beatInfo.stepProgress < 0.1) {
          this.ballPointLight.intensity = 1.4;
        } else {
          this.ballPointLight.intensity +=
            (0.8 - this.ballPointLight.intensity) * 0.1;
        }
      }

      // 四分音符拍点：bloom strength 微弱脉冲
      if (this.bloomPass) {
        const beatPulse = beatInfo.isDownbeat
          ? Math.max(0, 1.0 - beatInfo.stepProgress * 6.0)
          : 0;
        this.bloomPass.strength = 0.7 + beatPulse * 0.3;
      }
    }

    // 更新落地粒子动画
    this.updateLandingParticles();

    // 更新加速粒子风暴
    this.updateBoostParticles();
  }

  /**
   * 更新相机位置跟踪球（复用 lookAtTarget）+ 摄像机震动 + FOV 脉冲
   */
  updateCameraPosition(
    ballPosition: { x: number; y: number; z: number },
    beatInfo?: BeatInfo | null,
  ): void {
    const slopeY = ballPosition.z * this.trackSlope;

    const targetCameraX = ballPosition.x + this.cameraOffset.x;
    const targetCameraY = this.cameraOffset.y + slopeY;
    const targetCameraZ = ballPosition.z + this.cameraOffset.z;

    const smoothing = 0.1;
    this.camera.position.x +=
      (targetCameraX - this.camera.position.x) * smoothing;
    this.camera.position.y +=
      (targetCameraY - this.camera.position.y) * smoothing;
    this.camera.position.z +=
      (targetCameraZ - this.camera.position.z) * smoothing;

    const lookAtY = 0.75 + (ballPosition.z + 5) * this.trackSlope;
    this.lookAtTarget.set(ballPosition.x, lookAtY, ballPosition.z + 5);
    this.camera.lookAt(this.lookAtTarget);

    // 摄像机震动（落地/死亡时触发，线性衰减）
    if (this.cameraShakeDecay > 0) {
      const shakeAmount = this.cameraShakeIntensity * this.cameraShakeDecay;
      this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
      this.cameraShakeDecay = Math.max(
        0,
        this.cameraShakeDecay - this.currentDt / 0.3,
      );
    }

    // FOV 脉冲：半音符强拍 +2 度，平滑回弹
    if (beatInfo) {
      let targetFOV = this.baseFOV;
      if (beatInfo.isStrongBeat && beatInfo.stepProgress < 0.1) {
        targetFOV = this.baseFOV + 2;
      }
      this.camera.fov += (targetFOV - this.camera.fov) * 0.12;
      this.camera.updateProjectionMatrix();
    }

    // 星空跟随球的Z位置 + 节拍脉动
    if (this.starField) {
      this.starField.position.z = ballPosition.z;
      const starMat = this.starField.material as THREE.PointsMaterial;
      if (beatInfo && beatInfo.isStrongBeat && beatInfo.stepProgress < 0.1) {
        starMat.size = 0.7;
        starMat.opacity = 1.0;
      } else {
        starMat.size += (0.5 - starMat.size) * 0.08;
        starMat.opacity += (0.8 - starMat.opacity) * 0.08;
      }
    }
  }

  /**
   * 触发摄像机震动
   * @param intensity 震动强度（0-1）
   * @param _duration 震动持续时间（毫秒，用于衰减速率计算）
   */
  playCameraShake(intensity: number, _duration: number): void {
    this.cameraShakeIntensity = intensity;
    this.cameraShakeDecay = 1.0;
  }

  /**
   * 清理球身后的方块（共享资源不 dispose）
   */
  cleanupBehindBlocks(ballZ: number, threshold: number = 5): void {
    for (const [id, mesh] of this.trackBlocks.entries()) {
      if (mesh.position.z < ballZ - threshold) {
        this.scene.remove(mesh);
        this.trackBlocks.delete(id);
      }
    }
  }

  /**
   * 移除方块
   */
  removeBlock(blockId: string): void {
    const mesh = this.trackBlocks.get(blockId);
    if (mesh) {
      this.scene.remove(mesh);
      this.trackBlocks.delete(blockId);
    }
  }

  /**
   * 清空所有方块
   */
  clearAllBlocks(): void {
    this.trackBlocks.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.trackBlocks.clear();
  }

  /**
   * 处理窗口resize
   */
  private onWindowResize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  /**
   * 启动渲染（标记为运行中，不再自带 rAF 循环）
   */
  startRendering(): void {
    if (this.disposed) return;
    this.isRunning = true;
  }

  /**
   * 停止渲染
   */
  stopRendering(): void {
    this.isRunning = false;
  }

  /**
   * 单次渲染（由 GameCore 的游戏循环调用）
   */
  render(): void {
    if (this.disposed) return;
    if (!this.isRunning) return;
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * 设置场景主题（背景色、雾效、环境光）
   */
  setSceneTheme(theme: SceneTheme): void {
    if (this.scene) {
      (this.scene.background as THREE.Color).set(theme.background);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set(theme.fogColor);
        this.scene.fog.near = theme.fogNear;
        this.scene.fog.far = theme.fogFar;
      }
    }
    if (this.ambientLight) {
      this.ambientLight.color.set(theme.ambientColor);
      this.ambientLight.intensity = theme.ambientIntensity;
    }
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * 恢复球体可见性 — 复活时调用（爆炸后球体被隐藏）
   */
  restoreBall(): void {
    if (this.ballMesh) {
      this.ballMesh.visible = true;
      this.ballMesh.scale.set(1, 1, 1);
    }
    if (this.trailMesh) {
      this.trailMesh.visible = true;
    }
  }

  /**
   * 播放复活重生特效 — 球体从 0 弹到 1.2 再回 1.0 + 点光源闪亮 + 落地粒子
   */
  playReviveEffect(): void {
    if (!this.ballMesh) return;

    // 球体缩放弹跳动画：0 → 1.2 → 1.0（300ms）
    this.ballMesh.scale.set(0.01, 0.01, 0.01);
    const startTime = Date.now();
    const animate = () => {
      if (!this.ballMesh) return;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / 300, 1);
      let scale: number;
      if (t < 0.6) {
        // 0 → 1.2
        scale = (t / 0.6) * 1.2;
      } else {
        // 1.2 → 1.0
        scale = 1.2 - ((t - 0.6) / 0.4) * 0.2;
      }
      this.ballMesh.scale.set(scale, scale, scale);
      if (t < 1) this.scheduleAnimationFrame(animate);
    };
    this.scheduleAnimationFrame(animate);

    // 点光源闪亮
    if (this.ballPointLight) {
      this.ballPointLight.intensity = 3.0;
      const fadeLight = () => {
        if (!this.ballPointLight) return;
        this.ballPointLight.intensity +=
          (0.8 - this.ballPointLight.intensity) * 0.1;
        if (Math.abs(this.ballPointLight.intensity - 0.8) > 0.05) {
          this.scheduleAnimationFrame(fadeLight);
        }
      };
      this.scheduleAnimationFrame(fadeLight);
    }

    // 复用落地粒子播放一次爆发
    this.playLandingParticlesAtBall();
  }

  // 无敌闪烁定时器
  private invincibleBlinkTimer: number | null = null;

  /**
   * 开始无敌闪烁 — 每 100ms 切换球体可见性
   */
  startInvincibleBlink(): void {
    if (this.disposed) return;
    this.stopInvincibleBlink();
    this.invincibleBlinkTimer = window.setInterval(() => {
      if (this.disposed) {
        this.stopInvincibleBlink();
        return;
      }
      if (this.ballMesh) {
        this.ballMesh.visible = !this.ballMesh.visible;
      }
    }, 100);
  }

  /**
   * 停止无敌闪烁 — 确保球体可见
   */
  stopInvincibleBlink(): void {
    if (this.invincibleBlinkTimer !== null) {
      clearInterval(this.invincibleBlinkTimer);
      this.invincibleBlinkTimer = null;
    }
    if (this.ballMesh) {
      this.ballMesh.visible = true;
    }
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
      return;
    }
    material.dispose();
  }

  private disposeObjectResources(object: THREE.Object3D): void {
    object.traverse((child) => {
      const renderable = child as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      renderable.geometry?.dispose();
      if (renderable.material) {
        this.disposeMaterial(renderable.material);
      }
    });
  }

  /**
   * 销毁3D环境
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this.resizeHandler);
    for (const id of this.animationFrameIds) {
      cancelAnimationFrame(id);
    }
    this.animationFrameIds.clear();

    this.stopInvincibleBlink();
    this.stopRendering();
    this.clearAllBlocks();

    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);

    for (const object of this.backgroundObjects) {
      this.scene.remove(object);
      this.disposeObjectResources(object);
    }
    this.backgroundObjects = [];
    this.starField = null;

    // 共享 Geometry
    this.sharedSplitGeo.dispose();
    this.sharedFullGeo.dispose();
    this.sharedArrowGeo?.dispose();
    this.sharedArrowGeo = null;
    this.sharedArrowMat?.dispose();
    this.sharedArrowMat = null;

    // 箭头纹理
    if (this.arrowTexture) {
      this.arrowTexture.dispose();
      this.arrowTexture = null;
    }

    // 缓存 Material
    this.materialCache.forEach((mat) => mat.dispose());
    this.materialCache.clear();

    // 球体
    if (this.ballMesh) {
      this.scene.remove(this.ballMesh);
      this.ballMesh.geometry.dispose();
      (this.ballMesh.material as THREE.MeshStandardMaterial).dispose();
    }

    // 球体跟随点光源
    if (this.ballPointLight) {
      this.scene.remove(this.ballPointLight);
      this.ballPointLight.dispose();
    }

    // 拖尾
    if (this.trailMesh) {
      this.scene.remove(this.trailMesh);
      this.trailGeometry?.dispose();
      (this.trailMesh.material as THREE.PointsMaterial).dispose();
    }

    // 落地粒子池
    if (this.landingParticles) {
      this.scene.remove(this.landingParticles);
      this.landingParticleGeo?.dispose();
      this.landingParticleMat?.dispose();
    }

    // 加速粒子池
    if (this.boostParticles) {
      this.scene.remove(this.boostParticles);
      this.boostParticleGeo?.dispose();
      this.boostParticleMat?.dispose();
    }

    // 后处理
    if (this.composer) {
      this.composer.dispose();
    }

    this.renderer.dispose();
    console.log("Renderer3D: Disposed");
  }
}

export default Renderer3D;
