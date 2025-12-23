
import { CellType, type Texture } from '../types';

const TEX_WIDTH = 64;
const TEX_HEIGHT = 64;

const createTexture = (drawFn: (ctx: CanvasRenderingContext2D) => void): Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_WIDTH;
  canvas.height = TEX_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    // Standard clear to ensure full transparency
    ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    drawFn(ctx);
  }
  return { image: canvas, width: TEX_WIDTH, height: TEX_HEIGHT };
};

export const generateTextures = (): Record<number, Texture> => {
  const textures: Record<number, Texture> = {};

  // --- WALLS ---
  textures[CellType.WALL_1] = createTexture((ctx) => {
    ctx.fillStyle = '#6b1111';
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    for (let y = 0; y < TEX_HEIGHT; y += 16) {
      for (let x = 0; x < TEX_WIDTH; x += 32) {
        const offset = (y / 16) % 2 === 0 ? 0 : 16;
        ctx.fillStyle = '#8b2222';
        ctx.fillRect(x + offset + 2, y + 2, 28, 12);
        ctx.fillStyle = '#4a0808';
        ctx.fillRect(x + offset + 2, y + 14, 30, 2);
      }
    }
  });

  textures[CellType.WALL_2] = createTexture((ctx) => {
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() > 0.8 ? '#2d5a27' : '#4d4d4d';
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
  });

  textures[CellType.WALL_3] = createTexture((ctx) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 48, 48);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 16, 32, 32);
  });

  textures[CellType.WALL_4] = createTexture((ctx) => {
    ctx.fillStyle = '#452610';
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    ctx.fillStyle = '#5c3317';
    for (let x = 0; x < 64; x += 8) {
      ctx.fillRect(x + 1, 0, 6, 64);
    }
  });

  // --- SPRITES (Clean Pixel Art) ---
  textures[CellType.HEALTH_ORB] = createTexture((ctx) => {
    // White Sphere
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.fill();
    // Green Cross
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(28, 16, 8, 32);
    ctx.fillRect(16, 28, 32, 8);
    // Dark Border for contrast
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.stroke();
  });

  textures[CellType.AMMO_BOX] = createTexture((ctx) => {
    // Dark Body
    ctx.fillStyle = '#1a2e05'; 
    ctx.fillRect(10, 24, 44, 32);
    // Yellow Detail
    ctx.fillStyle = '#fde047';
    ctx.fillRect(12, 36, 40, 10);
    // Solid Black Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', 32, 44);
  });

  textures[CellType.ENEMY_GUARD] = createTexture((ctx) => {
    // Body (Deep Navy)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(18, 18, 28, 32);
    // Armor
    ctx.fillStyle = '#334155';
    ctx.fillRect(20, 20, 24, 18);
    // Helmet
    ctx.fillStyle = '#475569';
    ctx.fillRect(24, 6, 16, 12);
    // Visor (Vibrant Red)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(24, 10, 16, 4);
    // Legs
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(20, 50, 8, 10);
    ctx.fillRect(36, 50, 8, 10);
    // Weapon (Matte Black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(42, 28, 14, 6);
  });

  textures[CellType.PARTICLE_BLOOD] = createTexture((ctx) => {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(20, 20, 24, 24);
  });

  return textures;
};
