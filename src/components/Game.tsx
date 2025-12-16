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
  type Item, 
  Difficulty,
  type DifficultyLevel 
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

const createInitialPlayer = (): Player => ({
  pos: { x: 22, y: 12 },
  dir: { x: -1, y: 0 },
  plane: { x: 0, y: 0.66 },
  health: 100,
  ammo: START_AMMO,
  ammoReserve: START_RESERVE
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
  
  // Input state
  const keys = useRef<Record<string, boolean>>({});
  const isZooming = useRef(false);
  const currentFovScale = useRef(FOV);

  // Animation state
  const walkCycle = useRef(0);
  const lastStepTime = useRef(0);
  const reloadStartTime = useRef(0);
  const recoilImpulse = useRef(0); // For smooth recoil animation
  
  const [isShooting, setIsShooting] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const shootTimer = useRef<number | null>(null);

  // Effects state
  const lastHealTime = useRef(0);
  const lastPickupTime = useRef(0);

  // Spawning state
  const lastSpawnTime = useRef(0);
  const enemyIdCounter = useRef(0);
  const itemIdCounter = useRef(0);

  // Game state stored in Ref for performance
  const stateRef = useRef<GameState>({
    player: createInitialPlayer(),
    enemies: [], 
    items: [],
    map: WORLD_MAP,
    lastTime: performance.now(),
    score: 0,
  });

  const [uiState, setUiState] = useState<GameState>(stateRef.current);
  const texturesRef = useRef(generateTextures());

  // Input Handling: Keyboard (Movement & Pause & Reload)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (e.code === 'Escape') {
            setIsPaused(prev => {
                const nextState = !prev;
                if (nextState) {
                    if (document.pointerLockElement) document.exitPointerLock();
                } 
                return nextState;
            });
        }
        if (e.code === 'KeyR') {
            reload();
        }
        keys.current[e.code] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isReloading, isPaused]); 

  // Input Handling: Mouse (Rotation & Shooting & Zoom)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (stateRef.current.player.health <= 0) return;
      if (isPaused) return;
      
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        soundManager.current.init();
      } else {
        if (e.button === 0) { // Left Click: Fire
          shoot();
        } else if (e.button === 2) { // Right Click: Zoom
          isZooming.current = true;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        isZooming.current = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (stateRef.current.player.health <= 0) return;
      if (isPaused) return;

      if (document.pointerLockElement === canvas) {
        const { player } = stateRef.current;
        
        const sensitivity = isZooming.current ? 0.0005 : 0.002;
        const rot = -e.movementX * sensitivity;

        const oldDirX = player.dir.x;
        player.dir.x = player.dir.x * Math.cos(rot) - player.dir.y * Math.sin(rot);
        player.dir.y = oldDirX * Math.sin(rot) + player.dir.y * Math.cos(rot);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isPaused, isReloading]); 

  const restartGame = () => {
    stateRef.current = {
        player: createInitialPlayer(),
        enemies: [],
        items: [],
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
    
    setTimeout(() => {
        if (canvasRef.current && !document.pointerLockElement) {
             canvasRef.current.requestPointerLock();
        }
    }, 100);
  };

  const handleResume = () => {
      setIsPaused(false);
      if (canvasRef.current) canvasRef.current.requestPointerLock();
  };

  const reload = () => {
      const { player } = stateRef.current;
      if (isReloading || player.ammo === CLIP_SIZE || player.ammoReserve === 0) return;
      if (player.health <= 0) return;

      setIsReloading(true);
      reloadStartTime.current = performance.now();
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

    const newEnemy: Enemy = {
      id: ++enemyIdCounter.current,
      pos: { x: point.x, y: point.y },
      dir: { x: 0, y: 1 }, 
      state: EnemyState.IDLE,
      health: 100,
      textureId: CellType.ENEMY_GUARD,
      lastAttackTime: now
    };

    stateRef.current.enemies.push(newEnemy);
    lastSpawnTime.current = now;
  };

  const shoot = () => {
    if (stateRef.current.player.health <= 0) return;
    if (isReloading) return;

    if (stateRef.current.player.ammo <= 0) {
        soundManager.current.playDryFire();
        return;
    }

    stateRef.current.player.ammo--;
    soundManager.current.playShoot();
    
    // Add recoil impulse
    recoilImpulse.current = 1.0;

    setIsShooting(true);
    if (shootTimer.current) clearTimeout(shootTimer.current);
    shootTimer.current = window.setTimeout(() => setIsShooting(false), 50); // Shorter flash

    const { player, enemies, map } = stateRef.current;
    
    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;

    enemies.forEach((enemy: Enemy) => {
      if (enemy.health <= 0) return;

      const dx = enemy.pos.x - player.pos.x;
      const dy = enemy.pos.y - player.pos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      const dot = dx * player.dir.x + dy * player.dir.y;
      
      if (dot > 0) {
        const perpDist = Math.abs(dx * player.dir.y - dy * player.dir.x);
        const HIT_WIDTH = 0.5; 

        if (perpDist < HIT_WIDTH) {
           if (hasLineOfSight(player.pos, enemy.pos, map)) {
             if (dist < closestDist) {
               closestDist = dist;
               closestEnemy = enemy;
             }
           }
        }
      }
    });

    if (closestEnemy) {
       const target = closestEnemy as Enemy;
       target.health -= 40; 
       
       if (target.health <= 0) {
           soundManager.current.playEnemyDeath();
           stateRef.current.score += 1; 
           
           // Drop Item (50/50 Chance for Health or Ammo)
           const isHealth = Math.random() > 0.5;
           const orb: Item = {
               id: ++itemIdCounter.current,
               pos: { x: target.pos.x, y: target.pos.y },
               textureId: isHealth ? CellType.HEALTH_ORB : CellType.AMMO_BOX,
               spawnTime: performance.now()
           };
           stateRef.current.items.push(orb);

       } else {
           soundManager.current.playEnemyHit();
           target.state = EnemyState.CHASE;
       }
    }
  };

  const tick = (time: number) => {
    if (isPaused) {
        stateRef.current.lastTime = time;
        requestRef.current = requestAnimationFrame(tick);
        return;
    }

    const dt = (time - stateRef.current.lastTime) / 1000;
    stateRef.current.lastTime = time;

    if (stateRef.current.player.health > 0) {
        updatePhysics(dt);
        updateAI(dt, time);
        spawnEnemy(time);
    } else if (!isGameOver) {
        setIsGameOver(true);
    }

    render();
    setUiState({ ...stateRef.current });
    requestRef.current = requestAnimationFrame(tick);
  };

  const hasLineOfSight = (p1: Vector2, p2: Vector2, map: number[][]): boolean => {
    const steps = 25; 
    const dx = (p2.x - p1.x) / steps;
    const dy = (p2.y - p1.y) / steps;
    
    let cx = p1.x;
    let cy = p1.y;
    
    for (let i = 0; i < steps; i++) {
        cx += dx;
        cy += dy;
        const mapX = Math.floor(cx);
        const mapY = Math.floor(cy);
        if (map[mapX] && map[mapX][mapY] > 0) {
            return false;
        }
    }
    return true;
  };

  const updateAI = (dt: number, now: number) => {
    const { player, enemies, map } = stateRef.current;
    const ENEMY_SPEED = 2.5;
    const AGGRO_RANGE = 10.0;
    const SHOOT_RANGE = 7.0; 
    const ATTACK_RANGE = 1.0; 

    let damageMelee = 10;
    let damageShootMin = 5;
    let damageShootMax = 10;

    if (difficulty === Difficulty.MEDIUM) {
        damageMelee = 20;
        damageShootMin = 10;
        damageShootMax = 15;
    } else if (difficulty === Difficulty.HARD) {
        damageMelee = 30;
        damageShootMin = 15;
        damageShootMax = 25;
    }

    stateRef.current.enemies = enemies.filter((e: Enemy) => {
       return e.health > 0;
    });

    stateRef.current.enemies.forEach((enemy: Enemy) => {
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (enemy.state === EnemyState.IDLE) {
            if (dist < AGGRO_RANGE && hasLineOfSight(enemy.pos, player.pos, map)) {
                enemy.state = EnemyState.CHASE;
            }
        }

        if (enemy.state === EnemyState.CHASE) {
            if (dist > ATTACK_RANGE) {
                const dirX = dx / dist;
                const dirY = dy / dist;
                const newX = enemy.pos.x + dirX * ENEMY_SPEED * dt;
                const newY = enemy.pos.y + dirY * ENEMY_SPEED * dt;

                if (map[Math.floor(newX)][Math.floor(enemy.pos.y)] === 0) enemy.pos.x = newX;
                if (map[Math.floor(enemy.pos.x)][Math.floor(newY)] === 0) enemy.pos.y = newY;
            } else {
                if (now - enemy.lastAttackTime > 1000) { 
                    enemy.lastAttackTime = now;
                    player.health -= damageMelee;
                    soundManager.current.playPlayerDamage();
                }
            }

            if (dist < SHOOT_RANGE && dist > ATTACK_RANGE) {
                if (now - enemy.lastAttackTime > 1500 && hasLineOfSight(enemy.pos, player.pos, map)) {
                    enemy.lastAttackTime = now;
                    const dmg = damageShootMin + Math.random() * (damageShootMax - damageShootMin);
                    player.health -= dmg;
                    soundManager.current.playEnemyShoot();
                    soundManager.current.playPlayerDamage();
                }
            }
        }
    });
  };

  const updatePhysics = (dt: number) => {
    const { player, map, items } = stateRef.current;
    const PLAYER_RADIUS = 0.25;

    const targetFov = isZooming.current ? 0.30 : FOV; 
    const fovSpeed = 5.0 * dt;
    currentFovScale.current = currentFovScale.current + (targetFov - currentFovScale.current) * fovSpeed;

    player.plane.x = player.dir.y * currentFovScale.current;
    player.plane.y = -player.dir.x * currentFovScale.current;

    const isColliding = (x: number, y: number) => {
      const offsets = [
          { x: -PLAYER_RADIUS, y: -PLAYER_RADIUS },
          { x: PLAYER_RADIUS, y: -PLAYER_RADIUS },
          { x: -PLAYER_RADIUS, y: PLAYER_RADIUS },
          { x: PLAYER_RADIUS, y: PLAYER_RADIUS },
      ];

      for (const offset of offsets) {
          const checkX = Math.floor(x + offset.x);
          const checkY = Math.floor(y + offset.y);
          if (checkX < 0 || checkX >= map.length || checkY < 0 || checkY >= map[0].length) return true;
          if (map[checkX][checkY] !== 0) return true;
      }
      return false;
    };

    const now = performance.now();
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        
        if (now - item.spawnTime > 15000) { 
            items.splice(i, 1);
            continue;
        }

        const dx = player.pos.x - item.pos.x;
        const dy = player.pos.y - item.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 0.8) { 
             // Always consume item and play sound
             if (item.textureId === CellType.HEALTH_ORB) {
                 soundManager.current.playHeal();
                 if (player.health < 100) {
                    player.health = Math.min(100, player.health + 30);
                    lastHealTime.current = performance.now();
                 }
             } else if (item.textureId === CellType.AMMO_BOX) {
                 soundManager.current.playAmmoPickup();
                 if (player.ammoReserve < MAX_RESERVE) {
                    player.ammoReserve = Math.min(MAX_RESERVE, player.ammoReserve + CLIP_SIZE);
                    lastPickupTime.current = performance.now();
                 }
             }
             // Removed condition, always remove item
             items.splice(i, 1);
        }
    }

    let dx = 0;
    let dy = 0;

    if (keys.current['ArrowUp'] || keys.current['KeyW']) { dx += player.dir.x; dy += player.dir.y; }
    if (keys.current['ArrowDown'] || keys.current['KeyS']) { dx -= player.dir.x; dy -= player.dir.y; }
    if (keys.current['KeyA']) { dx -= player.dir.y; dy += player.dir.x; } 
    if (keys.current['KeyD']) { dx += player.dir.y; dy -= player.dir.x; }

    const length = Math.sqrt(dx * dx + dy * dy);
    let isMoving = false;
    if (length > 0) {
      isMoving = true;
      dx /= length; dy /= length;
      const moveStep = MOVE_SPEED * dt;
      dx *= moveStep; dy *= moveStep;

      const nextX = player.pos.x + dx;
      if (!isColliding(nextX, player.pos.y)) player.pos.x = nextX;
      const nextY = player.pos.y + dy;
      if (!isColliding(player.pos.x, nextY)) player.pos.y = nextY;
    }

    if (isMoving) {
        walkCycle.current += dt * 15; 
        if (Math.sin(walkCycle.current) < -0.9 && performance.now() - lastStepTime.current > 300) {
            soundManager.current.playStep();
            lastStepTime.current = performance.now();
        }
    } else {
        walkCycle.current = 0;
    }

    // Decay recoil
    if (recoilImpulse.current > 0) {
        recoilImpulse.current -= dt * 8; // Recover speed
        if (recoilImpulse.current < 0) recoilImpulse.current = 0;
    }

    if (weaponRef.current) {
        const bobAmplitude = isZooming.current ? 2 : 15;
        const bobOffset = isMoving ? Math.sin(walkCycle.current) * bobAmplitude : 0;
        const swayOffset = isMoving ? Math.cos(walkCycle.current * 0.5) * (bobAmplitude * 0.5) : 0;
        
        let recoilY = 0;
        let rotation = 0;
        let horizontalOffset = 0;

        // Visual Reload Animation
        if (isReloading) {
            const progress = (now - reloadStartTime.current) / RELOAD_TIME;
            
            // 0% - 20%: Lower Weapon (0 - 400ms)
            if (progress < 0.2) {
                recoilY += (progress / 0.2) * 150; 
            } 
            // 20% - 70%: Hold Low (400 - 1400ms) - "Mag Swap" logic
            else if (progress < 0.7) {
                recoilY += 150;
                rotation = 10; // Tilt slightly
                
                // Shake during "Mag Insertion" ~ 0.4 (800ms) which aligns with sound
                if (progress > 0.4 && progress < 0.5) {
                    recoilY += Math.sin(progress * 100) * 10;
                    horizontalOffset = Math.random() * 6 - 3;
                }
            } 
            // 70% - 75%: Raise Weapon quickly (1400 - 1500ms)
            else if (progress < 0.75) {
                const raiseProgress = (progress - 0.7) / 0.05;
                recoilY += 150 * (1 - raiseProgress);
                rotation = 10 * (1 - raiseProgress);
            } 
            // 75% - 85%: Slide Rack (1500 - 1700ms) - Aligns with sound
            else if (progress < 0.85) {
                 // Fast Jerk Back and Forth
                 const rackProgress = (progress - 0.75) / 0.1;
                 const rackOffset = Math.sin(rackProgress * Math.PI * 2) * 30; // 30px rack travel
                 
                 horizontalOffset += rackOffset * 0.2; // Slight horizontal movement
                 recoilY += Math.abs(rackOffset) * 0.5; // Slight vertical kick from rack
                 rotation -= rackOffset * 0.1; // Slight tilt
            }
            // 85% - 100%: Stabilize
            else {
                 const stabilizeProgress = (progress - 0.85) / 0.15;
                 recoilY += Math.sin(stabilizeProgress * Math.PI) * 2;
            }
        } else {
             // Shooting Recoil Logic
             const kick = recoilImpulse.current * recoilImpulse.current; // ease out
             recoilY += kick * 60; // Kick back (down)
             rotation -= kick * 5; // Slight tilt left/up
             horizontalOffset += (Math.random() - 0.5) * kick * 20; // Random horizontal shake
        }

        const baseY = isZooming.current ? 40 : 30;
        
        weaponRef.current.style.transform = `
            translateX(calc(-50% + ${swayOffset + horizontalOffset}px)) 
            translateY(${baseY + Math.abs(bobOffset) + recoilY}px) 
            rotate(${rotation}deg)
            scale(${isZooming.current ? 1.2 : 1})
        `;
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    raycaster.current.render(ctx, stateRef.current, texturesRef.current);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused]); 

  const healthColor = uiState.player.health > 50 ? 'text-green-400' : uiState.player.health > 20 ? 'text-yellow-400' : 'text-red-500';
  const showHealFlash = performance.now() - lastHealTime.current < 200;
  const showPickupFlash = performance.now() - lastPickupTime.current < 200;

  return (
    <div className="relative group select-none">
      <canvas 
        ref={canvasRef} 
        width={SCREEN_WIDTH} 
        height={SCREEN_HEIGHT} 
        className="block bg-black shadow-2xl rounded-sm cursor-none"
        style={{ width: '800px', height: '600px' }} 
      />
      
      <Minimap gameState={uiState} />
      
      {/* HUD Bar */}
      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-end bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-20">
         <div className="flex flex-col gap-1 w-24">
             <div className="text-white/60 text-xs tracking-widest uppercase">Health</div>
             <div className={`font-mono text-4xl font-bold ${healthColor}`}>
                 {Math.max(0, Math.ceil(uiState.player.health))}%
             </div>
         </div>
         
         <div className="flex flex-col items-center">
            <div className="text-white/60 text-xs tracking-widest uppercase">Score</div>
            <div className="font-mono text-3xl font-bold text-yellow-400">
                {uiState.score}
            </div>
         </div>

         <div className="text-right w-24">
             <div className="text-white/60 text-xs tracking-widest uppercase mb-1">AMMO</div>
             <div className={`text-white font-mono text-4xl font-bold flex items-baseline justify-end gap-2 ${uiState.player.ammo === 0 ? 'text-red-500 animate-pulse' : ''}`}>
                 <span>{uiState.player.ammo}</span>
                 <span className="text-lg text-gray-500">/ {uiState.player.ammoReserve}</span>
             </div>
         </div>
      </div>
      
      {/* Effects */}
      {uiState.player.health < 30 && uiState.player.health > 0 && (
          <div className="absolute inset-0 bg-red-500/10 pointer-events-none animate-pulse z-10"></div>
      )}
      {showHealFlash && (
           <div className="absolute inset-0 bg-green-500/20 pointer-events-none z-10"></div>
      )}
      {showPickupFlash && (
           <div className="absolute inset-0 bg-yellow-500/20 pointer-events-none z-10"></div>
      )}

      {/* Status Messages */}
       {!isReloading && uiState.player.ammo === 0 && uiState.player.ammoReserve > 0 && (
           <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-red-500 font-mono text-sm tracking-widest uppercase animate-pulse">
               Press R to Reload
           </div>
      )}
      {!isReloading && uiState.player.ammo === 0 && uiState.player.ammoReserve === 0 && (
           <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-red-600 font-mono text-sm tracking-widest uppercase font-bold">
               OUT OF AMMO
           </div>
      )}

      {/* Pause Menu */}
      {isPaused && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <h1 className="text-5xl font-bold text-white mb-8 tracking-widest font-mono">PAUSED</h1>
              <div className="flex flex-col gap-4 w-64">
                  <button 
                      onClick={handleResume}
                      className="px-6 py-3 bg-white text-black font-mono font-bold hover:bg-gray-200 uppercase tracking-wider"
                  >
                      Resume
                  </button>
                  <button 
                      onClick={onExit}
                      className="px-6 py-3 border border-red-500 text-red-500 font-mono font-bold hover:bg-red-500 hover:text-white uppercase tracking-wider transition-colors"
                  >
                      Quit to Menu
                  </button>
              </div>
          </div>
      )}

      {/* Crosshair */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none transition-all duration-200 ${isZooming.current ? 'w-8 h-8 border border-green-500 rounded-full bg-green-500/20' : 'w-1 h-1 bg-green-400'}`} />
      
      {isZooming.current && (
         <div className="absolute inset-0 pointer-events-none z-20 bg-radial-gradient-scope"></div>
      )}
      {/* Enhanced Muzzle Flash */}
      {isShooting && !isReloading && (
          <div className="absolute bottom-[9rem] left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-300 rounded-full blur-xl opacity-80 z-30 pointer-events-none animate-pulse mix-blend-screen">
               <div className="absolute inset-2 bg-white rounded-full blur-md opacity-90"></div>
          </div>
      )}

      {/* Weapon Sprite */}
      <div 
        ref={weaponRef}
        className="absolute bottom-0 left-1/2 w-64 h-64 pointer-events-none opacity-90 z-20 transition-transform duration-75 origin-bottom-center"
        style={{ transform: 'translateX(-50%) translateY(10%)' }} 
      >
         <div className="w-full h-full relative">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-48 bg-gray-800 border-l-4 border-gray-600 rounded-t-lg"></div>
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-24 h-12 bg-black rounded-lg"></div>
         </div>
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-in fade-in duration-1000">
              <h1 className="text-6xl font-bold text-red-600 font-mono mb-4 tracking-wider">YOU DIED</h1>
              <div className="text-2xl font-mono text-yellow-400 mb-8">FINAL SCORE: {uiState.score}</div>
              <div className="flex gap-4">
                <button 
                    onClick={restartGame}
                    className="px-6 py-3 bg-red-800 hover:bg-red-700 text-white font-mono uppercase tracking-widest border border-red-500 hover:scale-105 transition-all"
                >
                    Respawn
                </button>
                 <button 
                    onClick={onExit}
                    className="px-6 py-3 border border-gray-500 text-gray-400 hover:text-white font-mono uppercase tracking-widest hover:border-white transition-all"
                >
                    Main Menu
                </button>
              </div>
          </div>
      )}
      
      <style>{`
        .bg-radial-gradient-scope {
          background: radial-gradient(circle, transparent 30%, rgba(0,0,0,0.8) 70%, black 100%);
        }
      `}</style>
    </div>
  );
};