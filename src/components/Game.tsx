
import React, { useEffect, useRef, useState } from 'react';
import { Raycaster } from '../engine/Raycaster';
import { generateTextures } from '../engine/textures';
import { SoundManager } from '../engine/SoundManager';
import { 
  type GameState, 
  type Player, 
  type Vector2, 
  type Enemy, 
  EnemyState, 
  CellType, 
  Difficulty,
  type DifficultyLevel,
} from '../types';
import { 
  SCREEN_WIDTH, 
  SCREEN_HEIGHT, 
  WORLD_MAP, 
  MOVE_SPEED, 
  SPAWN_POINTS, 
  MAX_ENEMIES, 
  SPAWN_INTERVAL,
  FOV,
  CLIP_SIZE,
  MAX_RESERVE,
  START_AMMO,
  START_RESERVE,
  RELOAD_TIME
} from '../constants';
import { Minimap } from './Minimap';

const GRAVITY = 25.0;
const JUMP_FORCE = 8.5;

const safeRequestPointerLock = (element: HTMLCanvasElement) => {
    try {
        const promise = (element as any).requestPointerLock({ unadjustedMovement: true }) || (element as any).requestPointerLock();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
    } catch (e) {}
};

const createInitialPlayer = (): Player => ({
  pos: { x: 22, y: 12 },
  dir: { x: -1, y: 0 },
  plane: { x: 0, y: 0.66 },
  health: 100,
  ammo: START_AMMO,
  ammoReserve: START_RESERVE,
  z: 0,
  vz: 0,
  pitch: 0
});

interface GameProps {
  difficulty: DifficultyLevel;
  onExit: () => void;
}

export const Game: React.FC<GameProps> = ({ difficulty, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const weaponRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const raycaster = useRef(new Raycaster(SCREEN_WIDTH, SCREEN_HEIGHT));
  const soundManager = useRef(new SoundManager());
  
  const keys = useRef<Record<string, boolean>>({});
  const isZooming = useRef(false);
  const currentFovScale = useRef(FOV);

  const walkCycle = useRef(0);
  const lastStepTime = useRef(0);
  const recoilImpulse = useRef(0); 
  
  const [isShooting, setIsShooting] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hitMarkerOpacity, setHitMarkerOpacity] = useState(0); 
  const [isHeadshot, setIsHeadshot] = useState(false);
  
  // Settings State
  const [sensitivity, setSensitivity] = useState(1.0);
  const [isInfiniteAmmo, setIsInfiniteAmmo] = useState(false);

  const shootTimer = useRef<number | null>(null);
  const lastSpawnTime = useRef(0);
  const enemyIdCounter = useRef(0);
  const itemIdCounter = useRef(0);

  const stateRef = useRef<GameState>({
    player: createInitialPlayer(),
    enemies: [], 
    items: [],
    particles: [],
    map: WORLD_MAP,
    lastTime: performance.now(),
    score: 0,
  });

  const [uiState, setUiState] = useState<GameState>(stateRef.current);
  const texturesRef = useRef(generateTextures());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (e.code === 'Escape') {
            setIsPaused(prev => !prev);
        }
        if (e.code === 'KeyR') reload();
        if (e.code === 'Space') jump();
        keys.current[e.code] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleLockChange = () => {
        if (!document.pointerLockElement && !isGameOver) setIsPaused(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('pointerlockchange', handleLockChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, [isGameOver]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (stateRef.current.player.health <= 0 || isPaused) return;
      if (document.pointerLockElement !== canvas) {
        safeRequestPointerLock(canvas);
        soundManager.current.init();
      } else {
        if (e.button === 0) shoot();
        else if (e.button === 2) isZooming.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => { if (e.button === 2) isZooming.current = false; };

    const handleMouseMove = (e: MouseEvent) => {
      if (stateRef.current.player.health <= 0 || isPaused) return;
      if (document.pointerLockElement === canvas) {
        const { player } = stateRef.current;
        // Apply sensitivity multiplier
        const baseSensitivityX = isZooming.current ? 0.0005 : 0.0022;
        const sensitivityX = baseSensitivityX * sensitivity;
        const sensitivityY = 1.0; 
        const rotX = -e.movementX * sensitivityX;
        const oldDirX = player.dir.x;
        player.dir.x = player.dir.x * Math.cos(rotX) - player.dir.y * Math.sin(rotX);
        player.dir.y = oldDirX * Math.sin(rotX) + player.dir.y * Math.cos(rotX);
        player.pitch -= e.movementY * sensitivityY;
        const maxPitch = SCREEN_HEIGHT / 1.5;
        player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPaused, isReloading, sensitivity, isInfiniteAmmo]); 

  const jump = () => {
      const { player } = stateRef.current;
      if (player.z === 0) player.vz = JUMP_FORCE;
  };

  const restartGame = () => {
    stateRef.current = {
        player: createInitialPlayer(),
        enemies: [],
        items: [],
        particles: [],
        map: WORLD_MAP,
        lastTime: performance.now(),
        score: 0,
    };
    lastSpawnTime.current = performance.now();
    recoilImpulse.current = 0;
    setIsGameOver(false);
    setIsPaused(false);
    setIsReloading(false);
    setUiState(stateRef.current);
    if (canvasRef.current) safeRequestPointerLock(canvasRef.current);
  };

  const reload = () => {
      const { player } = stateRef.current;
      // Don't manually reload if ammo is infinite
      if (isInfiniteAmmo || isReloading || player.ammo === CLIP_SIZE || player.ammoReserve === 0) return;
      if (player.health <= 0) return;
      setIsReloading(true);
      soundManager.current.playReload();
      setTimeout(() => {
          const needed = CLIP_SIZE - player.ammo;
          const available = Math.min(needed, player.ammoReserve);
          player.ammo += available;
          player.ammoReserve -= available;
          setIsReloading(false);
      }, RELOAD_TIME);
  };

  const spawnEnemy = (now: number) => {
    if (stateRef.current.enemies.length >= MAX_ENEMIES) return;
    if (now - lastSpawnTime.current < SPAWN_INTERVAL) return;
    const point = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    const dx = point.x - stateRef.current.player.pos.x;
    const dy = point.y - stateRef.current.player.pos.y;
    if (Math.sqrt(dx*dx + dy*dy) < 5.0) return; 
    stateRef.current.enemies.push({
      id: ++enemyIdCounter.current,
      pos: { x: point.x, y: point.y },
      dir: { x: 0, y: 1 }, 
      state: EnemyState.IDLE,
      health: 100,
      textureId: CellType.ENEMY_GUARD,
      lastAttackTime: now,
      animationTimer: 0
    });
    lastSpawnTime.current = now;
  };

  const shoot = () => {
    if (stateRef.current.player.health <= 0 || isReloading) return;
    
    // Check ammo logic only if infinite ammo is NOT enabled
    if (!isInfiniteAmmo) {
        if (stateRef.current.player.ammo <= 0) {
            soundManager.current.playDryFire();
            reload();
            return;
        }
        stateRef.current.player.ammo--;
        
        // Trigger auto-reload if we just fired the last bullet
        if (stateRef.current.player.ammo === 0) {
            reload();
        }
    }

    soundManager.current.playShoot();
    recoilImpulse.current = 1.0;
    setIsShooting(true);
    if (shootTimer.current) clearTimeout(shootTimer.current);
    shootTimer.current = window.setTimeout(() => setIsShooting(false), 50);

    const { player, enemies, map } = stateRef.current;
    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;
    let hitRelativeY = 0;

    enemies.forEach((enemy: Enemy) => {
      if (enemy.health <= 0) return;
      const dx = enemy.pos.x - player.pos.x, dy = enemy.pos.y - player.pos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const dot = dx * player.dir.x + dy * player.dir.y;
      if (dot > 0) {
        const perpDist = Math.abs(dx * player.dir.y - dy * player.dir.x);
        if (perpDist < 0.5 && hasLineOfSight(player.pos, enemy.pos, map)) {
             const transformY = dist;
             const vOffset = player.pitch + (player.z * SCREEN_HEIGHT) / transformY;
             const spriteHeight = SCREEN_HEIGHT / transformY;
             const drawStartY = -spriteHeight / 2 + SCREEN_HEIGHT / 2 + vOffset;
             const drawEndY = spriteHeight / 2 + SCREEN_HEIGHT / 2 + vOffset;
             const crosshairY = SCREEN_HEIGHT / 2;
             if (crosshairY >= drawStartY && crosshairY <= drawEndY) {
                 if (dist < closestDist) { closestDist = dist; closestEnemy = enemy; hitRelativeY = (crosshairY - drawStartY) / (drawEndY - drawStartY); }
             }
        }
      }
    });

    if (closestEnemy) {
       const target = closestEnemy as Enemy;
       const isHead = hitRelativeY < 0.25; 
       target.health -= isHead ? 100 : 40; 
       setHitMarkerOpacity(1.0);
       setIsHeadshot(isHead);
       setTimeout(() => setIsHeadshot(false), 200);
       if (target.health <= 0) {
           soundManager.current.playEnemyDeath();
           stateRef.current.score += isHead ? 2 : 1; 
           stateRef.current.items.push({
               id: ++itemIdCounter.current,
               pos: { x: target.pos.x, y: target.pos.y },
               textureId: Math.random() > 0.5 ? CellType.HEALTH_ORB : CellType.AMMO_BOX,
               spawnTime: performance.now()
           });
       } else {
           soundManager.current.playEnemyHit();
           target.state = EnemyState.CHASE;
       }
    }
  };

  const hasLineOfSight = (p1: Vector2, p2: Vector2, map: number[][]): boolean => {
    const steps = 25; 
    const dx = (p2.x - p1.x) / steps, dy = (p2.y - p1.y) / steps;
    let cx = p1.x, cy = p1.y;
    for (let i = 0; i < steps; i++) {
        cx += dx; cy += dy;
        if (map[Math.floor(cx)]?.[Math.floor(cy)] > 0) return false;
    }
    return true;
  };

  const updateAI = (dt: number, now: number) => {
    const { player, enemies, map } = stateRef.current;
    const ENEMY_SPEED = 2.5, AGGRO_RANGE = 12.0, ATTACK_RANGE = 1.0, RANGED_RANGE = 9.0;
    
    // Scale stats based on difficulty
    let damageMelee = 10, damageRanged = 5, shootCooldown = 2500;
    if (difficulty === Difficulty.MEDIUM) {
        damageMelee = 20; damageRanged = 10; shootCooldown = 1800;
    } else if (difficulty === Difficulty.HARD) {
        damageMelee = 35; damageRanged = 20; shootCooldown = 1200;
    }

    stateRef.current.enemies = enemies.filter(e => e.health > 0);
    stateRef.current.enemies.forEach((enemy: Enemy) => {
        const dx = player.pos.x - enemy.pos.x, dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const canSee = hasLineOfSight(enemy.pos, player.pos, map);

        if (enemy.state === EnemyState.IDLE && dist < AGGRO_RANGE && canSee) {
            enemy.state = EnemyState.CHASE;
        }

        if (enemy.state === EnemyState.CHASE) {
            // Chase logic (Always try to get closer unless already in melee)
            if (dist > ATTACK_RANGE) {
                const dirX = dx / dist, dirY = dy / dist;
                const moveStep = ENEMY_SPEED * dt;
                if (map[Math.floor(enemy.pos.x + dirX * moveStep)]?.[Math.floor(enemy.pos.y)] === 0) enemy.pos.x += dirX * moveStep;
                if (map[Math.floor(enemy.pos.x)]?.[Math.floor(enemy.pos.y + dirY * moveStep)] === 0) enemy.pos.y += dirY * moveStep;
            }

            // Combat logic
            if (dist <= ATTACK_RANGE) {
                // Melee Attack
                if (now - enemy.lastAttackTime > 1000) {
                    enemy.lastAttackTime = now;
                    player.health -= damageMelee;
                    soundManager.current.playPlayerDamage();
                }
            } else if (dist < RANGED_RANGE && canSee) {
                // Ranged Firing Logic
                if (now - enemy.lastAttackTime > shootCooldown) {
                    enemy.lastAttackTime = now;
                    player.health -= damageRanged;
                    soundManager.current.playEnemyShoot();
                    soundManager.current.playPlayerDamage();
                }
            }
        }
    });
  };

  const tick = (time: number) => {
    if (isPaused) { stateRef.current.lastTime = time; requestRef.current = requestAnimationFrame(tick); return; }
    const dt = Math.min(0.1, (time - stateRef.current.lastTime) / 1000);
    stateRef.current.lastTime = time;
    if (hitMarkerOpacity > 0) setHitMarkerOpacity(prev => Math.max(0, prev - dt * 4));
    if (stateRef.current.player.health > 0) {
        updatePhysics(dt);
        updateAI(dt, time);
        spawnEnemy(time);
        stateRef.current.particles.forEach(p => p.life -= dt * 2);
        stateRef.current.particles = stateRef.current.particles.filter(p => p.life > 0);
    } else if (!isGameOver) setIsGameOver(true);
    render();
    setUiState({ ...stateRef.current });
    requestRef.current = requestAnimationFrame(tick);
  };

  const updatePhysics = (dt: number) => {
    const { player, map, items } = stateRef.current;
    if (player.z > 0 || player.vz !== 0) {
        player.vz -= GRAVITY * dt;
        player.z += player.vz * dt;
        if (player.z < 0) { player.z = 0; player.vz = 0; }
    }
    const targetFov = isZooming.current ? 0.30 : FOV; 
    currentFovScale.current += (targetFov - currentFovScale.current) * 8.0 * dt;
    player.plane.x = player.dir.y * currentFovScale.current;
    player.plane.y = -player.dir.x * currentFovScale.current;
    
    const now = performance.now();
    const ITEM_LIFETIME = 5000; // 5 seconds in milliseconds

    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];

        // 1. Automatic Disappearance Check (5-second rule)
        if (now - item.spawnTime > ITEM_LIFETIME) {
            items.splice(i, 1);
            continue;
        }

        // 2. Pickup Check
        if (Math.sqrt((player.pos.x - item.pos.x)**2 + (player.pos.y - item.pos.y)**2) < 0.8) { 
             if (item.textureId === CellType.HEALTH_ORB) { 
                 soundManager.current.playHeal(); 
                 player.health = Math.min(100, player.health + 30); 
             } else { 
                 soundManager.current.playAmmoPickup(); 
                 player.ammoReserve = Math.min(MAX_RESERVE, player.ammoReserve + CLIP_SIZE); 
             }
             items.splice(i, 1);
        }
    }

    let dx = 0, dy = 0;
    if (keys.current['KeyW']) { dx += player.dir.x; dy += player.dir.y; }
    if (keys.current['KeyS']) { dx -= player.dir.x; dy -= player.dir.y; }
    if (keys.current['KeyA']) { dx -= player.dir.y; dy += player.dir.x; } 
    if (keys.current['KeyD']) { dx += player.dir.y; dy -= player.dir.x; }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const move = (MOVE_SPEED * dt) / len;
      if (map[Math.floor(player.pos.x + dx * move)]?.[Math.floor(player.pos.y)] === 0) player.pos.x += dx * move;
      if (map[Math.floor(player.pos.x)]?.[Math.floor(player.pos.y + dy * move)] === 0) player.pos.y += dy * move;
      walkCycle.current += dt * 15;
    }
    if (recoilImpulse.current > 0) recoilImpulse.current = Math.max(0, recoilImpulse.current - dt * 8);
    if (weaponRef.current) {
        const bob = len > 0 && player.z === 0 ? Math.sin(walkCycle.current) * 10 : 0;
        weaponRef.current.style.transform = `translateX(-50%) translateY(${25 + Math.abs(bob) + recoilImpulse.current * 45}px) scale(${isZooming.current ? 1.15 : 1})`;
    }
  };

  const render = () => {
    const ctx = canvasRef.current?.getContext('2d', { alpha: false });
    if (ctx) raycaster.current.render(ctx, stateRef.current, texturesRef.current);
  };

  useEffect(() => { requestRef.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(requestRef.current); }, [isPaused]); 

  return (
    <div className="relative group select-none overflow-hidden bg-black border-[12px] border-neutral-900 shadow-2xl">
      <canvas ref={canvasRef} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} className="block cursor-none" style={{ width: '800px', height: '600px' }} />
      <Minimap gameState={uiState} />
      
      {/* TACTICAL SCORE HUD */}
      <div className="absolute top-0 right-0 p-10 flex flex-col items-end z-20 pointer-events-none">
          <div className="font-mono text-[10px] text-white/40 tracking-[0.3em] uppercase mb-1">Combat Rating</div>
          <div className="font-mono text-4xl font-black text-white">{uiState.score.toString().padStart(4, '0')}</div>
      </div>

      {/* BOTTOM HUD - CLEAN & VECTOR */}
      <div className="absolute bottom-0 left-0 w-full p-10 flex justify-between items-end z-20 pointer-events-none">
         <div className="flex flex-col gap-1 pl-4 border-l-4 border-green-500">
             <div className="flex items-center gap-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
                <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-mono">Vitality Scan</div>
             </div>
             <div className={`font-mono text-5xl font-black leading-none ${uiState.player.health > 30 ? 'text-white' : 'text-red-500 animate-pulse'}`}>
                 {Math.ceil(uiState.player.health)}%
             </div>
         </div>
         <div className="text-right pr-4 border-r-4 border-white">
             <div className="flex items-center justify-end gap-2 mb-1">
                <div className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-mono">Munitions</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M14.5 2h-5L7 7v15h10V7l-2.5-5zm-3.5 13h2v2h-2v-2zm0-4h2v2h-2v-2z"/></svg>
             </div>
             <div className="text-white font-mono text-5xl font-black leading-none">
                {isInfiniteAmmo ? '∞' : uiState.player.ammo}<span className="text-xl text-white/20 ml-2">[{isInfiniteAmmo ? '∞' : uiState.player.ammoReserve}]</span>
             </div>
         </div>
      </div>
      
      {/* Vfx */}
      {uiState.player.health < 30 && <div className="absolute inset-0 bg-red-600/5 pointer-events-none animate-pulse z-10" />}
      {isHeadshot && <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-white font-mono text-2xl font-black uppercase tracking-[0.5em] z-40 bg-red-600 px-6 py-2">Critical</div>}

      {/* CLEAN CROSSHAIR - STRICT PLUS SIGN ONLY */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none z-30">
          {/* Main green bars */}
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-green-400 -translate-y-1/2 shadow-[0_0_2px_black]" />
          <div className="absolute left-1/2 top-0 w-[2px] h-full bg-green-400 -translate-x-1/2 shadow-[0_0_2px_black]" />
          
          {/* Optional hit flash - changes crosshair color subtly on hit */}
          <div className="absolute inset-0 transition-opacity duration-75" style={{ opacity: hitMarkerOpacity }}>
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white -translate-y-1/2 shadow-[0_0_4px_white]" />
              <div className="absolute left-1/2 top-0 w-[2px] h-full bg-white -translate-x-1/2 shadow-[0_0_4px_white]" />
          </div>
      </div>

      {/* Weapon */}
      <div ref={weaponRef} className="absolute bottom-0 left-1/2 w-64 h-64 pointer-events-none z-20 origin-bottom flex items-end justify-center transition-transform duration-75">
         <div className="relative w-20 h-52 bg-neutral-900 border-x-4 border-neutral-800 shadow-2xl rounded-t-lg">
            <div className="absolute top-0 w-full h-12 bg-neutral-800 rounded-t-md" />
            <div className="absolute top-14 left-1/2 -translate-x-1/2 w-8 h-14 bg-black/40 rounded-full" />
            {isShooting && <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-yellow-500/30 rounded-full blur-2xl animate-ping" />}
         </div>
      </div>

      {/* PAUSE MENU */}
      {isPaused && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
              <h2 className="text-white font-mono text-5xl font-black mb-10 tracking-[0.2em]">TERMINAL PAUSE</h2>
              
              <div className="flex flex-col gap-6 w-72 mb-10">
                  {/* Sensitivity Control */}
                  <div className="flex flex-col gap-2">
                      <div className="flex justify-between font-mono text-xs text-white/60 uppercase">
                          <span>Aim Sensitivity</span>
                          <span>{sensitivity.toFixed(1)}x</span>
                      </div>
                      <input 
                          type="range" 
                          min="0.1" 
                          max="3.0" 
                          step="0.1" 
                          value={sensitivity} 
                          onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                          className="w-full accent-green-500 bg-white/10"
                      />
                  </div>

                  {/* Ammo Mode Toggle */}
                  <button 
                      onClick={() => setIsInfiniteAmmo(!isInfiniteAmmo)}
                      className={`w-full py-3 font-mono font-bold uppercase tracking-wider border transition-colors ${isInfiniteAmmo ? 'bg-green-600 border-green-400 text-white' : 'border-white/20 text-white/60 hover:border-white/40'}`}
                  >
                      Ammo: {isInfiniteAmmo ? 'Infinite' : 'Tactical'}
                  </button>
              </div>

              <div className="flex flex-col gap-4 w-72">
                  <button onClick={() => setIsPaused(false)} className="w-full py-4 bg-white text-black font-mono font-black uppercase tracking-widest hover:bg-neutral-200 transition-colors">Resume</button>
                  <button onClick={onExit} className="w-full py-4 border-2 border-white text-white font-mono font-black uppercase tracking-widest hover:bg-white/10 transition-all">Abort Mission</button>
              </div>
          </div>
      )}

      {isGameOver && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50">
              <h1 className="text-7xl font-black text-red-600 font-mono mb-12 tracking-tighter">MISSION FAILED</h1>
              <div className="flex gap-6">
                  <button onClick={restartGame} className="px-12 py-5 bg-red-600 text-white font-mono font-black uppercase tracking-widest hover:scale-105 transition-transform">Redeploy</button>
                  <button onClick={onExit} className="px-12 py-5 border-2 border-white text-white font-mono font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">Exit</button>
              </div>
          </div>
      )}
    </div>
  );
};
