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
              <p>Eat <strong>15 animals</strong> to win Level 1! Then survive the desert eagles in Level 2!</p>
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
            <div class="warning-item">🎯 Eat 15 animals to WIN Level 1!</div>
            <div class="warning-item">🦅 Avoid eagle shadows in Level 2!</div>
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

          <!-- LEVEL SELECT -->
          <div class="level-select">
            <div class="level-select-title">🎮 Select Level</div>
            <div class="level-buttons">
              <button class="level-btn level-btn-1" (click)="startGame()">
                <span class="level-icon">🌴</span>
                <div class="level-btn-info">
                  <div class="level-btn-name">Level 1</div>
                  <div class="level-btn-desc">Jungle — Eat 15 animals</div>
                </div>
                <span class="level-status unlocked-badge">PLAY</span>
              </button>
              <button class="level-btn level-btn-2"
                [class.locked]="!engine.level2Unlocked"
                [disabled]="!engine.level2Unlocked"
                (click)="engine.level2Unlocked && startLevel2()">
                <span class="level-icon">🏜️</span>
                <div class="level-btn-info">
                  <div class="level-btn-name">Level 2</div>
                  <div class="level-btn-desc" *ngIf="engine.level2Unlocked">Desert — Eat 25 insects</div>
                  <div class="level-btn-desc locked-desc" *ngIf="!engine.level2Unlocked">Complete Level 1 to Unlock</div>
                </div>
                <span class="level-status" [class.unlocked-badge]="engine.level2Unlocked" [class.locked-badge]="!engine.level2Unlocked">
                  {{ engine.level2Unlocked ? 'PLAY' : '🔒' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- GAME CANVAS — full screen, swipe anywhere to move -->
      <div class="canvas-container" [class.hidden]="engine.gameState === 'menu' || engine.gameState === 'won' || engine.gameState === 'level-transition'">
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

      <!-- LEVEL TRANSITION SCREEN (Level 1 Complete to Level 2) -->
      <div class="screen level-transition-screen" *ngIf="engine.gameState === 'level-transition'">
        <div class="level-transition-content">
          <div class="level-badge">⭐ LEVEL 1 COMPLETE ⭐</div>
          <h1 class="transition-title">🏜️ Desert Awaits!</h1>
          <p class="transition-subtitle">You conquered the jungle!<br>Now survive the scorching desert...</p>
          <div class="transition-warning">
            <div class="warning-eagle">🦅 Eagles patrol the sky!</div>
            <div class="warning-eagle">�� Eat 25 insects to win!</div>
            <div class="warning-eagle">⚠️ Enter an eagle shadow = Death!</div>
          </div>
          <div class="win-stats">
            <div class="stat-box">
              <div class="stat-value">{{ engine.score }}</div>
              <div class="stat-label">Score So Far</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">15</div>
              <div class="stat-label">Animals Eaten</div>
            </div>
          </div>
          <button class="start-btn desert-btn" (click)="startLevel2()">
            <span class="btn-icon">🏜️</span>
            ENTER THE DESERT
            <span class="btn-icon">🦅</span>
          </button>
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
          <div class="win-trophy">{{ engine.level === 2 ? '🏆' : '🏆' }}</div>
          <h1 class="win-title">{{ engine.level === 2 ? 'DESERT CONQUERED!' : 'YOU WON!' }}</h1>
          <p class="win-subtitle">{{ engine.level === 2 ? '25 insects devoured — the desert bows to you!' : '15 animals devoured — the jungle bows to you!' }}</p>
          <div class="win-stats">
            <div class="stat-box">
              <div class="stat-value">{{ engine.score }}</div>
              <div class="stat-label">Score</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.animalsEaten }}</div>
              <div class="stat-label">{{ engine.level === 2 ? 'Insects' : 'Eaten' }}</div>
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
  private swipeActive = false;

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

    this.canvasWidth  = vw;
    this.canvasHeight = vh;

    if (this.canvasRef?.nativeElement) {
      const canvas = this.canvasRef.nativeElement;
      canvas.width  = this.canvasWidth;
      canvas.height = this.canvasHeight;
      this.engine.canvas = canvas;
      this.engine.ctx    = canvas.getContext('2d')!;
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
    setTimeout(() => { this.showSwipeHint = false; this.cdr.markForCheck(); }, 3000);
    this.engine.onPlayAgain = () => { this.zone.run(() => this.startGame()); };
    this.engine.onGoMenu    = () => { this.zone.run(() => this.goToMenu()); };
    this.engine.onWin       = () => { this.zone.run(() => this.handleWin()); };
    this.engine.startGame();
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.canvasRef?.nativeElement) {
        this.engine.canvas = this.canvasRef.nativeElement;
        this.engine.ctx    = this.canvasRef.nativeElement.getContext('2d')!;
      }
    }, 30);
  }

  handleWin() {
    if (this.engine.level === 1) {
      this.engine.gameState = 'level-transition';
      this.cdr.detectChanges();
    } else {
      this.engine.gameState = 'won';
      this.cdr.detectChanges();
    }
  }

  startLevel2() {
    this.resizeCanvas();
    this.showSwipeHint = true;
    setTimeout(() => { this.showSwipeHint = false; this.cdr.markForCheck(); }, 3000);
    this.engine.onPlayAgain = () => { this.zone.run(() => this.startGame()); };
    this.engine.onGoMenu    = () => { this.zone.run(() => this.goToMenu()); };
    this.engine.onWin       = () => { this.zone.run(() => this.handleWin()); };
    this.engine.startLevel2();
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.canvasRef?.nativeElement) {
        this.engine.canvas = this.canvasRef.nativeElement;
        this.engine.ctx    = this.canvasRef.nativeElement.getContext('2d')!;
      }
    }, 30);
  }

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

  onTouchStart(event: TouchEvent) {
    event.preventDefault();
    const t = event.touches[0];
    this.touchStartX  = t.clientX;
    this.touchStartY  = t.clientY;
    this.swipeActive  = false;
  }

  onTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (this.swipeActive) return;

    const t     = event.touches[0];
    const dx    = t.clientX - this.touchStartX;
    const dy    = t.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20) return;

    this.swipeActive = true;
    if (absDx > absDy) {
      this.engine.handleKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      this.engine.handleKey(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    this.cdr.detectChanges();
  }

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

    if (this.engine.overlayVisible) {
      this.engine.handleCanvasClick(ex, ey);
      this.cdr.detectChanges();
      return;
    }

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
