export interface Vector2D {
  x: number;
  y: number;
}

export interface SnakeSegment {
  x: number;
  y: number;
}

export interface Animal {
  id: number;
  x: number;
  y: number;
  type: 'rabbit' | 'frog' | 'bird' | 'mouse' | 'butterfly' | 'mosquito' | 'beetle' | 'cockroach' | 'worm' | 'cricket' | 'fish' | 'seal' | 'penguin' | 'arcticfox' | 'snowowl';
  emoji: string;
  points: number;
  growth: number;
  animFrame: number;
  bobOffset: number;
  speed: number;
  vx: number;
  vy: number;
  alive: boolean;
  eatAnimation: number;
}

export interface Eagle {
  id: number;
  x: number;        // current position (world px)
  y: number;
  angle: number;    // flight direction (radians)
  speed: number;
  altitude: number; // visual altitude above ground
  patrolCx: number; // circle centre
  patrolCy: number;
  patrolRadius: number;
  patrolAngle: number; // current angle in circle
  sightRange: number;  // detection radius — eagle starts chasing
  killRange: number;   // lethal contact radius (much smaller)
  state: 'patrol' | 'chase' | 'return';
  wingPhase: number;   // flapping animation
  chaseSpeed: number;  // fast speed when chasing
}

export interface Hunter {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: 'left' | 'right';
  state: 'patrol' | 'alert' | 'chase' | 'attack';
  sightRange: number;
  sightAngle: number;
  patrolPath: Vector2D[];
  patrolIndex: number;
  alertTimer: number;
  animFrame: number;
  stepTimer: number;
  flashTimer: number;
}

export interface Tree {
  x: number;
  y: number;
  scale: number;
  type: number;
  swayOffset: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'leaf' | 'sparkle' | 'blood' | 'star' | 'smoke';
}

export interface Grass {
  x: number;
  y: number;
  height: number;
  swayOffset: number;
  color: string;
}

export interface Bush {
  x: number;
  y: number;
  scale: number;
}

export interface Cloud {
  x: number;
  y: number;
  speed: number;
  scale: number;
  opacity: number;
}

export interface PolarBear {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: 'left' | 'right';
  state: 'patrol' | 'alert' | 'chase';
  sightRange: number;
  patrolPath: Vector2D[];
  patrolIndex: number;
  alertTimer: number;
  animFrame: number;
  stepTimer: number;
  flashTimer: number;
  roarTimer: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'won' | 'lost' | 'level-transition';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GameConfig {
  cellSize: number;
  cols: number;
  rows: number;
  snakeSpeed: number;
  hunterCount: number;
  animalCount: number;
}
