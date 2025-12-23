
export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  pos: Vector2;
  dir: Vector2;   
  plane: Vector2; 
  health: number;
  ammo: number;        // Current rounds in mag
  ammoReserve: number; // Rounds in bag
  z: number;           // Vertical position (height)
  vz: number;          // Vertical velocity
  pitch: number;       // Vertical look offset (in pixels)
  weaponIndex: number; // Current weapon slot
}

// EnemyState (Value)
export const EnemyState = {
  IDLE: 0,
  CHASE: 1,
  ATTACK: 2,
  DYING: 3,
  DEAD: 4
} as const;

// EnemyStateValue (Type)
export type EnemyStateValue = typeof EnemyState[keyof typeof EnemyState];

export interface Enemy {
  id: number;
  pos: Vector2;
  dir: Vector2;
  state: EnemyStateValue;
  health: number;
  textureId: number;
  lastAttackTime: number; 
  animationTimer: number; // For frame switching
}

export interface Item {
  id: number;
  pos: Vector2;
  textureId: number;
  spawnTime: number;
}

export interface Particle {
  id: number;
  pos: Vector2;
  textureId: number;
  life: number;     // 1.0 to 0.0
  velocity: Vector2;
}

// Difficulty (Value)
export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD'
} as const;

// DifficultyLevel (Type)
export type DifficultyLevel = typeof Difficulty[keyof typeof Difficulty];

export interface GameState {
  player: Player;
  enemies: Enemy[];
  items: Item[];
  particles: Particle[];
  map: number[][];
  lastTime: number;
  score: number;
}

export interface Texture {
  image: CanvasImageSource; 
  width: number;
  height: number;
}

// CellType (Value)
export const CellType = {
  EMPTY: 0,
  WALL_1: 1,
  WALL_2: 2,
  WALL_3: 3,
  WALL_4: 4,
  HEALTH_ORB: 50,
  AMMO_BOX: 51,
  ENEMY_GUARD: 99,
  ENEMY_GUARD_WALK: 98,
  ENEMY_GUARD_DEAD: 97,
  PARTICLE_BLOOD: 200,
  PARTICLE_IMPACT: 201
} as const;

// CellTypeValue (Type)
export type CellTypeValue = typeof CellType[keyof typeof CellType];