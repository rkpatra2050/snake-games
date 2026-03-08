import {
  Component, ElementRef, ViewChild, OnInit, OnDestroy,
  HostListener, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef
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
              <p>Guide your snake through the jungle, eat animals to grow, avoid hunters, and reach the victory flag!</p>
            </div>
            <div class="info-card">
              <h3>🎮 Controls</h3>
              <div class="controls-grid">
                <span class="key">W</span><span>Move Up</span>
                <span class="key">S</span><span>Move Down</span>
                <span class="key">A</span><span>Move Left</span>
                <span class="key">D</span><span>Move Right</span>
                <span class="key">P</span><span>Pause Game</span>
              </div>
            </div>
            <div class="info-card">
              <h3>🏆 Scoring</h3>
              <div class="score-list">
                <div class="score-item"><span>🐰 Rabbit</span><span class="pts">+10 pts</span></div>
                <div class="score-item"><span>🐸 Frog</span><span class="pts">+15 pts</span></div>
                <div class="score-item"><span>🐦 Bird</span><span class="pts">+20 pts</span></div>
                <div class="score-item"><span>🐭 Mouse</span><span class="pts">+12 pts</span></div>
                <div class="score-item"><span>🦋 Butterfly</span><span class="pts">+25 pts</span></div>
              </div>
            </div>
          </div>

          <div class="menu-warnings">
            <div class="warning-item">👨 Hunter spotted = Instant death!</div>
            <div class="warning-item">🏁 Reach the flag to WIN!</div>
            <div class="warning-item">🌿 Walls are deadly!</div>
          </div>

          <div class="high-score-display" *ngIf="engine.highScore > 0">
            ⭐ High Score: {{ engine.highScore }}
          </div>

          <button class="start-btn" (click)="startGame()">
            <span class="btn-icon">🎮</span>
            PLAY NOW
            <span class="btn-icon">🐍</span>
          </button>
        </div>
      </div>

      <!-- GAME CANVAS -->
      <div class="canvas-container" [class.hidden]="engine.gameState === 'menu' || engine.gameState === 'won'">
        <canvas #gameCanvas
          [width]="canvasWidth"
          [height]="canvasHeight"
          class="game-canvas"
          (click)="onCanvasClick($event)">
        </canvas>
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
          <p class="win-subtitle">The jungle is conquered!</p>
          <div class="win-stats">
            <div class="stat-box">
              <div class="stat-value">{{ engine.score }}</div>
              <div class="stat-label">Final Score</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.snake.length }}</div>
              <div class="stat-label">Snake Length</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.highScore }}</div>
              <div class="stat-label">Best Score</div>
            </div>
          </div>
          <div class="win-animals-eaten">
            🐾 Animals eaten to survive the jungle!
          </div>
          <div class="win-buttons">
            <button class="play-again-btn" (click)="startGame()">🔄 Play Again</button>
            <button class="menu-btn" (click)="goToMenu()">🏠 Main Menu</button>
          </div>
        </div>
      </div>

      <!-- DEATH SCREEN (Angular overlay — still kept for 'lost' state fallback) -->
      <div class="screen death-screen" *ngIf="engine.gameState === 'lost'">
        <div class="death-content">
          <div class="death-icon">
            <span *ngIf="engine.killedBy === 'hunter'">👨‍🌾</span>
            <span *ngIf="engine.killedBy !== 'hunter'">💀</span>
          </div>
          <h1 class="death-title">GAME OVER</h1>
          <p class="death-reason" *ngIf="engine.killedBy === 'hunter'">
            ⚠️ A hunter spotted you and opened fire!
          </p>
          <p class="death-reason" *ngIf="engine.killedBy !== 'hunter'">
            💥 You crashed into the jungle walls!
          </p>
          <div class="death-stats">
            <div class="stat-box">
              <div class="stat-value">{{ engine.score }}</div>
              <div class="stat-label">Score</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.snake.length }}</div>
              <div class="stat-label">Max Length</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">{{ engine.highScore }}</div>
              <div class="stat-label">Best Score</div>
            </div>
          </div>
          <div class="death-tip">
            💡 Tip: {{ getRandomTip() }}
          </div>
          <div class="death-buttons">
            <button class="play-again-btn" (click)="startGame()">🔄 Try Again</button>
            <button class="menu-btn" (click)="goToMenu()">🏠 Main Menu</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  canvasWidth = 900;
  canvasHeight = 600;

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

  tips = [
    'Watch the hunter\'s sight cone — yellow means patrol, red means chase!',
    'Eat butterflies for 25 points — the most valuable prey!',
    'Stay in bushes to confuse hunters!',
    'The flag is on the right side of the jungle. Keep moving right!',
    'Don\'t cross your own tail or you\'ll crash!',
    'Hunters move faster in chase mode. Zigzag to escape!'
  ];

  constructor(public engine: GameEngineService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.engine.loadHighScore();
  }

  ngAfterViewInit() {
    if (this.canvasRef?.nativeElement) {
      this.engine.init(this.canvasRef.nativeElement);
    }
  }

  ngOnDestroy() {
    this.engine.stopLoop();
  }

  startGame() {
    this.engine.overlayVisible = false;
    this.engine.startGame();
    this.cdr.detectChanges();
    // Register overlay button callbacks
    this.engine.onPlayAgain = () => {
      this.startGame();
    };
    this.engine.onGoMenu = () => {
      this.goToMenu();
    };
    // Re-init canvas after view might re-render
    setTimeout(() => {
      if (this.canvasRef?.nativeElement) {
        this.engine.canvas = this.canvasRef.nativeElement;
        this.engine.ctx = this.canvasRef.nativeElement.getContext('2d')!;
      }
    }, 50);
  }

  onCanvasClick(event: MouseEvent) {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const scaleX = this.canvasWidth  / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const ex = (event.clientX - rect.left) * scaleX;
    const ey = (event.clientY - rect.top)  * scaleY;
    this.engine.handleCanvasClick(ex, ey);
    this.cdr.detectChanges();
  }

  goToMenu() {
    this.engine.stopLoop();
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

  getRandomTip(): string {
    return this.tips[Math.floor(Math.random() * this.tips.length)];
  }
}
