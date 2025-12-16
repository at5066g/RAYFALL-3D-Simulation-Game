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
}

// EnemyState (Value)
export const EnemyState = {
  IDLE: 0,
  CHASE: 1,
  ATTACK: 2
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
}

export interface Item {
  id: number;
  pos: Vector2;
  textureId: number;
  spawnTime: number;
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
} as const;

// CellTypeValue (Type)
export type CellTypeValue = typeof CellType[keyof typeof CellType];