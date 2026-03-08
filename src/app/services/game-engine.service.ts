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

    // Generate grass patches — varied warm and cool tones
    this.grasses = [];
    for (let i = 0; i < 400; i++) {
      const hue = Math.random() < 0.6
        ? 95 + Math.random() * 30   // greens
        : 30 + Math.random() * 20;  // warm yellowy browns (dry grass)
      this.grasses.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        height: 8 + Math.random() * 16,
        swayOffset: Math.random() * Math.PI * 2,
        color: `hsl(${hue}, ${55 + Math.random() * 30}%, ${28 + Math.random() * 20}%)`
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

    // Sky/Ground gradient background — warm amber-brown jungle tones
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#3d2810');
    skyGrad.addColorStop(0.3, '#4a3218');
    skyGrad.addColorStop(1, '#1e1208');
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

    // ── 1. Sky strip — warm amber jungle canopy glow ─────────────────────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.18);
    skyGrad.addColorStop(0,   '#5c3d1e');  // warm amber-brown canopy
    skyGrad.addColorStop(0.5, '#3d2a0e');
    skyGrad.addColorStop(1,   '#2a1a08');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.18);

    // ── 2. Main ground – rich layered earth tones ────────────────────────
    const groundGrad = ctx.createLinearGradient(0, H * 0.1, 0, H);
    groundGrad.addColorStop(0,    '#4a3520');  // surface — warm brown earth
    groundGrad.addColorStop(0.12, '#3d2a12');
    groundGrad.addColorStop(0.25, '#5c3d18');  // reddish topsoil
    groundGrad.addColorStop(0.45, '#3a2808');
    groundGrad.addColorStop(0.65, '#261a05');  // dark earth
    groundGrad.addColorStop(1,    '#120c02');
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

    // ── 4. Moss + earth patches (varied colors, not all green) ─────────────
    const mossSeeds = [
      {x:120,y:80,  c:'rgba(42,90,18,0.6)'},
      {x:350,y:200, c:'rgba(80,50,10,0.5)'},
      {x:600,y:130, c:'rgba(42,90,18,0.5)'},
      {x:800,y:310, c:'rgba(100,60,15,0.5)'},
      {x:200,y:350, c:'rgba(50,100,20,0.55)'},
      {x:1000,y:180,c:'rgba(60,40,10,0.5)'},
      {x:450,y:420, c:'rgba(42,90,18,0.6)'},
      {x:700,y:500, c:'rgba(90,55,12,0.4)'},
      {x:1100,y:400,c:'rgba(42,90,18,0.5)'},
      {x:300,y:500, c:'rgba(70,45,10,0.5)'},
      {x:900,y:560, c:'rgba(42,90,18,0.6)'},
      {x:150,y:480, c:'rgba(55,35,8,0.5)'},
      {x:550,y:60,  c:'rgba(42,90,18,0.5)'},
      {x:1250,y:300,c:'rgba(80,50,10,0.4)'},
      {x:1400,y:500,c:'rgba(42,90,18,0.55)'},
      {x:60,y:300,  c:'rgba(65,42,10,0.5)'},
    ];
    mossSeeds.forEach(({x: mx, y: my, c}) => {
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 55);
      grad.addColorStop(0,   c);
      grad.addColorStop(0.5, c.replace(/[\d.]+\)$/, '0.25)'));
      grad.addColorStop(1,   'rgba(0,0,0,0)');
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

    const sorted = [...this.trees].sort((a, b) => a.y - b.y);

    sorted.forEach(tree => {
      const sway = Math.sin(t * 0.9 + tree.swayOffset) * 2.5;
      ctx.save();
      ctx.translate(tree.x, tree.y);

      const trunkH = (55 + tree.type * 10) * tree.scale;
      const trunkW = (10 + tree.type * 2) * tree.scale;

      // ── Ground shadow ────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(8, 5, trunkW * 2.5, trunkH * 0.25, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // ── Root flare — thick buttress roots ───────────────────────────────
      for (let rf = 0; rf < 6; rf++) {
        const rfAngle = (rf / 6) * Math.PI * 2;
        const rfLen   = trunkW * 1.6 + rf * 2;
        const rfX     = Math.cos(rfAngle) * rfLen;
        const rfY     = Math.sin(rfAngle) * rfLen * 0.4;
        // Root shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.quadraticCurveTo(rfX * 0.6 + 2, rfY * 0.5 + 3, rfX * 1.1 + 2, rfY * 1.1 + 3);
        ctx.quadraticCurveTo(rfX * 0.5 + 2, rfY * 0.3 + 3, 2, 2);
        ctx.fill();
        // Root
        const rootG = ctx.createLinearGradient(0, 0, rfX, rfY);
        rootG.addColorStop(0, '#5c3210');
        rootG.addColorStop(0.5, '#7a4820');
        rootG.addColorStop(1, '#3a2008');
        ctx.fillStyle = rootG;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(rfX * 0.6, rfY * 0.5, rfX * 1.1, rfY * 1.1);
        ctx.quadraticCurveTo(rfX * 0.5, rfY * 0.3, 0, 0);
        ctx.fill();
      }

      // ── Trunk — thick, tapered, realistic bark ───────────────────────────
      // Trunk shadow (cast to the right)
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(trunkW * 0.3, 0);
      ctx.bezierCurveTo(trunkW * 1.2, -trunkH * 0.3, trunkW * 1.0, -trunkH * 0.7, trunkW * 0.2, -trunkH);
      ctx.lineTo(trunkW * 0.5, -trunkH);
      ctx.bezierCurveTo(trunkW * 0.8, -trunkH * 0.6, trunkW * 0.9, -trunkH * 0.3, trunkW * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      // Trunk main body — 3-tone bark
      const trunkGrad = ctx.createLinearGradient(-trunkW, 0, trunkW, 0);
      trunkGrad.addColorStop(0,    '#2a1206');
      trunkGrad.addColorStop(0.15, '#4a2410');
      trunkGrad.addColorStop(0.35, '#7a4828');
      trunkGrad.addColorStop(0.5,  '#9a6038');
      trunkGrad.addColorStop(0.65, '#7a4828');
      trunkGrad.addColorStop(0.85, '#4a2410');
      trunkGrad.addColorStop(1,    '#2a1206');
      ctx.fillStyle = trunkGrad;
      ctx.beginPath();
      ctx.moveTo(-trunkW * 0.55, 0);
      ctx.bezierCurveTo(-trunkW * 0.65, -trunkH * 0.35, -trunkW * 0.4, -trunkH * 0.65, -trunkW * 0.28, -trunkH);
      ctx.lineTo(trunkW * 0.28, -trunkH);
      ctx.bezierCurveTo(trunkW * 0.4, -trunkH * 0.65, trunkW * 0.65, -trunkH * 0.35, trunkW * 0.55, 0);
      ctx.closePath();
      ctx.fill();

      // Bark texture — horizontal fissures
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      for (let b = 0; b < 7; b++) {
        const by = -(trunkH * 0.12) - b * (trunkH * 0.11);
        const bw = trunkW * (0.45 - b * 0.02);
        ctx.lineWidth = 0.9 + b * 0.05;
        ctx.beginPath();
        ctx.moveTo(-bw, by);
        ctx.quadraticCurveTo(0, by - 4 + (b % 2) * 3, bw, by);
        ctx.stroke();
      }
      // Vertical bark grain
      ctx.strokeStyle = 'rgba(200,130,60,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-trunkW * 0.08, -trunkH * 0.08);
      ctx.lineTo(-trunkW * 0.12, -trunkH * 0.88);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(trunkW * 0.05, -trunkH * 0.1);
      ctx.lineTo(trunkW * 0.08, -trunkH * 0.82);
      ctx.stroke();

      // Moss on trunk — darker green patches on shaded side
      ctx.fillStyle = 'rgba(30,70,15,0.35)';
      ctx.beginPath();
      ctx.ellipse(-trunkW * 0.35, -trunkH * 0.4, trunkW * 0.2, trunkH * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // ── Canopy ────────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(sway * tree.scale, -trunkH);

      if (tree.type === 0) {
        // ── Type 0: Dense broad-leaf tropical tree ────────────────────────
        // Under-canopy darkness
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(6, 14, 58 * tree.scale, 16 * tree.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 layered foliage clumps — varied greens + dark interior
        const layers = [
          { r: 38, y:  0,  c0: '#1a4a08', c1: '#2a6a12', c2: '#3a8a1e' },
          { r: 46, y: -10, c0: '#1e5a0a', c1: '#2e7a16', c2: '#3e9a22' },
          { r: 40, y: -20, c0: '#22600c', c1: '#308020', c2: '#40a030' },
          { r: 28, y: -30, c0: '#286a10', c1: '#388a20', c2: '#48a830' },
        ];
        layers.forEach(({ r, y, c0, c1, c2 }) => {
          const rs = r * tree.scale;
          const grad = ctx.createRadialGradient(-rs * 0.25, y - rs * 0.35, rs * 0.05, 0, y, rs);
          grad.addColorStop(0,   c2);
          grad.addColorStop(0.5, c1);
          grad.addColorStop(0.8, c0);
          grad.addColorStop(1,   '#0a2005');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, y, rs, 0, Math.PI * 2);
          ctx.fill();
          // Leaf edge lumps
          for (let lm = 0; lm < 8; lm++) {
            const la = (lm / 8) * Math.PI * 2;
            const lx = Math.cos(la) * (rs - 4);
            const ly = y + Math.sin(la) * (rs - 4);
            ctx.fillStyle = c1;
            ctx.beginPath();
            ctx.arc(lx, ly, rs * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Sunlit top highlight
        ctx.fillStyle = 'rgba(160,255,100,0.07)';
        ctx.beginPath();
        ctx.arc(-16 * tree.scale, -34 * tree.scale, 22 * tree.scale, 0, Math.PI * 2);
        ctx.fill();

      } else if (tree.type === 1) {
        // ── Type 1: Realistic palm tree ───────────────────────────────────
        const frondPairs = [
          { a: -1.6, len: 60, c: '#1e5c0a' },
          { a: -0.9, len: 68, c: '#2a7010' },
          { a: -0.3, len: 72, c: '#327818' },
          { a:  0.3, len: 72, c: '#327818' },
          { a:  0.9, len: 68, c: '#2a7010' },
          { a:  1.6, len: 60, c: '#1e5c0a' },
          { a: -2.3, len: 55, c: '#1a5008' },
          { a:  2.3, len: 55, c: '#1a5008' },
        ];
        frondPairs.forEach(({ a, len, c }) => {
          const fLen = len * tree.scale;
          const droop = 0.28;
          ctx.save();
          ctx.rotate(a + Math.sin(t * 0.8 + tree.swayOffset + a) * 0.08);

          // Frond stem
          ctx.strokeStyle = '#1a4a06';
          ctx.lineWidth = 2 * tree.scale;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(
            fLen * 0.3, -5 * tree.scale,
            fLen * 0.6, fLen * Math.sin(droop) * 0.4,
            fLen, fLen * Math.sin(droop)
          );
          ctx.stroke();

          // Leaflets along frond
          for (let lf = 2; lf <= 10; lf++) {
            const prog = lf / 11;
            const lx = fLen * prog;
            const ly = fLen * prog * Math.sin(droop) * 0.7;
            const lSize = (14 - lf) * tree.scale * 0.8;
            const lAngle = droop * prog * 0.8;

            ctx.fillStyle = c;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(lAngle);
            // Left leaflet
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-4, -lSize * 0.5, -8, -lSize * 0.8, -lSize, 0);
            ctx.bezierCurveTo(-8, lSize * 0.3, -4, lSize * 0.2, 0, 0);
            ctx.fill();
            // Right leaflet
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(4, -lSize * 0.5, 8, -lSize * 0.8, lSize, 0);
            ctx.bezierCurveTo(8, lSize * 0.3, 4, lSize * 0.2, 0, 0);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        });

        // Coconut cluster
        for (let cn = 0; cn < 4; cn++) {
          const ca = (cn / 4) * Math.PI * 2;
          const cr = 7 * tree.scale;
          ctx.fillStyle = '#6b4510';
          ctx.beginPath();
          ctx.arc(Math.cos(ca) * 9 * tree.scale, Math.sin(ca) * 6 * tree.scale - 2, cr, 0, Math.PI * 2);
          ctx.fill();
          // Coconut detail
          ctx.fillStyle = '#3a2008';
          ctx.beginPath();
          ctx.arc(Math.cos(ca) * 9 * tree.scale - 1, Math.sin(ca) * 6 * tree.scale - 3, cr * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2a1005';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(Math.cos(ca) * 9 * tree.scale, Math.sin(ca) * 6 * tree.scale - 2, cr, 0, Math.PI * 2);
          ctx.stroke();
        }

      } else {
        // ── Type 2: Tall emergent jungle tree with umbrella crown ─────────
        // Cast shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(10, 18, 52 * tree.scale, 14 * tree.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Multiple irregular foliage masses — like real jungle canopy
        const masses = [
          { x:  0, y:   0, rx: 40, ry: 22, angle: 0,    dark: '#163808', mid: '#204f0c', light: '#2d6e10' },
          { x: -22, y: -14, rx: 28, ry: 18, angle: -0.3, dark: '#1a4208', mid: '#26580e', light: '#337812' },
          { x:  22, y: -12, rx: 30, ry: 20, angle:  0.2, dark: '#1c4408', mid: '#284e0e', light: '#357010' },
          { x:  -8, y: -28, rx: 24, ry: 16, angle: -0.1, dark: '#1e4a0a', mid: '#2c6412', light: '#3a8218' },
          { x:  12, y: -28, rx: 22, ry: 15, angle:  0.15,dark: '#204c0a', mid: '#2e6614', light: '#3c841a' },
          { x:   2, y: -42, rx: 18, ry: 13, angle:  0,   dark: '#226010', mid: '#307016', light: '#40901e' },
        ];

        masses.forEach(({ x, y, rx, ry, angle, dark, mid, light }) => {
          const rxs = rx * tree.scale;
          const rys = ry * tree.scale;
          const xs  = x * tree.scale;
          const ys  = y * tree.scale;

          const grad = ctx.createRadialGradient(xs - rxs * 0.2, ys - rys * 0.3, rxs * 0.05, xs, ys, rxs);
          grad.addColorStop(0,   light);
          grad.addColorStop(0.5, mid);
          grad.addColorStop(0.85, dark);
          grad.addColorStop(1,   '#080f03');
          ctx.fillStyle = grad;

          ctx.save();
          ctx.translate(xs, ys);
          ctx.rotate(angle);
          // Jagged leaf-mass edge
          ctx.beginPath();
          const pts = 10;
          for (let p = 0; p <= pts; p++) {
            const pa = (p / pts) * Math.PI * 2;
            const jitter = 0.82 + Math.sin(pa * 4 + tree.swayOffset + p) * 0.2;
            const ex = Math.cos(pa) * rxs * jitter;
            const ey = Math.sin(pa) * rys * jitter;
            p === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
          }
          ctx.closePath();
          ctx.fill();

          // Edge leaf bumps
          ctx.fillStyle = mid;
          for (let bm = 0; bm < 6; bm++) {
            const ba = (bm / 6) * Math.PI * 2 + tree.swayOffset;
            ctx.beginPath();
            ctx.arc(Math.cos(ba) * rxs * 0.9, Math.sin(ba) * rys * 0.9, rxs * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });

        // Top sunlit highlight
        ctx.fillStyle = 'rgba(140,255,80,0.06)';
        ctx.beginPath();
        ctx.arc(-8 * tree.scale, -46 * tree.scale, 20 * tree.scale, 0, Math.PI * 2);
        ctx.fill();

        // Epiphytic plants / aerial roots hanging
        for (let ar = 0; ar < 3; ar++) {
          const arX = (-15 + ar * 15) * tree.scale;
          const arLen = (20 + ar * 8) * tree.scale;
          ctx.strokeStyle = 'rgba(30,80,10,0.5)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(arX, 5);
          ctx.lineTo(arX + Math.sin(t + ar) * 4, arLen);
          ctx.stroke();
        }
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
      const bob = Math.sin(t + a.bobOffset) * 3;

      ctx.save();
      ctx.translate(a.x, a.y + bob);

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw each animal type as a real pixel-art creature
      switch (a.type) {
        case 'rabbit':   this.drawRabbit(ctx, t, a.bobOffset); break;
        case 'frog':     this.drawFrog(ctx, t, a.bobOffset); break;
        case 'bird':     this.drawBird(ctx, t, a.bobOffset); break;
        case 'mouse':    this.drawMouse(ctx, t, a.bobOffset); break;
        case 'butterfly':this.drawButterfly(ctx, t, a.bobOffset); break;
      }

      // Pulsing attract ring
      const ring = 18 + Math.sin(t * 2 + a.bobOffset) * 3;
      ctx.strokeStyle = 'rgba(255,240,80,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, ring, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });
  }

  drawRabbit(ctx: CanvasRenderingContext2D, t: number, offset: number) {
    const hop = Math.abs(Math.sin(t * 3 + offset)) * 4;
    ctx.save();
    ctx.translate(0, -hop);

    // Body — creamy white
    ctx.fillStyle = '#e8ddc8';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8b89a';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#e8ddc8';
    ctx.beginPath();
    ctx.ellipse(0, -8, 7, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8b89a';
    ctx.stroke();

    // Ears
    ctx.fillStyle = '#e8ddc8';
    ctx.beginPath();
    ctx.ellipse(-4, -18, 2.5, 7, -0.2, 0, Math.PI * 2);
    ctx.ellipse( 4, -18, 2.5, 7,  0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8b89a';
    ctx.stroke();
    // Inner ear pink
    ctx.fillStyle = '#f0a0a0';
    ctx.beginPath();
    ctx.ellipse(-4, -18, 1.2, 5, -0.2, 0, Math.PI * 2);
    ctx.ellipse( 4, -18, 1.2, 5,  0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — dark brown
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath();
    ctx.arc(-2.5, -9, 1.5, 0, Math.PI * 2);
    ctx.arc( 2.5, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-1.8, -9.6, 0.5, 0, Math.PI * 2);
    ctx.arc( 3.2, -9.6, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#f08080';
    ctx.beginPath();
    ctx.arc(0, -6.5, 1, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 14, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#d8c8b0';
    ctx.beginPath();
    ctx.ellipse(-5, 12, 3.5, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse( 5, 12, 3.5, 5,  0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawFrog(ctx: CanvasRenderingContext2D, t: number, offset: number) {
    const blink = Math.sin(t * 2 + offset) > 0.8;
    ctx.save();

    // Legs — wide splayed
    ctx.fillStyle = '#3a8040';
    ctx.beginPath();
    ctx.ellipse(-10, 8, 7, 4, -0.6, 0, Math.PI * 2);
    ctx.ellipse( 10, 8, 7, 4,  0.6, 0, Math.PI * 2);
    ctx.fill();
    // Feet
    ctx.fillStyle = '#2a6030';
    ctx.beginPath();
    ctx.ellipse(-16, 10, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse( 16, 10, 5, 3,  0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body — bright jungle green
    const bodyGrad = ctx.createRadialGradient(-3, -2, 1, 0, 2, 11);
    bodyGrad.addColorStop(0, '#5fbd5f');
    bodyGrad.addColorStop(0.6, '#3a9040');
    bodyGrad.addColorStop(1, '#1e6020');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e5018';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Belly — pale
    ctx.fillStyle = '#c8e8a0';
    ctx.beginPath();
    ctx.ellipse(0, 6, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    const headGrad = ctx.createRadialGradient(-2, -10, 1, 0, -8, 8);
    headGrad.addColorStop(0, '#5fbd5f');
    headGrad.addColorStop(1, '#2a7a30');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, -8, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e5018';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Eyes — bulgy on top
    ctx.fillStyle = '#2a8030';
    ctx.beginPath();
    ctx.ellipse(-6, -13, 4, 4, 0, 0, Math.PI * 2);
    ctx.ellipse( 6, -13, 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2a8030' : '#f0d800';
    ctx.beginPath();
    ctx.ellipse(-6, -13, 3, blink ? 0.8 : 3, 0, 0, Math.PI * 2);
    ctx.ellipse( 6, -13, 3, blink ? 0.8 : 3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-6, -13, 1.5, 0, Math.PI * 2);
      ctx.arc( 6, -13, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-5, -14, 0.6, 0, Math.PI * 2);
      ctx.arc( 7, -14, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth line
    ctx.strokeStyle = '#1a4010';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.restore();
  }

  drawBird(ctx: CanvasRenderingContext2D, t: number, offset: number) {
    const wingFlap = Math.sin(t * 6 + offset) * 0.4;
    ctx.save();

    // Wings — flapping
    ctx.save();
    ctx.rotate(-wingFlap);
    ctx.fillStyle = '#e85a10';
    ctx.beginPath();
    ctx.ellipse(-10, -2, 12, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c04000';
    ctx.beginPath();
    ctx.ellipse(-10, -2, 9, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.rotate(wingFlap);
    ctx.fillStyle = '#e85a10';
    ctx.beginPath();
    ctx.ellipse(10, -2, 12, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c04000';
    ctx.beginPath();
    ctx.ellipse(10, -2, 9, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body — vivid orange-red
    const bodyGrad = ctx.createRadialGradient(-2, -2, 1, 0, 2, 9);
    bodyGrad.addColorStop(0, '#ff7030');
    bodyGrad.addColorStop(0.6, '#e84010');
    bodyGrad.addColorStop(1, '#a02800');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#802000';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Tail feathers
    ctx.fillStyle = '#c03000';
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(-7, 18);
    ctx.lineTo(-2, 13);
    ctx.lineTo(0, 19);
    ctx.lineTo(2, 13);
    ctx.lineTo(7, 18);
    ctx.lineTo(4, 11);
    ctx.closePath();
    ctx.fill();

    // Head
    const headGrad = ctx.createRadialGradient(-2, -10, 1, 0, -9, 6);
    headGrad.addColorStop(0, '#ff7030');
    headGrad.addColorStop(1, '#c03010');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -9, 6, 0, Math.PI * 2);
    ctx.fill();

    // Crest
    ctx.fillStyle = '#ff9040';
    ctx.beginPath();
    ctx.moveTo(-2, -14);
    ctx.lineTo(0, -20);
    ctx.lineTo(2, -14);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(3, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0000';
    ctx.beginPath();
    ctx.arc(3.5, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, -10.5, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f0c020';
    ctx.beginPath();
    ctx.moveTo(5, -9);
    ctx.lineTo(12, -8);
    ctx.lineTo(10, -6);
    ctx.lineTo(5, -7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawMouse(ctx: CanvasRenderingContext2D, t: number, offset: number) {
    const wiggle = Math.sin(t * 5 + offset) * 2;
    ctx.save();

    // Tail — long curvy
    ctx.strokeStyle = '#c09070';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(5 + wiggle, 15, 10, 12, 18, 16);
    ctx.stroke();

    // Body — warm grey-brown
    const bodyGrad = ctx.createRadialGradient(-2, 0, 1, 0, 2, 9);
    bodyGrad.addColorStop(0, '#b8a090');
    bodyGrad.addColorStop(0.6, '#907060');
    bodyGrad.addColorStop(1, '#604838');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#504030';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#a89080';
    ctx.beginPath();
    ctx.ellipse(0, -8, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#504030';
    ctx.stroke();

    // Ears — large round pink
    ctx.fillStyle = '#907060';
    ctx.beginPath();
    ctx.arc(-6, -14, 5, 0, Math.PI * 2);
    ctx.arc( 6, -14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e09090';
    ctx.beginPath();
    ctx.arc(-6, -14, 3, 0, Math.PI * 2);
    ctx.arc( 6, -14, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — small beady
    ctx.fillStyle = '#1a1010';
    ctx.beginPath();
    ctx.arc(-2.5, -9, 1.8, 0, Math.PI * 2);
    ctx.arc( 2.5, -9, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-1.8, -9.6, 0.6, 0, Math.PI * 2);
    ctx.arc( 3.2, -9.6, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#c09080';
    ctx.beginPath();
    ctx.ellipse(0, -5.5, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a06050';
    ctx.beginPath();
    ctx.arc(0, -5, 1, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.7;
    for (let w = -1; w <= 1; w += 2) {
      ctx.beginPath();
      ctx.moveTo(w * 2, -6);
      ctx.lineTo(w * 12, -5 + wiggle * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 2, -5);
      ctx.lineTo(w * 12, -7 - wiggle * 0.3);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawButterfly(ctx: CanvasRenderingContext2D, t: number, offset: number) {
    const flap = Math.sin(t * 7 + offset);
    const wingX = Math.abs(flap) * 14 + 4;
    ctx.save();

    // Upper wings — vivid purple-blue
    ctx.save();
    ctx.scale(wingX / 18, 1);
    ctx.fillStyle = '#9040e0';
    ctx.beginPath();
    ctx.ellipse(-9, -6, 14, 10, -0.4, 0, Math.PI * 2);
    ctx.ellipse( 9, -6, 14, 10,  0.4, 0, Math.PI * 2);
    ctx.fill();
    // Wing pattern
    ctx.fillStyle = '#c080ff';
    ctx.beginPath();
    ctx.ellipse(-8, -7, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse( 8, -7, 8, 5,  0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c0ff';
    ctx.beginPath();
    ctx.ellipse(-7, -8, 4, 2.5, -0.4, 0, Math.PI * 2);
    ctx.ellipse( 7, -8, 4, 2.5,  0.4, 0, Math.PI * 2);
    ctx.fill();

    // Lower wings — orange accents
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.ellipse(-8, 4, 10, 7, 0.3, 0, Math.PI * 2);
    ctx.ellipse( 8, 4, 10, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(-7, 4, 5, 4, 0.3, 0, Math.PI * 2);
    ctx.ellipse( 7, 4, 5, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body — thin dark
    ctx.fillStyle = '#2a1060';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.5, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#3a1080';
    ctx.beginPath();
    ctx.arc(0, -12, 3, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#2a1060';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, -14);
    ctx.bezierCurveTo(-5, -20, -8, -22, -9, -25);
    ctx.moveTo( 1, -14);
    ctx.bezierCurveTo( 5, -20,  8, -22,  9, -25);
    ctx.stroke();
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(-9, -25, 1.5, 0, Math.PI * 2);
    ctx.arc( 9, -25, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

      const r = isHead ? cs * 0.48 : cs * (0.38 - progress * 0.04);

      if (!isHead) {
        // Vivid yellow-green body with dark diamond pattern
        const baseHue = 80;  // yellow-green — not all-green
        const bodyGrad = ctx.createRadialGradient(x - r*0.3, y - r*0.3, 1, x, y, r);
        bodyGrad.addColorStop(0,   `hsl(${baseHue + progress*15}, 80%, 55%)`);
        bodyGrad.addColorStop(0.5, `hsl(${baseHue + progress*15}, 70%, 35%)`);
        bodyGrad.addColorStop(1,   `hsl(${baseHue + progress*15}, 60%, 20%)`);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Diamond scale pattern every 2 segments
        if (i % 2 === 0) {
          ctx.fillStyle = `hsl(${baseHue - 20 + progress*10}, 60%, 18%)`;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.65, r * 0.45, Math.PI * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bright yellow belly stripe
        if (i % 3 === 0) {
          ctx.fillStyle = `rgba(230, 200, 40, 0.35)`;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.35, r * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dark outline
        ctx.strokeStyle = `hsl(${baseHue - 20}, 60%, 12%)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isHead) {
        // Head — brighter, distinct from body
        const headGrad = ctx.createRadialGradient(x - r*0.35, y - r*0.35, 1, x, y, r);
        headGrad.addColorStop(0,   '#a0e040');  // bright lime
        headGrad.addColorStop(0.5, '#60b020');
        headGrad.addColorStop(1,   '#2a6008');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Head plate pattern
        ctx.fillStyle = 'rgba(40,100,5,0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.7, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head outline
        ctx.strokeStyle = '#1a4005';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Eyes
        const eyeAngle = this.direction === 'right' ? 0 : this.direction === 'left' ? Math.PI : this.direction === 'up' ? -Math.PI / 2 : Math.PI / 2;
        const ex1 = x + Math.cos(eyeAngle + 0.5) * r * 0.58;
        const ey1 = y + Math.sin(eyeAngle + 0.5) * r * 0.58;
        const ex2 = x + Math.cos(eyeAngle - 0.5) * r * 0.58;
        const ey2 = y + Math.sin(eyeAngle - 0.5) * r * 0.58;

        // Eye white + golden iris
        ctx.fillStyle = '#ffe080';
        ctx.beginPath();
        ctx.arc(ex1, ey1, 3.8, 0, Math.PI * 2);
        ctx.arc(ex2, ey2, 3.8, 0, Math.PI * 2);
        ctx.fill();

        const blink = this.snakeEyeBlinkTimer % 3000 > 2900;
        ctx.fillStyle = '#1a0000';
        if (blink) {
          ctx.fillRect(ex1 - 3.8, ey1 - 0.5, 7.6, 1);
          ctx.fillRect(ex2 - 3.8, ey2 - 0.5, 7.6, 1);
        } else {
          // Slit pupil (reptilian)
          ctx.beginPath();
          ctx.ellipse(ex1 + 0.5, ey1, 1.2, 2.8, 0, 0, Math.PI * 2);
          ctx.ellipse(ex2 + 0.5, ey2, 1.2, 2.8, 0, 0, Math.PI * 2);
          ctx.fill();
          // Eye shine
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.arc(ex1 + 0.8, ey1 - 1.2, 0.9, 0, Math.PI * 2);
          ctx.arc(ex2 + 0.8, ey2 - 1.2, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tongue
        if (this.snakeTongueOut) {
          ctx.strokeStyle = '#e02020';
          ctx.lineWidth = 1.8;
          const tx = x + Math.cos(eyeAngle) * r;
          const ty = y + Math.sin(eyeAngle) * r;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          const tongueLen = 16;
          const tx2 = tx + Math.cos(eyeAngle) * tongueLen;
          const ty2 = ty + Math.sin(eyeAngle) * tongueLen;
          ctx.lineTo(tx2, ty2);
          ctx.stroke();
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tx2, ty2);
          ctx.lineTo(tx2 + Math.cos(eyeAngle + 0.45) * 7, ty2 + Math.sin(eyeAngle + 0.45) * 7);
          ctx.moveTo(tx2, ty2);
          ctx.lineTo(tx2 + Math.cos(eyeAngle - 0.45) * 7, ty2 + Math.sin(eyeAngle - 0.45) * 7);
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
    ctx.font = '60px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const iconBob = Math.sin(t * 3) * 4;
    ctx.fillText(this.killedBy === 'hunter' ? '🎯' : '💀', cx, panY + 64 + iconBob);

    // ── GAME OVER title ────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur  = 30;
    ctx.font = 'bold 52px "Arial Black", Arial';
    // Red gradient text
    const goGrad = ctx.createLinearGradient(cx - 160, 0, cx + 160, 0);
    goGrad.addColorStop(0, '#ff2222');
    goGrad.addColorStop(0.5, '#ff6666');
    goGrad.addColorStop(1, '#ff2222');
    ctx.fillStyle = goGrad;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('GAME  OVER', cx, panY + 128);
    ctx.restore();

    // ── Kill message ──────────────────────────────────────────────────────
    ctx.font = '16px Arial';
    ctx.fillStyle = '#ffbbbb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const msg = this.killedBy === 'hunter'
      ? '🔫  A hunter spotted you and pulled the trigger!'
      : '💥  You crashed into the jungle boundary!';
    ctx.fillText(msg, cx, panY + 158);

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
