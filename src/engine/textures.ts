import { CellType, type Texture } from '../types';

const TEX_WIDTH = 64;
const TEX_HEIGHT = 64;

// Helper to create a canvas texture
const createTexture = (drawFn: (ctx: CanvasRenderingContext2D) => void): Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_WIDTH;
  canvas.height = TEX_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx);
  }
  return { image: canvas, width: TEX_WIDTH, height: TEX_HEIGHT };
};

export const generateTextures = (): Record<number, Texture> => {
  const textures: Record<number, Texture> = {};

  // 1. Red Brick
  textures[CellType.WALL_1] = createTexture((ctx) => {
    ctx.fillStyle = '#8B0000'; // Dark Red
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    ctx.fillStyle = '#A52A2A'; // Brown/Red Light
    // Draw brick pattern
    for (let y = 0; y < TEX_HEIGHT; y += 16) {
      for (let x = 0; x < TEX_WIDTH; x += 32) {
        const offset = (y / 16) % 2 === 0 ? 0 : 16;
        ctx.fillRect(x + offset + 1, y + 1, 30, 14);
      }
    }
  });

  // 2. Green Slime / Mossy Stone
  textures[CellType.WALL_2] = createTexture((ctx) => {
    ctx.fillStyle = '#2F4F4F'; // Dark Slate Gray
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    // Add noise
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#006400' : '#556B2F';
      const size = Math.random() * 8 + 2;
      ctx.fillRect(Math.random() * TEX_WIDTH, Math.random() * TEX_HEIGHT, size, size);
    }
  });

  // 3. Blue Tech
  textures[CellType.WALL_3] = createTexture((ctx) => {
    ctx.fillStyle = '#00008B'; // Dark Blue
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    ctx.strokeStyle = '#00FFFF'; // Cyan
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, TEX_WIDTH - 8, TEX_HEIGHT - 8);
    ctx.beginPath();
    ctx.moveTo(TEX_WIDTH / 2, 4);
    ctx.lineTo(TEX_WIDTH / 2, TEX_HEIGHT - 4);
    ctx.moveTo(4, TEX_HEIGHT / 2);
    ctx.lineTo(TEX_WIDTH - 4, TEX_HEIGHT / 2);
    ctx.stroke();
  });

  // 4. Wood
  textures[CellType.WALL_4] = createTexture((ctx) => {
    ctx.fillStyle = '#8B4513'; // SaddleBrown
    ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    ctx.fillStyle = '#A0522D'; // Sienna
    // Vertical planks
    for (let x = 0; x < TEX_WIDTH; x += 16) {
        ctx.fillRect(x + 2, 0, 12, TEX_HEIGHT);
    }
    // Nails
    ctx.fillStyle = '#222';
    for (let x = 8; x < TEX_WIDTH; x += 16) {
        ctx.fillRect(x - 1, 4, 2, 2);
        ctx.fillRect(x - 1, TEX_HEIGHT - 6, 2, 2);
    }
  });

  // 50. Health Orb
  textures[CellType.HEALTH_ORB] = createTexture((ctx) => {
    // Transparent BG
    ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    
    // Glowing Green Orb
    const grad = ctx.createRadialGradient(32, 32, 5, 32, 32, 28);
    grad.addColorStop(0, '#aaffaa');
    grad.addColorStop(0.5, '#00ff00');
    grad.addColorStop(1, 'rgba(0, 255, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    // Cross in middle
    ctx.fillStyle = '#fff';
    ctx.fillRect(28, 16, 8, 32);
    ctx.fillRect(16, 28, 32, 8);
  });

  // 51. Ammo Box
  textures[CellType.AMMO_BOX] = createTexture((ctx) => {
    // Transparent BG
    ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    
    // Metallic Yellow Box
    ctx.fillStyle = '#D4AF37'; // Gold
    ctx.fillRect(16, 24, 32, 24);
    
    // Outline
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8B6508';
    ctx.strokeRect(16, 24, 32, 24);

    // Lid line
    ctx.beginPath();
    ctx.moveTo(16, 32);
    ctx.lineTo(48, 32);
    ctx.stroke();

    // Bullet Icon
    const centerX = 32;
    const centerY = 36;

    // Casing
    ctx.fillStyle = '#B8860B'; // Dark Goldenrod
    ctx.fillRect(centerX - 4, centerY - 6, 8, 14);

    // Tip
    ctx.fillStyle = '#C0C0C0'; // Silver
    ctx.beginPath();
    ctx.moveTo(centerX - 4, centerY - 6);
    ctx.lineTo(centerX, centerY - 12);
    ctx.lineTo(centerX + 4, centerY - 6);
    ctx.fill();

    // Rim
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(centerX - 5, centerY + 8, 10, 2);
  });

  // 99. Enemy Guard
  textures[CellType.ENEMY_GUARD] = createTexture((ctx) => {
    // Transparent Background
    ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    
    // Body (Blue Uniform)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(20, 20, 24, 44);
    
    // Head (Flesh tone)
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(24, 10, 16, 14);

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(26, 14, 4, 2);
    ctx.fillRect(34, 14, 4, 2);

    // Gun (Gray)
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(36, 35, 20, 8); // Barrel
    ctx.fillRect(38, 38, 8, 12); // Stock
  });

  return textures;
};