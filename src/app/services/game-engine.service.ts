import { Injectable } from '@angular/core';
import {
  Animal, Hunter, Tree, Particle, Grass, Bush, Cloud,
  SnakeSegment, Direction, GameState, Vector2D, GameConfig
} from '../models/game.models';

@Injectable({ providedIn: 'root' })
export class GameEngineService {
  // Canvas & Context
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  // Game Config
  config: GameConfig = {
    cellSize: 20,
    cols: 80,
    rows: 40,
    snakeSpeed: 8,
    hunterCount: 4,
    animalCount: 12
  };

  // World dimensions
  worldWidth = 0;
  worldHeight = 0;

  // Camera
  cameraX = 0;
  cameraY = 0;

  // Game State
  gameState: GameState = 'menu';
  score = 0;
  highScore = 0;
  level = 1;
  animTime = 0;
  frameCount = 0;
  lastTime = 0;
  fps = 0;
  fpsTimer = 0;

  // Snake
  snake: SnakeSegment[] = [];
  direction: Direction = 'right';
  nextDirection: Direction = 'right';
  snakeMoveTimer = 0;
  snakeMoveInterval = 120; // ms
  snakeAlive = true;
  growthPending = 0;
  snakeEyeBlinkTimer = 0;
  snakeTongueTimer = 0;
  snakeTongueOut = false;

  // World entities
  animals: Animal[] = [];
  hunters: Hunter[] = [];
  trees: Tree[] = [];
  grasses: Grass[] = [];
  bushes: Bush[] = [];
  clouds: Cloud[] = [];
  particles: Particle[] = [];

  // Flag (win condition)
  flagX = 0;
  flagY = 0;
  flagWaveTimer = 0;

  // Death / Win
  deathPosition: Vector2D = { x: 0, y: 0 };
  deathTimer = 0;
  winTimer = 0;
  killedBy: 'hunter' | null = null;

  // In-canvas overlay buttons
  overlayPlayAgainBtn = { x: 0, y: 0, w: 180, h: 48 };
  overlayMenuBtn      = { x: 0, y: 0, w: 180, h: 48 };
  overlayVisible = false;
  onPlayAgain: (() => void) | null = null;
  onGoMenu:    (() => void) | null = null;

  // Input
  keysDown: Set<string> = new Set();

  // Jungle background layers
  bgLayer1X = 0;
  bgLayer2X = 0;

  // UI
  messageAlpha = 1;
  showMessage = false;
  currentMessage = '';

  private animationId: number | null = null;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.worldWidth = this.config.cols * this.config.cellSize;
    this.worldHeight = this.config.rows * this.config.cellSize;
    this.loadHighScore();
    this.buildWorld();
  }

  loadHighScore() {
    const saved = localStorage.getItem('jungleSnakeHighScore');
    if (saved) this.highScore = parseInt(saved);
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('jungleSnakeHighScore', this.highScore.toString());
    }
  }

  buildWorld() {
    // Generate trees
    this.trees = [];
    for (let i = 0; i < 60; i++) {
      this.trees.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * (this.worldHeight - 100) + 20,
        scale: 0.6 + Math.random() * 0.8,
        type: Math.floor(Math.random() * 3),
        swayOffset: Math.random() * Math.PI * 2
      });
    }
    // Dense trees near edges
    for (let i = 0; i < 20; i++) {
      this.trees.push({ x: Math.random() * 80, y: Math.random() * this.worldHeight, scale: 0.8 + Math.random() * 0.4, type: Math.floor(Math.random() * 3), swayOffset: Math.random() * Math.PI * 2 });
      this.trees.push({ x: this.worldWidth - Math.random() * 80, y: Math.random() * this.worldHeight, scale: 0.8 + Math.random() * 0.4, type: Math.floor(Math.random() * 3), swayOffset: Math.random() * Math.PI * 2 });
    }

    // Generate grass patches
    this.grasses = [];
    for (let i = 0; i < 400; i++) {
      this.grasses.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        height: 8 + Math.random() * 16,
        swayOffset: Math.random() * Math.PI * 2,
        color: `hsl(${110 + Math.random() * 30}, ${60 + Math.random() * 30}%, ${25 + Math.random() * 20}%)`
      });
    }

    // Generate bushes
    this.bushes = [];
    for (let i = 0; i < 30; i++) {
      this.bushes.push({
        x: Math.random() * this.worldWidth,
        y: 40 + Math.random() * (this.worldHeight - 80),
        scale: 0.5 + Math.random() * 0.7
      });
    }

    // Generate clouds
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * this.worldWidth,
        y: 20 + Math.random() * 80,
        speed: 0.2 + Math.random() * 0.3,
        scale: 0.8 + Math.random() * 1.2,
        opacity: 0.3 + Math.random() * 0.3
      });
    }

    // Flag position
    this.flagX = this.worldWidth - 80;
    this.flagY = this.worldHeight / 2;

    this.spawnAnimals();
    this.spawnHunters();
    this.resetSnake();
  }

  resetSnake() {
    const startX = 3;
    const startY = Math.floor(this.config.rows / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    this.direction = 'right';
    this.nextDirection = 'right';
    this.growthPending = 0;
    this.snakeAlive = true;
  }

  spawnAnimals() {
    const types: Array<{ type: Animal['type']; emoji: string; points: number; growth: number; speed: number }> = [
      { type: 'rabbit', emoji: '🐰', points: 10, growth: 2, speed: 1.2 },
      { type: 'frog', emoji: '🐸', points: 15, growth: 3, speed: 0.8 },
      { type: 'bird', emoji: '🐦', points: 20, growth: 1, speed: 1.8 },
      { type: 'mouse', emoji: '🐭', points: 12, growth: 2, speed: 1.0 },
      { type: 'butterfly', emoji: '🦋', points: 25, growth: 1, speed: 1.5 }
    ];
    this.animals = [];
    for (let i = 0; i < this.config.animalCount; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const angle = Math.random() * Math.PI * 2;
      this.animals.push({
        id: i,
        x: 100 + Math.random() * (this.worldWidth - 250),
        y: 60 + Math.random() * (this.worldHeight - 120),
        type: t.type,
        emoji: t.emoji,
        points: t.points,
        growth: t.growth,
        animFrame: 0,
        bobOffset: Math.random() * Math.PI * 2,
        speed: t.speed,
        vx: Math.cos(angle) * t.speed,
        vy: Math.sin(angle) * t.speed * 0.5,
        alive: true,
        eatAnimation: 0
      });
    }
  }

  spawnHunters() {
    this.hunters = [];
    for (let i = 0; i < this.config.hunterCount; i++) {
      const px = 150 + Math.random() * (this.worldWidth - 350);
      const py = 60 + Math.random() * (this.worldHeight - 120);
      const patrolRange = 100 + Math.random() * 80;
      this.hunters.push({
        id: i,
        x: px, y: py,
        vx: 0.5 + Math.random() * 0.5, vy: 0,
        direction: 'right',
        state: 'patrol',
        sightRange: 120 + Math.random() * 60,
        sightAngle: Math.PI / 3,
        patrolPath: [
          { x: px - patrolRange, y: py },
          { x: px + patrolRange, y: py }
        ],
        patrolIndex: 0,
        alertTimer: 0,
        animFrame: 0,
        stepTimer: 0,
        flashTimer: 0
      });
    }
  }

  startGame() {
    this.score = 0;
    this.gameState = 'playing';
    this.deathTimer = 0;
    this.winTimer = 0;
    this.killedBy = null;
    this.particles = [];
    this.buildWorld();
    this.startLoop();
  }

  startLoop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - this.lastTime, 50);
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  handleKey(key: string) {
    if (this.gameState === 'playing') {
      switch (key) {
        case 'ArrowUp': case 'w': case 'W':
          if (this.direction !== 'down') this.nextDirection = 'up'; break;
        case 'ArrowDown': case 's': case 'S':
          if (this.direction !== 'up') this.nextDirection = 'down'; break;
        case 'ArrowLeft': case 'a': case 'A':
          if (this.direction !== 'right') this.nextDirection = 'left'; break;
        case 'ArrowRight': case 'd': case 'D':
          if (this.direction !== 'left') this.nextDirection = 'right'; break;
        case 'p': case 'P': case 'Escape':
          this.gameState = 'paused'; break;
      }
    } else if (this.gameState === 'paused') {
      if (key === 'p' || key === 'P' || key === 'Escape') {
        this.gameState = 'playing';
      }
    }
  }

  update(dt: number) {
    if (this.gameState !== 'playing') return;
    this.animTime += dt;
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.updateClouds(dt);
    this.updateParticles(dt);
    this.updateAnimals(dt);
    this.updateHunters(dt);
    this.updateSnake(dt);
    this.updateCamera();
    this.flagWaveTimer += dt * 0.003;
  }

  updateClouds(dt: number) {
    this.clouds.forEach(c => {
      c.x += c.speed * dt * 0.05;
      if (c.x > this.worldWidth + 200) c.x = -200;
    });
  }

  updateParticles(dt: number) {
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += 0.05 * dt * 0.06; // gravity
      p.life -= dt;
      p.size *= 0.995;
    });
  }

  updateAnimals(dt: number) {
    this.animals.forEach(a => {
      if (!a.alive) return;
      a.animFrame += dt * 0.005;
      a.bobOffset += dt * 0.003;

      // Random wander
      if (Math.random() < 0.005) {
        const angle = Math.random() * Math.PI * 2;
        a.vx = Math.cos(angle) * a.speed;
        a.vy = Math.sin(angle) * a.speed * 0.5;
      }

      a.x += a.vx * dt * 0.04;
      a.y += a.vy * dt * 0.04;

      // Bounce off world bounds
      if (a.x < 60) { a.x = 60; a.vx = Math.abs(a.vx); }
      if (a.x > this.worldWidth - 100) { a.x = this.worldWidth - 100; a.vx = -Math.abs(a.vx); }
      if (a.y < 40) { a.y = 40; a.vy = Math.abs(a.vy); }
      if (a.y > this.worldHeight - 60) { a.y = this.worldHeight - 60; a.vy = -Math.abs(a.vy); }
    });
  }

  updateHunters(dt: number) {
    const head = this.snake[0];
    const headPx = head.x * this.config.cellSize;
    const headPy = head.y * this.config.cellSize;

    this.hunters.forEach(h => {
      h.stepTimer += dt;
      h.flashTimer = Math.max(0, h.flashTimer - dt);
      if (h.stepTimer > 400) {
        h.animFrame = (h.animFrame + 1) % 4;
        h.stepTimer = 0;
      }

      // Check line of sight to snake
      const dx = headPx - h.x;
      const dy = headPy - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hunterAngle = Math.atan2(dy, dx);
      const facingAngle = h.direction === 'right' ? 0 : Math.PI;
      const angleDiff = Math.abs(this.normalizeAngle(hunterAngle - facingAngle));

      const canSee = dist < h.sightRange && angleDiff < h.sightAngle;

      if (canSee) {
        h.state = dist < 50 ? 'attack' : 'chase';
        h.alertTimer = 2000;
        h.flashTimer = 200;
      } else {
        if (h.alertTimer > 0) {
          h.alertTimer -= dt;
          if (h.alertTimer <= 0) h.state = 'patrol';
          else h.state = 'alert';
        }
      }

      // State machine movement
      switch (h.state) {
        case 'patrol': this.hunterPatrol(h, dt); break;
        case 'alert': this.hunterAlert(h, headPx, headPy, dt); break;
        case 'chase': this.hunterChase(h, headPx, headPy, dt); break;
        case 'attack': break;
      }

      // Kill snake
      if (this.snakeAlive && h.state === 'attack' || (this.snakeAlive && dist < 20)) {
        if (dist < 30) {
          this.killSnake(h);
        }
      }
    });
  }

  hunterPatrol(h: Hunter, dt: number) {
    const target = h.patrolPath[h.patrolIndex];
    const dx = target.x - h.x;
    if (Math.abs(dx) < 5) {
      h.patrolIndex = (h.patrolIndex + 1) % h.patrolPath.length;
    } else {
      const speed = 0.8;
      h.x += Math.sign(dx) * speed * dt * 0.04;
      h.direction = dx > 0 ? 'right' : 'left';
    }
  }

  hunterAlert(h: Hunter, tx: number, ty: number, dt: number) {
    // Look around
  }

  hunterChase(h: Hunter, tx: number, ty: number, dt: number) {
    const dx = tx - h.x;
    const dy = ty - h.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const speed = 1.8;
      h.x += (dx / dist) * speed * dt * 0.04;
      h.y += (dy / dist) * speed * dt * 0.04;
      h.direction = dx > 0 ? 'right' : 'left';
    }
  }

  normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  updateSnake(dt: number) {
    if (!this.snakeAlive) {
      this.deathTimer += dt;
      // Keep rendering game world while overlay is shown — no auto-transition
      return;
    }

    this.snakeMoveTimer += dt;
    this.snakeEyeBlinkTimer += dt;
    this.snakeTongueTimer += dt;
    if (this.snakeTongueTimer > 2000) {
      this.snakeTongueOut = !this.snakeTongueOut;
      this.snakeTongueTimer = 0;
    }

    if (this.snakeMoveTimer >= this.snakeMoveInterval) {
      this.snakeMoveTimer = 0;
      this.moveSnake();
    }
  }

  moveSnake() {
    this.direction = this.nextDirection;
    const head = { ...this.snake[0] };

    switch (this.direction) {
      case 'up': head.y -= 1; break;
      case 'down': head.y += 1; break;
      case 'left': head.x -= 1; break;
      case 'right': head.x += 1; break;
    }

    // Wall collision
    if (head.x < 0 || head.x >= this.config.cols || head.y < 0 || head.y >= this.config.rows) {
      this.killSnake(null);
      return;
    }

    // Self collision
    for (let i = 1; i < this.snake.length; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        this.killSnake(null);
        return;
      }
    }

    this.snake.unshift(head);

    if (this.growthPending > 0) {
      this.growthPending--;
    } else {
      this.snake.pop();
    }

    // Check animal collision
    this.checkAnimalEat();

    // Check win (reach flag)
    const headPx = head.x * this.config.cellSize;
    const headPy = head.y * this.config.cellSize;
    const dFlagX = headPx - this.flagX;
    const dFlagY = headPy - this.flagY;
    if (Math.sqrt(dFlagX * dFlagX + dFlagY * dFlagY) < 40) {
      this.triggerWin();
    }
  }

  checkAnimalEat() {
    const head = this.snake[0];
    const headPx = head.x * this.config.cellSize;
    const headPy = head.y * this.config.cellSize;

    this.animals.forEach(a => {
      if (!a.alive) return;
      const dx = headPx - a.x;
      const dy = headPy - a.y;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        a.alive = false;
        this.score += a.points;
        this.growthPending += a.growth;
        this.spawnEatParticles(a.x, a.y, a.type);
        this.spawnScoreParticles(a.x, a.y, a.points);
        // Respawn a new animal
        setTimeout(() => this.respawnAnimal(a), 8000);
      }
    });
  }

  respawnAnimal(a: Animal) {
    if (this.gameState !== 'playing') return;
    const types: Array<{ type: Animal['type']; emoji: string; points: number; growth: number; speed: number }> = [
      { type: 'rabbit', emoji: '🐰', points: 10, growth: 2, speed: 1.2 },
      { type: 'frog', emoji: '🐸', points: 15, growth: 3, speed: 0.8 },
      { type: 'bird', emoji: '🐦', points: 20, growth: 1, speed: 1.8 },
      { type: 'mouse', emoji: '🐭', points: 12, growth: 2, speed: 1.0 },
      { type: 'butterfly', emoji: '🦋', points: 25, growth: 1, speed: 1.5 }
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    const angle = Math.random() * Math.PI * 2;
    a.type = t.type;
    a.emoji = t.emoji;
    a.points = t.points;
    a.growth = t.growth;
    a.speed = t.speed;
    a.vx = Math.cos(angle) * t.speed;
    a.vy = Math.sin(angle) * t.speed * 0.5;
    a.x = 100 + Math.random() * (this.worldWidth - 250);
    a.y = 60 + Math.random() * (this.worldHeight - 120);
    a.alive = true;
  }

  spawnEatParticles(x: number, y: number, type: Animal['type']) {
    const colors: Record<Animal['type'], string[]> = {
      rabbit: ['#fff', '#f0e0c0', '#ddd'],
      frog: ['#4f8', '#2d6', '#9f6'],
      bird: ['#f84', '#fc0', '#f44'],
      mouse: ['#aaa', '#888', '#ccc'],
      butterfly: ['#f4f', '#c4f', '#84f']
    };
    const cols = colors[type];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
        color: cols[Math.floor(Math.random() * cols.length)],
        size: 3 + Math.random() * 5,
        type: 'sparkle'
      });
    }
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 1,
        vy: -1 - Math.random() * 2,
        life: 1000 + Math.random() * 500,
        maxLife: 1500,
        color: '#2d5',
        size: 4 + Math.random() * 4,
        type: 'leaf'
      });
    }
  }

  spawnScoreParticles(x: number, y: number, points: number) {
    // Visual score popup handled in render
  }

  spawnDeathParticles(x: number, y: number) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 800 + Math.random() * 600,
        maxLife: 1400,
        color: ['#f44', '#f22', '#a00', '#f88'][Math.floor(Math.random() * 4)],
        size: 4 + Math.random() * 8,
        type: 'blood'
      });
    }
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2 - 1,
        life: 1500,
        maxLife: 1500,
        color: '#555',
        size: 6 + Math.random() * 10,
        type: 'smoke'
      });
    }
  }

  killSnake(hunter: Hunter | null) {
    if (!this.snakeAlive) return;
    this.snakeAlive = false;
    this.killedBy = hunter ? 'hunter' : null;
    const head = this.snake[0];
    this.deathPosition = { x: head.x * this.config.cellSize, y: head.y * this.config.cellSize };
    this.spawnDeathParticles(this.deathPosition.x, this.deathPosition.y);
    this.deathTimer = 0;
    // Show overlay immediately after short delay for particles
    setTimeout(() => {
      this.overlayVisible = true;
      this.saveHighScore();
    }, 800);
  }

  triggerWin() {
    this.snakeAlive = false;
    this.winTimer = 0;
    this.gameState = 'won';
    this.saveHighScore();
    // Spawn lots of celebration particles around flag
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x: this.flagX + (Math.random() - 0.5) * 40,
        y: this.flagY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
        color: ['#fc0', '#f44', '#4f4', '#44f', '#f4f', '#4ff'][Math.floor(Math.random() * 6)],
        size: 5 + Math.random() * 10,
        type: 'star'
      });
    }
  }

  updateCamera() {
    if (this.snake.length === 0) return;
    const head = this.snake[0];
    const targetX = head.x * this.config.cellSize - this.canvas.width / 2;
    const targetY = head.y * this.config.cellSize - this.canvas.height / 2;
    this.cameraX += (targetX - this.cameraX) * 0.08;
    this.cameraY += (targetY - this.cameraY) * 0.08;
    this.cameraX = Math.max(0, Math.min(this.worldWidth - this.canvas.width, this.cameraX));
    this.cameraY = Math.max(0, Math.min(this.worldHeight - this.canvas.height, this.cameraY));
  }

  // ============ RENDERING ============

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Sky/Ground gradient background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#1a3d1a');
    skyGrad.addColorStop(0.3, '#2d5a1b');
    skyGrad.addColorStop(1, '#1a2e0a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);

    this.renderWorldBackground();
    this.renderClouds();
    this.renderGrass();
    this.renderBushes();
    this.renderTrees();
    this.renderAnimals();
    this.renderHunterSightCones();
    this.renderHunters();
    this.renderSnake();
    this.renderFlag();
    this.renderParticles();

    ctx.restore();

    this.renderHUD();

    if (this.gameState === 'paused') this.renderPauseOverlay();
    if (this.overlayVisible && !this.snakeAlive) this.renderDeathOverlay();
  }

  renderWorldBackground() {
    const ctx = this.ctx;
    const W = this.worldWidth;
    const H = this.worldHeight;
    const t = this.animTime * 0.001;

    // ── 1. Sky strip (visible at very top) ──────────────────────────────────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.18);
    skyGrad.addColorStop(0,   '#3a7d44');  // canopy green-light
    skyGrad.addColorStop(0.5, '#2e6636');
    skyGrad.addColorStop(1,   '#1e4522');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.18);

    // ── 2. Main ground – rich layered soil ──────────────────────────────────
    const groundGrad = ctx.createLinearGradient(0, H * 0.1, 0, H);
    groundGrad.addColorStop(0,    '#3b6e1a');  // surface turf
    groundGrad.addColorStop(0.12, '#2d5c12');
    groundGrad.addColorStop(0.25, '#4a3510');  // topsoil
    groundGrad.addColorStop(0.45, '#3d2a0c');
    groundGrad.addColorStop(0.65, '#2e1f08');  // dark earth
    groundGrad.addColorStop(1,    '#1a1005');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, W, H);

    // ── 3. Soil noise / grain texture ────────────────────────────────────────
    for (let gx = 0; gx < W; gx += 18) {
      for (let gy = 0; gy < H; gy += 18) {
        const seed = (gx * 31 + gy * 17) % 1000;
        const a = 0.04 + (seed % 6) * 0.01;
        const bright = seed % 2 === 0;
        ctx.fillStyle = bright
          ? `rgba(255,210,150,${a})`   // light flecks
          : `rgba(0,0,0,${a * 1.5})`; // dark pits
        ctx.beginPath();
        ctx.ellipse(
          gx + (seed % 14) - 7,
          gy + (seed % 10) - 5,
          2 + (seed % 4),
          1 + (seed % 2),
          (seed % 6) * 0.5,
          0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    // ── 4. Moss patches (dark green blobs on soil) ───────────────────────────
    const mossSeeds = [
      [120,80],[350,200],[600,130],[800,310],[200,350],[1000,180],
      [450,420],[700,500],[1100,400],[300,500],[900,560],[150,480],
      [550,60],[1250,300],[1400,500],[60,300]
    ];
    mossSeeds.forEach(([mx, my]) => {
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 55);
      grad.addColorStop(0,   'rgba(42,90,18,0.7)');
      grad.addColorStop(0.5, 'rgba(30,70,10,0.4)');
      grad.addColorStop(1,   'rgba(20,50,5,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(mx, my, 55, 35, (mx % 6) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── 5. Mud puddles ────────────────────────────────────────────────────────
    const puddles = [
      [280,160,60,22],[720,380,80,26],[1050,280,55,18],
      [480,510,70,24],[160,420,45,16],[900,100,65,20],
      [1300,450,58,19],[640,250,50,17]
    ];
    puddles.forEach(([px,py,rw,rh]) => {
      // Dark mud base
      const mudGrad = ctx.createRadialGradient(px,py,2, px,py,rw);
      mudGrad.addColorStop(0,   'rgba(28,18,8,0.80)');
      mudGrad.addColorStop(0.5, 'rgba(38,25,10,0.55)');
      mudGrad.addColorStop(1,   'rgba(50,35,12,0)');
      ctx.fillStyle = mudGrad;
      ctx.beginPath();
      ctx.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
      // Water sheen
      const sheen = ctx.createLinearGradient(px - rw, py - rh, px + rw * 0.5, py);
      sheen.addColorStop(0,   'rgba(100,170,220,0.18)');
      sheen.addColorStop(0.5, 'rgba(80,140,190,0.10)');
      sheen.addColorStop(1,   'rgba(60,110,160,0)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.ellipse(px, py, rw * 0.85, rh * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      // Animated ripple
      const rippleR = rw * 0.5 + Math.sin(t * 1.5 + px * 0.02) * rw * 0.12;
      ctx.strokeStyle = 'rgba(150,210,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px, py, rippleR, rippleR * (rh / rw), 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // ── 6. Exposed tree roots ────────────────────────────────────────────────
    const rootGroups = [
      {cx:100, cy:250}, {cx:400, cy:100}, {cx:750, cy:450},
      {cx:1150,cy:200}, {cx:950, cy:550}, {cx:300, cy:530},
      {cx:1350,cy:350}, {cx:650, cy:300}
    ];
    ctx.lineWidth = 2.5;
    rootGroups.forEach(({cx, cy}) => {
      const numRoots = 4 + Math.floor(((cx * 7 + cy * 3) % 4));
      for (let r = 0; r < numRoots; r++) {
        const angle = (r / numRoots) * Math.PI * 2 + (cx % 5) * 0.3;
        const len   = 35 + (r * 12) % 25;
        const cx2   = cx + Math.cos(angle) * len;
        const cy2   = cy + Math.sin(angle) * len;
        const cx3   = cx + Math.cos(angle + 0.4) * (len * 1.4);
        const cy3   = cy + Math.sin(angle + 0.3) * (len * 1.4);
        // Root shadow first
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy + 3);
        ctx.quadraticCurveTo(cx2 + 3, cy2 + 3, cx3 + 2, cy3 + 2);
        ctx.stroke();
        // Root itself
        const rg = ctx.createLinearGradient(cx, cy, cx3, cy3);
        rg.addColorStop(0,   '#5c3810');
        rg.addColorStop(0.5, '#7a4e1c');
        rg.addColorStop(1,   '#4a2c0a');
        ctx.strokeStyle = rg;
        ctx.lineWidth = 3.5 - r * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx2, cy2, cx3, cy3);
        ctx.stroke();
        // Bark highlight
        ctx.strokeStyle = 'rgba(200,150,80,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - 1);
        ctx.quadraticCurveTo(cx2 - 1, cy2 - 1, cx3 - 1, cy3 - 1);
        ctx.stroke();
      }
    });

    // ── 7. Rocks and pebbles ──────────────────────────────────────────────────
    const rocks = [
      {x:220, y:320, rx:18, ry:12, a:0.2},
      {x:570, y:150, rx:14, ry:9,  a:0.5},
      {x:890, y:420, rx:22, ry:14, a:-0.3},
      {x:1100,y:310, rx:16, ry:10, a:0.1},
      {x:380, y:470, rx:12, ry:8,  a:0.8},
      {x:720, y:60,  rx:20, ry:11, a:-0.2},
      {x:1280,y:200, rx:15, ry:9,  a:0.4},
      {x:50,  y:200, rx:10, ry:7,  a:0.0},
      {x:1450,y:500, rx:18, ry:11, a:0.3},
    ];
    rocks.forEach(({x, y, rx, ry, a}) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(4, 6, rx, ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rock body
      const rockGrad = ctx.createRadialGradient(-rx*0.3, -ry*0.4, 1, 0, 0, rx);
      rockGrad.addColorStop(0,   '#8a8a7a');
      rockGrad.addColorStop(0.4, '#6a6a5a');
      rockGrad.addColorStop(1,   '#3a3a30');
      ctx.fillStyle = rockGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(-rx*0.25, -ry*0.3, rx*0.4, ry*0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Crack lines
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-rx*0.2, -ry*0.1);
      ctx.lineTo(rx*0.1, ry*0.3);
      ctx.stroke();
      ctx.restore();

      // Pebbles around rock
      for (let p = 0; p < 4; p++) {
        const pa = (p / 4) * Math.PI * 2 + a;
        const pd = rx + 8 + p * 4;
        const pr = 2 + p;
        ctx.fillStyle = `hsl(40,10%,${38 + p * 6}%)`;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(pa) * pd, y + Math.sin(pa) * pd, pr, pr * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // ── 8. Hanging vines ─────────────────────────────────────────────────────
    const vineAnchors = [150,320,500,680,860,1050,1220,1400];
    vineAnchors.forEach((vx, vi) => {
      const segments = 6 + vi % 3;
      const segH     = 18 + vi * 4;
      const swing    = Math.sin(t * 0.8 + vi * 1.2) * 8;

      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsl(${115 + vi * 4},50%,${22 + vi % 4 * 4}%)`;

      let lastX = vx;
      let lastY = 0;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      for (let s = 1; s <= segments; s++) {
        const nx = vx + Math.sin(t + s * 0.7 + vi) * swing;
        const ny = s * segH;
        ctx.lineTo(nx, ny);
        lastX = nx; lastY = ny;
      }
      ctx.stroke();

      // Vine leaf clusters every 2 segments
      for (let s = 2; s <= segments; s += 2) {
        const lx = vx + Math.sin(t + s * 0.7 + vi) * swing;
        const ly = s * segH;
        for (let lf = 0; lf < 3; lf++) {
          const la = (lf / 3) * Math.PI * 1.4 - 0.7;
          const leafGrad = ctx.createLinearGradient(lx, ly, lx + Math.cos(la)*16, ly + Math.sin(la)*16);
          leafGrad.addColorStop(0, `hsl(${118+vi*3},65%,28%)`);
          leafGrad.addColorStop(1, `hsl(${118+vi*3},55%,20%)`);
          ctx.fillStyle = leafGrad;
          ctx.beginPath();
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(la + Math.sin(t * 0.5 + vi + lf) * 0.15);
          ctx.ellipse(8, 0, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Leaf vein
          ctx.strokeStyle = 'rgba(100,200,80,0.3)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0,0); ctx.lineTo(16,0);
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    // ── 9. Jungle floor flowers ───────────────────────────────────────────────
    const flowers = [
      {x:190,y:190,c:'#ff6b35'},{x:430,y:370,c:'#ff3b8a'},
      {x:760,y:200,c:'#ffe135'},{x:1000,y:460,c:'#ff6b35'},
      {x:340,y:80, c:'#ff3b8a'},{x:850,y:530,c:'#aaf040'},
      {x:1180,y:120,c:'#ffe135'},{x:580,y:490,c:'#ff6b35'},
      {x:70, y:350,c:'#ff3b8a'},{x:1380,y:290,c:'#aaf040'},
    ];
    flowers.forEach(({x, y, c}) => {
      const bob = Math.sin(t * 2 + x * 0.05) * 2;
      ctx.save();
      ctx.translate(x, y + bob);
      // Stem
      ctx.strokeStyle = '#3a7020';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, 20);
      ctx.stroke();
      // Petals
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2 + t * 0.3;
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(pa) * 6, Math.sin(pa) * 6,
          5, 3, pa, 0, Math.PI * 2
        );
        ctx.fill();
      }
      // Center
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff9b0';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ── 10. Dappled sunlight through canopy ───────────────────────────────────
    for (let i = 0; i < 18; i++) {
      const lx  = (i * 87 + Math.sin(t * 0.4 + i) * 30) % W;
      const ly  = (i * 55 + Math.cos(t * 0.3 + i * 1.3) * 20) % H;
      const lr  = 28 + Math.sin(t * 0.7 + i * 0.9) * 10;
      const lightGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lightGrad.addColorStop(0,   'rgba(255,245,180,0.09)');
      lightGrad.addColorStop(0.5, 'rgba(200,240,120,0.04)');
      lightGrad.addColorStop(1,   'rgba(255,245,180,0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr, lr * 0.6, (i % 4) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 11. World border — thick jungle wall with vines ───────────────────────
    // Top border bar (canopy ceiling)
    const ceilingGrad = ctx.createLinearGradient(0, 0, 0, 30);
    ceilingGrad.addColorStop(0, 'rgba(10,30,5,0.95)');
    ceilingGrad.addColorStop(1, 'rgba(10,30,5,0)');
    ctx.fillStyle = ceilingGrad;
    ctx.fillRect(0, 0, W, 30);

    // Bottom border
    const floorGrad = ctx.createLinearGradient(0, H - 25, 0, H);
    floorGrad.addColorStop(0, 'rgba(5,10,2,0)');
    floorGrad.addColorStop(1, 'rgba(5,10,2,0.95)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, H - 25, W, 25);

    // Left wall
    const leftGrad = ctx.createLinearGradient(0, 0, 25, 0);
    leftGrad.addColorStop(0, 'rgba(5,20,2,0.95)');
    leftGrad.addColorStop(1, 'rgba(5,20,2,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 25, H);

    // Right wall
    const rightGrad = ctx.createLinearGradient(W - 25, 0, W, 0);
    rightGrad.addColorStop(0, 'rgba(5,20,2,0)');
    rightGrad.addColorStop(1, 'rgba(5,20,2,0.95)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(W - 25, 0, 25, H);
  }

  renderClouds() {
    const ctx = this.ctx;
    this.clouds.forEach(c => {
      ctx.save();
      ctx.globalAlpha = c.opacity * 0.6;
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      // Soft misty jungle canopy clouds
      const puffs = [{ox:0,oy:0,rx:50,ry:22},{ox:-30,oy:6,rx:35,ry:18},{ox:30,oy:6,rx:38,ry:18},{ox:-15,oy:-10,rx:28,ry:16},{ox:15,oy:-10,rx:28,ry:16}];
      puffs.forEach(p => {
        const g = ctx.createRadialGradient(p.ox - 5, p.oy - 5, 2, p.ox, p.oy, Math.max(p.rx, p.ry));
        g.addColorStop(0,   'rgba(220,255,200,0.55)');
        g.addColorStop(0.5, 'rgba(180,230,160,0.30)');
        g.addColorStop(1,   'rgba(140,200,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.ox, p.oy, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  renderGrass() {
    const ctx = this.ctx;
    const t = this.animTime * 0.002;
    this.grasses.forEach(g => {
      const sway = Math.sin(t + g.swayOffset) * 4;
      // Blade 1 — main
      const lg = ctx.createLinearGradient(g.x, g.y, g.x + sway * 1.5, g.y - g.height);
      lg.addColorStop(0,   'rgba(20,50,8,0.9)');
      lg.addColorStop(0.5, g.color);
      lg.addColorStop(1,   `hsl(${115 + (g.swayOffset * 10) % 20},70%,55%)`);
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x + sway * 0.5, g.y - g.height * 0.55, g.x + sway * 1.5, g.y - g.height);
      ctx.stroke();
      // Blade 2 — offset
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(g.x + 4, g.y);
      ctx.quadraticCurveTo(g.x + 4 + sway * 0.6, g.y - g.height * 0.45, g.x + 4 + sway * 0.9, g.y - g.height * 0.8);
      ctx.stroke();
      // Blade 3 — thin back blade
      ctx.strokeStyle = 'rgba(30,80,10,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(g.x - 3, g.y);
      ctx.quadraticCurveTo(g.x - 3 + sway * 0.4, g.y - g.height * 0.3, g.x - 3 + sway * 0.7, g.y - g.height * 0.65);
      ctx.stroke();
    });
  }

  renderBushes() {
    const ctx = this.ctx;
    this.bushes.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.scale, b.scale);

      // Bush body
      const grad = ctx.createRadialGradient(0, -10, 5, 0, -5, 30);
      grad.addColorStop(0, '#5a9a2a');
      grad.addColorStop(1, '#2a5a10');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(0, -10, 22, 0, Math.PI * 2);
      ctx.arc(-15, -5, 16, 0, Math.PI * 2);
      ctx.arc(15, -5, 16, 0, Math.PI * 2);
      ctx.fill();

      // Leaves detail
      ctx.fillStyle = 'rgba(100,200,50,0.3)';
      ctx.beginPath();
      ctx.arc(-8, -18, 8, 0, Math.PI * 2);
      ctx.arc(8, -18, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  renderTrees(this: GameEngineService) {
    const ctx = this.ctx;
    const t = this.animTime * 0.001;

    // Sort trees by y so farther-back trees render first (depth)
    const sorted = [...this.trees].sort((a, b) => a.y - b.y);

    sorted.forEach(tree => {
      const sway = Math.sin(t * 0.9 + tree.swayOffset) * 2.5;
      ctx.save();
      ctx.translate(tree.x, tree.y);

      const trunkH = (50 + tree.type * 8) * tree.scale;
      const trunkW = (9 + tree.type * 2) * tree.scale;

      // ── Root flare ──────────────────────────────────────────────────────
      ctx.fillStyle = '#3a2008';
      for (let rf = 0; rf < 5; rf++) {
        const rfAngle = (rf / 5) * Math.PI + Math.PI * 0.1;
        const rfX = Math.cos(rfAngle) * trunkW * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(rfX * 0.5, -trunkH * 0.1, rfX, -trunkH * 0.05, rfX * 1.3, 4);
        ctx.bezierCurveTo(rfX * 0.8, -trunkH * 0.06, rfX * 0.3, -trunkH * 0.08, 0, 0);
        ctx.fill();
      }

      // ── Trunk shadow ─────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(trunkW * 0.6, 2, trunkW * 0.7, trunkH * 0.6, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // ── Trunk body ───────────────────────────────────────────────────────
      const trunkGrad = ctx.createLinearGradient(-trunkW, 0, trunkW, 0);
      trunkGrad.addColorStop(0,    '#2e1508');
      trunkGrad.addColorStop(0.25, '#5c3010');
      trunkGrad.addColorStop(0.5,  '#7a4218');
      trunkGrad.addColorStop(0.75, '#5c3010');
      trunkGrad.addColorStop(1,    '#2e1508');
      ctx.fillStyle = trunkGrad;
      ctx.beginPath();
      ctx.moveTo(-trunkW / 2, 0);
      ctx.bezierCurveTo(-trunkW * 0.6, -trunkH * 0.4, -trunkW * 0.4, -trunkH * 0.7, -trunkW * 0.3, -trunkH);
      ctx.lineTo(trunkW * 0.3, -trunkH);
      ctx.bezierCurveTo(trunkW * 0.4, -trunkH * 0.7, trunkW * 0.6, -trunkH * 0.4, trunkW / 2, 0);
      ctx.closePath();
      ctx.fill();

      // Bark lines
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.8;
      for (let b = 0; b < 5; b++) {
        const by = -(trunkH * 0.15) - b * (trunkH * 0.14);
        ctx.beginPath();
        ctx.moveTo(-trunkW * 0.45, by);
        ctx.quadraticCurveTo(0, by - 5, trunkW * 0.45, by);
        ctx.stroke();
      }
      // Highlight streak
      ctx.strokeStyle = 'rgba(200,150,80,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-trunkW * 0.1, -trunkH * 0.1);
      ctx.lineTo(-trunkW * 0.15, -trunkH * 0.85);
      ctx.stroke();

      // ── Canopy ────────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(sway * tree.scale, -trunkH);

      if (tree.type === 0) {
        // ── Broad tropical canopy ──────────────────────────────────────────
        // Under-canopy shadow blob
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(8, 12, 55 * tree.scale, 18 * tree.scale, 0, 0, Math.PI * 2);
        ctx.fill();
        // 3 layered circles, richer hues
        const layerColors = [
          ['#1e5c0a','#2d7c12'],  // deepest
          ['#2a7515','#3d9820'],  // mid
          ['#36941c','#4cb829'],  // brightest
        ];
        for (let layer = 0; layer < 3; layer++) {
          const r   = (45 + layer * 16) * tree.scale;
          const yOff = -layer * 12 * tree.scale;
          const grad = ctx.createRadialGradient(-r*0.2, yOff - r*0.3, r*0.05, 0, yOff, r);
          grad.addColorStop(0,   layerColors[layer][1]);
          grad.addColorStop(0.55, layerColors[layer][0]);
          grad.addColorStop(1,   '#152e06');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, yOff, r, 0, Math.PI * 2);
          ctx.fill();
          // Leaf edge details
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, yOff, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Sun catch on top
        ctx.fillStyle = 'rgba(180,255,120,0.08)';
        ctx.beginPath();
        ctx.arc(-14 * tree.scale, -38 * tree.scale, 20 * tree.scale, 0, Math.PI * 2);
        ctx.fill();

      } else if (tree.type === 1) {
        // ── Palm tree ─────────────────────────────────────────────────────
        const frondColors = ['#1e5c0a','#2d7510','#3a9018','#2a6010','#1a4808','#33841a'];
        for (let i = 0; i < 7; i++) {
          const fAngle = (i / 7) * Math.PI * 2 + t * 0.4 + tree.swayOffset;
          const fLen   = (55 + i * 5) * tree.scale;
          const droop  = Math.PI * 0.22;
          ctx.save();
          ctx.rotate(fAngle);
          // Frond
          const fg = ctx.createLinearGradient(0, 0, fLen, 0);
          fg.addColorStop(0,   frondColors[i % frondColors.length]);
          fg.addColorStop(0.5, frondColors[(i + 2) % frondColors.length]);
          fg.addColorStop(1,   '#0e3005');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(
            fLen * 0.3, -8 * tree.scale,
            fLen * 0.7, fLen * Math.sin(droop) * 0.5,
            fLen, fLen * Math.sin(droop)
          );
          ctx.bezierCurveTo(
            fLen * 0.7, fLen * Math.sin(droop) * 0.5 + 6,
            fLen * 0.3, -8 * tree.scale + 6, 0, 0
          );
          ctx.fill();
          // Leaflets on frond
          for (let lf = 1; lf <= 5; lf++) {
            const lprog = lf / 6;
            const lx = fLen * lprog * 0.9;
            const ly = lf * 3 * tree.scale * Math.sin(droop);
            ctx.strokeStyle = 'rgba(50,150,20,0.4)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + 8, ly - 10);
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + 8, ly + 4);
            ctx.stroke();
          }
          ctx.restore();
        }
        // Coconuts
        for (let cn = 0; cn < 3; cn++) {
          const ca = (cn / 3) * Math.PI * 2;
          ctx.fillStyle = '#5a3a10';
          ctx.beginPath();
          ctx.arc(Math.cos(ca) * 8, Math.sin(ca) * 5, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3a2008';
          ctx.beginPath();
          ctx.arc(Math.cos(ca) * 8 - 1, Math.sin(ca) * 5 - 1, 2, 0, Math.PI * 2);
          ctx.fill();
        }

      } else {
        // ── Tall jungle tree (irregular silhouette) ────────────────────────
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(10, 15, 50 * tree.scale, 15 * tree.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        const irregularColors = [
          '#1a5c08','#236e10','#2d8018','#1e6c0e','#358a1e'
        ];
        for (let layer = 3; layer >= 0; layer--) {
          const baseW = (42 - layer * 4) * tree.scale;
          const baseH = (28 + layer * 8) * tree.scale;
          const yBase = -layer * 14 * tree.scale;
          // Irregular blob shape
          ctx.fillStyle = irregularColors[layer % irregularColors.length];
          ctx.beginPath();
          ctx.moveTo(0, yBase);
          const pts = 8;
          for (let p = 0; p <= pts; p++) {
            const pAngle = (p / pts) * Math.PI * 2;
            const jitter = 0.75 + Math.sin(pAngle * 3 + layer + tree.swayOffset) * 0.28;
            ctx.lineTo(
              Math.cos(pAngle) * baseW * jitter,
              yBase + Math.sin(pAngle) * baseH * jitter
            );
          }
          ctx.closePath();
          ctx.fill();
          // Edge shadow
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Top highlight
        ctx.fillStyle = 'rgba(150,255,100,0.07)';
        ctx.beginPath();
        ctx.arc(-10 * tree.scale, -42 * tree.scale, 18 * tree.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // canopy
      ctx.restore(); // tree
    });
  }

  renderAnimals() {
    const ctx = this.ctx;
    const t = this.animTime * 0.003;

    this.animals.forEach(a => {
      if (!a.alive) return;
      const bob = Math.sin(t + a.bobOffset) * 4;

      ctx.save();
      ctx.translate(a.x, a.y + bob);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw emoji animal
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.emoji, 0, 0);

      // Glow ring (attractive)
      ctx.strokeStyle = 'rgba(255,255,100,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + Math.sin(t * 2 + a.bobOffset) * 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });
  }

  renderHunterSightCones() {
    const ctx = this.ctx;
    this.hunters.forEach(h => {
      if (h.state === 'patrol') {
        const alpha = 0.06 + Math.sin(this.animTime * 0.003) * 0.02;
        ctx.save();
        ctx.globalAlpha = alpha;
        const angle = h.direction === 'right' ? 0 : Math.PI;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.arc(h.x, h.y, h.sightRange, angle - h.sightAngle, angle + h.sightAngle);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (h.state === 'alert' || h.state === 'chase') {
        ctx.save();
        ctx.globalAlpha = 0.15 + Math.sin(this.animTime * 0.01) * 0.05;
        ctx.fillStyle = h.state === 'chase' ? '#ff4400' : '#ffaa00';
        const angle = h.direction === 'right' ? 0 : Math.PI;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.arc(h.x, h.y, h.sightRange, angle - h.sightAngle, angle + h.sightAngle);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
  }

  renderHunters() {
    const ctx = this.ctx;
    const t = this.animTime * 0.005;

    this.hunters.forEach(h => {
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.direction === 'left') ctx.scale(-1, 1);

      // Walking bob
      const walkBob = h.state === 'patrol' ? Math.sin(t * 4 + h.id) * 2 : Math.sin(t * 8 + h.id) * 3;
      const legSwing = Math.sin(t * 4 + h.id) * 0.4;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, walkBob);

      // Legs
      ctx.fillStyle = '#3a2010';
      ctx.save();
      ctx.rotate(legSwing);
      ctx.fillRect(-4, 10, 4, 14);
      ctx.restore();
      ctx.save();
      ctx.rotate(-legSwing);
      ctx.fillRect(0, 10, 4, 14);
      ctx.restore();

      // Boots
      ctx.fillStyle = '#2a1408';
      ctx.fillRect(-5, 22, 6, 4);
      ctx.fillRect(1, 22, 6, 4);

      // Body
      const bodyGrad = ctx.createLinearGradient(-8, -5, 8, -5);
      bodyGrad.addColorStop(0, h.state === 'chase' ? '#8b0000' : '#556b2f');
      bodyGrad.addColorStop(0.5, h.state === 'chase' ? '#aa0000' : '#6b8e3f');
      bodyGrad.addColorStop(1, h.state === 'chase' ? '#8b0000' : '#556b2f');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(-8, -10, 16, 20, 3);
      ctx.fill();

      // Arms
      ctx.fillStyle = '#4a6030';
      ctx.save();
      ctx.rotate(-legSwing * 0.5 - 0.2);
      ctx.fillRect(8, -8, 12, 4);
      // Gun
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(16, -9, 14, 3);
      ctx.restore();
      ctx.save();
      ctx.rotate(legSwing * 0.5);
      ctx.fillRect(-20, -8, 12, 4);
      ctx.restore();

      // Head
      ctx.fillStyle = '#d4956a';
      ctx.beginPath();
      ctx.arc(0, -16, 9, 0, Math.PI * 2);
      ctx.fill();

      // Hat
      ctx.fillStyle = h.state === 'chase' ? '#8b0000' : '#4a3010';
      ctx.fillRect(-10, -26, 20, 5);
      ctx.fillRect(-6, -36, 12, 12);

      // Eyes
      ctx.fillStyle = h.state === 'alert' || h.state === 'chase' ? '#ff0000' : '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -17, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(5, -17, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Alert indicator
      if (h.state === 'alert' || h.state === 'chase') {
        const blink = Math.sin(this.animTime * 0.02) > 0;
        if (blink || h.state === 'chase') {
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = h.state === 'chase' ? '#ff0000' : '#ffaa00';
          ctx.fillText(h.state === 'chase' ? '!' : '?', 0, -42);
        }
      }

      ctx.restore();
    });
  }

  renderSnake() {
    const ctx = this.ctx;
    if (this.snake.length === 0) return;
    const cs = this.config.cellSize;
    const t = this.animTime * 0.005;

    // Draw body from tail to head
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const seg = this.snake[i];
      const x = seg.x * cs + cs / 2;
      const y = seg.y * cs + cs / 2;
      const isHead = i === 0;
      const progress = i / this.snake.length;

      if (!this.snakeAlive) {
        ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / 1000);
      }

      // Body gradient
      const r = isHead ? cs * 0.45 : cs * (0.35 - progress * 0.05);

      // Snake body color - gradient from head to tail
      const hue = 100 + progress * 20;
      const saturation = 70 - progress * 20;
      const lightness = 35 + progress * 10;

      if (!isHead) {
        // Scale pattern
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Scale detail
        if (i % 2 === 0) {
          ctx.fillStyle = `hsl(${hue + 10}, ${saturation - 10}%, ${lightness - 8}%)`;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Outline
        ctx.strokeStyle = `hsl(${hue - 10}, ${saturation}%, ${lightness - 15}%)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isHead) {
        // Head
        const headGrad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r);
        headGrad.addColorStop(0, '#5ec832');
        headGrad.addColorStop(0.6, '#3a8a18');
        headGrad.addColorStop(1, '#1e5a08');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Head outline
        ctx.strokeStyle = '#1a4505';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Eyes
        const eyeAngle = this.direction === 'right' ? 0 : this.direction === 'left' ? Math.PI : this.direction === 'up' ? -Math.PI / 2 : Math.PI / 2;
        const ex1 = x + Math.cos(eyeAngle + 0.5) * r * 0.55;
        const ey1 = y + Math.sin(eyeAngle + 0.5) * r * 0.55;
        const ex2 = x + Math.cos(eyeAngle - 0.5) * r * 0.55;
        const ey2 = y + Math.sin(eyeAngle - 0.5) * r * 0.55;

        // Eye white
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex1, ey1, 3.5, 0, Math.PI * 2);
        ctx.arc(ex2, ey2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        const blink = this.snakeEyeBlinkTimer % 3000 > 2900;
        ctx.fillStyle = '#111';
        if (blink) {
          ctx.fillRect(ex1 - 3.5, ey1, 7, 1);
          ctx.fillRect(ex2 - 3.5, ey2, 7, 1);
        } else {
          ctx.beginPath();
          ctx.arc(ex1 + 0.5, ey1, 2, 0, Math.PI * 2);
          ctx.arc(ex2 + 0.5, ey2, 2, 0, Math.PI * 2);
          ctx.fill();
          // Eye shine
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(ex1 + 1, ey1 - 1, 0.8, 0, Math.PI * 2);
          ctx.arc(ex2 + 1, ey2 - 1, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tongue
        if (this.snakeTongueOut) {
          ctx.strokeStyle = '#f44';
          ctx.lineWidth = 1.5;
          const tx = x + Math.cos(eyeAngle) * r;
          const ty = y + Math.sin(eyeAngle) * r;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          const tongueLen = 14;
          const tx2 = tx + Math.cos(eyeAngle) * tongueLen;
          const ty2 = ty + Math.sin(eyeAngle) * tongueLen;
          ctx.lineTo(tx2, ty2);
          ctx.stroke();
          // Fork
          ctx.beginPath();
          ctx.moveTo(tx2, ty2);
          ctx.lineTo(tx2 + Math.cos(eyeAngle + 0.4) * 6, ty2 + Math.sin(eyeAngle + 0.4) * 6);
          ctx.moveTo(tx2, ty2);
          ctx.lineTo(tx2 + Math.cos(eyeAngle - 0.4) * 6, ty2 + Math.sin(eyeAngle - 0.4) * 6);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
    }
  }

  renderFlag() {
    const ctx = this.ctx;
    const fx = this.flagX;
    const fy = this.flagY;
    const t = this.flagWaveTimer;

    // Pole
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 50);
    ctx.lineTo(fx, fy - 60);
    ctx.stroke();

    // Flag cloth with wave animation
    const flagW = 50;
    const flagH = 30;
    ctx.save();
    ctx.translate(fx, fy - 50);

    // Draw wavy flag
    ctx.fillStyle = '#22cc22';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let px = 0; px <= flagW; px += 4) {
      const wave = Math.sin(t * 3 + px * 0.2) * 5;
      ctx.lineTo(px, wave);
    }
    for (let px = flagW; px >= 0; px -= 4) {
      const wave = Math.sin(t * 3 + px * 0.2) * 5 + flagH;
      ctx.lineTo(px, wave);
    }
    ctx.closePath();
    ctx.fill();

    // Flag star
    ctx.fillStyle = '#fff';
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('⭐', flagW / 2, flagH / 2 + Math.sin(t * 3 + flagW * 0.1) * 3);

    // "WIN" text on flag
    ctx.fillStyle = '#006600';
    ctx.font = 'bold 8px Arial';
    ctx.fillText('WIN!', flagW / 2, flagH / 2 + 12 + Math.sin(t * 3 + flagW * 0.1) * 3);

    ctx.restore();

    // Pole base
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.ellipse(fx, fy + 52, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow around flag
    const glow = ctx.createRadialGradient(fx, fy, 5, fx, fy, 80);
    glow.addColorStop(0, 'rgba(100,255,100,0.15)');
    glow.addColorStop(1, 'rgba(100,255,100,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, 80, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing rings
    const pulseR = 30 + Math.sin(this.animTime * 0.003) * 10;
    ctx.strokeStyle = `rgba(100,255,100,${0.4 - Math.sin(this.animTime * 0.003) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  renderParticles() {
    const ctx = this.ctx;
    this.particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;

      switch (p.type) {
        case 'sparkle':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          // Star shape
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(a) * p.size * 2, p.y + Math.sin(a) * p.size * 2);
            ctx.stroke();
          }
          break;
        case 'leaf':
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(this.animTime * 0.005 + p.vx);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        case 'blood':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'star':
          ctx.fillStyle = p.color;
          ctx.font = `${p.size * 2}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✦', p.x, p.y);
          break;
        case 'smoke':
          const smokeGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          smokeGrad.addColorStop(0, `rgba(100,100,100,${alpha * 0.5})`);
          smokeGrad.addColorStop(1, 'rgba(100,100,100,0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      ctx.restore();
    });
  }

  renderHUD() {
    const ctx = this.ctx;
    const W = this.canvas.width;

    // HUD Background bar
    const hudGrad = ctx.createLinearGradient(0, 0, 0, 50);
    hudGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
    hudGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, W, 50);

    // Score
    ctx.fillStyle = '#fcf';
    ctx.font = 'bold 14px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText(`🏆 Score: ${this.score}`, 15, 22);

    // High Score
    ctx.fillStyle = '#fc0';
    ctx.fillText(`⭐ Best: ${this.highScore}`, 15, 40);

    // Snake length
    ctx.fillStyle = '#8f8';
    ctx.textAlign = 'center';
    ctx.fillText(`🐍 Length: ${this.snake.length}`, W / 2, 22);

    // Animals remaining
    const alive = this.animals.filter(a => a.alive).length;
    ctx.fillStyle = '#f84';
    ctx.fillText(`🐾 Prey: ${alive}`, W / 2, 40);

    // Direction indicator
    ctx.fillStyle = '#adf';
    ctx.textAlign = 'right';
    ctx.fillText(`➡ Flag: ${Math.round(Math.abs(this.flagX - (this.snake[0]?.x ?? 0) * this.config.cellSize))}px`, W - 15, 22);

    // FPS (debug)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.fillText(`FPS: ${this.fps}`, W - 15, 40);

    // Controls reminder
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('WASD / Arrow Keys to move | P to pause', W / 2, this.canvas.height - 8);
  }

  renderPauseOverlay() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,20,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSED', W / 2, H / 2 - 20);
    ctx.font = '18px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 20);
  }

  /** Full-canvas GAME OVER overlay drawn right on the game world */
  renderDeathOverlay() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const cx  = W / 2;
    const cy  = H / 2;
    const t   = this.animTime * 0.002;

    // ── Dark vignette ──────────────────────────────────────────────────────
    const vign = ctx.createRadialGradient(cx, cy, 60, cx, cy, W * 0.75);
    vign.addColorStop(0,   'rgba(0,0,0,0.55)');
    vign.addColorStop(1,   'rgba(0,0,0,0.82)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);

    // ── Red blood splatter rings ────────────────────────────────────────────
    for (let r = 0; r < 3; r++) {
      const ring = ctx.createRadialGradient(cx, cy, 20 + r * 40, cx, cy, 70 + r * 50);
      ring.addColorStop(0,   `rgba(180,0,0,${0.18 - r * 0.04})`);
      ring.addColorStop(1,   'rgba(180,0,0,0)');
      ctx.fillStyle = ring;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Panel card ─────────────────────────────────────────────────────────
    const panW = 480, panH = 340;
    const panX = cx - panW / 2;
    const panY = cy - panH / 2;

    // Card shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(panX + 8, panY + 10, panW, panH, 20);
    ctx.fill();

    // Card body — dark jungle texture
    const cardGrad = ctx.createLinearGradient(panX, panY, panX, panY + panH);
    cardGrad.addColorStop(0,   '#0d1a08');
    cardGrad.addColorStop(0.4, '#12220c');
    cardGrad.addColorStop(1,   '#080f05');
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(panX, panY, panW, panH, 20);
    ctx.fill();

    // Card border — red glow
    ctx.save();
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = '#cc1111';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.roundRect(panX, panY, panW, panH, 20);
    ctx.stroke();
    ctx.restore();

    // ── Skull / hunter icon ────────────────────────────────────────────────
    ctx.font = '54px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const iconBob = Math.sin(t * 3) * 4;
    ctx.fillText(this.killedBy === 'hunter' ? '🎯' : '💀', cx, panY + 60 + iconBob);

    // ── GAME OVER title ────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur  = 22;
    ctx.font = 'bold 44px "Arial Black", Arial';
    ctx.fillStyle = '#ff3333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('GAME  OVER', cx, panY + 120);
    ctx.restore();

    // ── Kill message ──────────────────────────────────────────────────────
    ctx.font = '15px Arial';
    ctx.fillStyle = '#ffaaaa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const msg = this.killedBy === 'hunter'
      ? '⚠️  A hunter spotted you and pulled the trigger!'
      : '💥  You crashed into the jungle wall!';
    ctx.fillText(msg, cx, panY + 152);

    // ── Stats row ─────────────────────────────────────────────────────────
    const statsY = panY + 195;
    const statBoxes = [
      { label: 'SCORE',       value: String(this.score) },
      { label: 'LENGTH',      value: String(this.snake.length) },
      { label: 'BEST',        value: String(this.highScore) },
    ];
    const boxW = 120, boxH = 54, gap = 12;
    const totalBoxW = statBoxes.length * boxW + (statBoxes.length - 1) * gap;
    const boxStartX = cx - totalBoxW / 2;

    statBoxes.forEach((s, i) => {
      const bx = boxStartX + i * (boxW + gap);
      // Box bg
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(bx, statsY, boxW, boxH, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,100,100,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Value
      ctx.font = 'bold 22px "Courier New"';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.value, bx + boxW / 2, statsY + 30);
      // Label
      ctx.font = '10px Arial';
      ctx.fillStyle = '#888';
      ctx.fillText(s.label, bx + boxW / 2, statsY + 46);
    });

    // ── Buttons ───────────────────────────────────────────────────────────
    const btnY  = panY + panH - 70;
    const btnW  = 185;
    const btnH  = 46;
    const btn1X = cx - btnW - 10;
    const btn2X = cx + 10;

    this.overlayPlayAgainBtn = { x: btn1X, y: btnY, w: btnW, h: btnH };
    this.overlayMenuBtn      = { x: btn2X, y: btnY, w: btnW, h: btnH };

    // Play Again button
    const b1Grad = ctx.createLinearGradient(btn1X, btnY, btn1X, btnY + btnH);
    b1Grad.addColorStop(0,   '#2e7d32');
    b1Grad.addColorStop(1,   '#1b5e20');
    ctx.fillStyle = b1Grad;
    ctx.beginPath();
    ctx.roundRect(btn1X, btnY, btnW, btnH, 10);
    ctx.fill();
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔄  Play Again', btn1X + btnW / 2, btnY + btnH / 2);

    // Menu button
    const b2Grad = ctx.createLinearGradient(btn2X, btnY, btn2X, btnY + btnH);
    b2Grad.addColorStop(0,   '#37474f');
    b2Grad.addColorStop(1,   '#263238');
    ctx.fillStyle = b2Grad;
    ctx.beginPath();
    ctx.roundRect(btn2X, btnY, btnW, btnH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠  Main Menu', btn2X + btnW / 2, btnY + btnH / 2);
  }

  /** Call this from the component's canvas click handler */
  handleCanvasClick(ex: number, ey: number) {
    if (!this.overlayVisible) return;
    const { x: ax, y: ay, w: aw, h: ah } = this.overlayPlayAgainBtn;
    const { x: mx, y: my, w: mw, h: mh } = this.overlayMenuBtn;
    if (ex >= ax && ex <= ax + aw && ey >= ay && ey <= ay + ah) {
      this.overlayVisible = false;
      if (this.onPlayAgain) this.onPlayAgain();
    } else if (ex >= mx && ex <= mx + mw && ey >= my && ey <= my + mh) {
      this.overlayVisible = false;
      if (this.onGoMenu) this.onGoMenu();
    }
  }
}
