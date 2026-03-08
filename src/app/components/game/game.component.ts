import {
  Component, ElementRef, ViewChild, OnInit, OnDestroy,
  HostListener, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="game-wrapper">

      <!-- MENU SCREEN -->
      <div class="screen menu-screen" *ngIf="engine.gameState === 'menu'">
        <div class="jungle-title-bg">
          <div class="title-trees">
            <span class="tree-emoji" *ngFor="let t of titleTrees; let i = index"
              [style.font-size]="t.size + 'px'"
              [style.left]="t.x + '%'"
              [style.bottom]="t.y + 'px'"
              [style.animation-delay]="i * 0.3 + 's'">🌴</span>
          </div>
          <div class="animals-parade">
            <span class="parade-animal" *ngFor="let a of paradeAnimals; let i = index"
              [style.animation-delay]="i * 0.6 + 's'">{{a}}</span>
          </div>
        </div>
        <div class="menu-content">
          <div class="game-logo">
            <div class="logo-snake">🐍</div>
            <h1 class="game-title">
              <span class="title-word">JUNGLE</span>
              <span class="title-divider">✦</span>
              <span class="title-word snake-word">SERPENT</span>
            </h1>
            <p class="game-subtitle">Survive the Jungle. Grow. Escape.</p>
          </div>

          <div class="menu-cards">
            <div class="info-card">
              <h3>🎯 Mission</h3>
              <p>Eat <strong>25 animals</strong> to win! Avoid hunters and walls.</p>
            </div>
            <div class="info-card">
              <h3>🎮 Controls</h3>
              <div class="controls-grid">
                <span class="key">W/↑</span><span>Up</span>
                <span class="key">S/↓</span><span>Down</span>
                <span class="key">A/←</span><span>Left</span>
                <span class="key">D/→</span><span>Right</span>
              </div>
              <p class="mobile-note">📱 Mobile: Swipe anywhere on screen to move!</p>
            </div>
            <div class="info-card">
              <h3>🏆 Scoring</h3>
              <div class="score-list">
                <div class="score-item"><span>🐰 Rabbit</span><span class="pts">+10</span></div>
                <div class="score-item"><span>🐸 Frog</span><span class="pts">+15</span></div>
                <div class="score-item"><span>🐦 Bird</span><span class="pts">+20</span></div>
                <div class="score-item"><span>🐭 Mouse</span><span class="pts">+12</span></div>
                <div class="score-item"><span>🦋 Butterfly</span><span class="pts">+25</span></div>
              </div>
            </div>
          </div>

          <div class="menu-warnings">
            <div class="warning-item">👨 Hunter spotted = Death!</div>
            <div class="warning-item">� Eat 25 animals to WIN!</div>
            <div class="warning-item">🌿 Walls are deadly!</div>
          </div>

          <div class="high-score-display" *ngIf="engine.highScore > 0">
            ⭐ Best: {{ engine.highScore }}
          </div>

          <button class="start-btn" (click)="startGame()">
            <span class="btn-icon">🎮</span>
            PLAY NOW
            <span class="btn-icon">🐍</span>
          </button>
        </div>
      </div>

      <!-- GAME CANVAS — full screen, swipe anywhere to move -->
      <div class="canvas-container" [class.hidden]="engine.gameState === 'menu' || engine.gameState === 'won'">
        <canvas #gameCanvas
          class="game-canvas"
          (click)="onCanvasClick($event)"
          (touchstart)="onTouchStart($event)"
          (touchmove)="onTouchMove($event)"
          (touchend)="onTouchEnd($event)">
        </canvas>

        <!-- Swipe hint — fades out after a few seconds -->
        <div class="swipe-hint" *ngIf="showSwipeHint && isMobile">
          <span>👆 Swipe anywhere to move</span>
        </div>
      </div>

      <!-- WIN SCREEN -->
      <div class="screen win-screen" *ngIf="engine.gameState === 'won'">
        <div class="confetti-container">
          <div class="confetti" *ngFor="let c of confettiPieces; let i = index"
            [style.left]="c.x + '%'"
            [style.background]="c.color"
            [style.animation-delay]="c.delay + 's'"
            [style.animation-duration]="c.duration + 's'"></div>
        </div>
        <div class="win-content">
          <div class="win-trophy">🏆</div>
          <h1 class="win-title">YOU WON!</h1>
          <p class="win-subtitle">25 animals devoured — the jungle bows to you!</p>
          <div class="win-stats">
            <div class="stat-box">
              <div class="stat-value">{{ engine.score }}</div>
              <div class="stat-label">Score</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.animalsEaten }}</div>
              <div class="stat-label">Eaten</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.highScore }}</div>
              <div class="stat-label">Best</div>
            </div>
          </div>
          <div class="win-buttons">
            <button class="play-again-btn" (click)="startGame()">🔄 Play Again</button>
            <button class="menu-btn" (click)="goToMenu()">🏠 Menu</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  canvasWidth  = 900;
  canvasHeight = 600;
  isMobile = false;
  showSwipeHint = true;

  // Touch tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private swipeActive = false;     // true once a direction has been sent this touch

  titleTrees = Array.from({ length: 12 }, (_, i) => ({
    size: 30 + Math.random() * 30,
    x: i * 9 + Math.random() * 5,
    y: Math.random() * 20
  }));

  paradeAnimals = ['🐰', '🐸', '🦋', '🐭', '🐦', '🐊', '🦜', '🐢'];

  confettiPieces = Array.from({ length: 60 }, () => ({
    x: Math.random() * 100,
    color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bcb', '#ff9f1c'][Math.floor(Math.random() * 6)],
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3
  }));

  constructor(public engine: GameEngineService, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  ngOnInit() {
    this.engine.loadHighScore();
    this.isMobile = 'ontouchstart' in window || window.innerWidth <= 900;
    this.resizeCanvas();
  }

  ngAfterViewInit() {
    this.resizeCanvas();
    if (this.canvasRef?.nativeElement) {
      this.engine.init(this.canvasRef.nativeElement);
    }
  }

  ngOnDestroy() {
    this.engine.stopLoop();
  }

  resizeCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.isMobile = 'ontouchstart' in window || vw <= 900;

    // Fill the FULL viewport — game engine scales all coordinates accordingly
    this.canvasWidth  = vw;
    this.canvasHeight = vh;

    if (this.canvasRef?.nativeElement) {
      const canvas = this.canvasRef.nativeElement;
      canvas.width  = this.canvasWidth;
      canvas.height = this.canvasHeight;
      this.engine.canvas = canvas;
      this.engine.ctx    = canvas.getContext('2d')!;
      // If overlay is currently showing (loop stopped), repaint it immediately
      if (this.engine.overlayVisible) {
        this.engine.render();
      }
    }
    this.cdr.markForCheck();
  }

  @HostListener('window:resize')
  onResize() {
    this.resizeCanvas();
  }

  startGame() {
    this.resizeCanvas();
    this.showSwipeHint = true;
    // Hide swipe hint after 3 s
    setTimeout(() => { this.showSwipeHint = false; this.cdr.markForCheck(); }, 3000);
    this.engine.onPlayAgain = () => { this.zone.run(() => this.startGame()); };
    this.engine.onGoMenu    = () => { this.zone.run(() => this.goToMenu()); };
    this.engine.startGame();
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.canvasRef?.nativeElement) {
        this.engine.canvas = this.canvasRef.nativeElement;
        this.engine.ctx    = this.canvasRef.nativeElement.getContext('2d')!;
      }
    }, 30);
  }

  // ── MOUSE CLICK — desktop overlay buttons ────────────────────────
  onCanvasClick(event: MouseEvent) {
    const canvas = event.target as HTMLCanvasElement;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth  / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const ex = (event.clientX - rect.left) * scaleX;
    const ey = (event.clientY - rect.top)  * scaleY;
    this.engine.handleCanvasClick(ex, ey);
    this.cdr.detectChanges();
  }

  // ── TOUCH: record start position ─────────────────────────────────
  onTouchStart(event: TouchEvent) {
    event.preventDefault();
    const t = event.touches[0];
    this.touchStartX  = t.clientX;
    this.touchStartY  = t.clientY;
    this.swipeActive  = false;
  }

  // ── TOUCH: fire direction as soon as finger moves 20px ───────────
  onTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (this.swipeActive) return;      // one direction per touch gesture

    const t     = event.touches[0];
    const dx    = t.clientX - this.touchStartX;
    const dy    = t.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20) return;   // wait for clearer intent

    this.swipeActive = true;
    if (absDx > absDy) {
      this.engine.handleKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      this.engine.handleKey(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    this.cdr.detectChanges();
  }

  // ── TOUCH END: handle tap → overlay button ────────────────────────
  onTouchEnd(event: TouchEvent) {
    event.preventDefault();
    if (event.changedTouches.length === 0) return;

    const t     = event.changedTouches[0];
    const dx    = t.clientX - this.touchStartX;
    const dy    = t.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const rect   = canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth  / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const ex = (t.clientX - rect.left) * scaleX;
    const ey = (t.clientY - rect.top)  * scaleY;

    // If overlay is visible, ALWAYS try to hit-test buttons (tap or swipe-end)
    if (this.engine.overlayVisible) {
      this.engine.handleCanvasClick(ex, ey);
      this.cdr.detectChanges();
      return;
    }

    // Pure tap (no movement) during gameplay → hit-test any canvas elements
    if (!this.swipeActive && absDx < 20 && absDy < 20) {
      this.engine.handleCanvasClick(ex, ey);
      this.cdr.detectChanges();
    }
  }

  goToMenu() {
    this.engine.stopLoop();
    if ((this.engine as any)._overlayTimer) {
      clearTimeout((this.engine as any)._overlayTimer);
      (this.engine as any)._overlayTimer = null;
    }
    this.engine.overlayVisible = false;
    this.engine.gameState = 'menu';
    this.cdr.detectChanges();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    event.preventDefault();
    this.engine.handleKey(event.key);
    this.cdr.detectChanges();
  }
}

