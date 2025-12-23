
import type { GameState, Player, Texture, Enemy, Item, Vector2 } from '../types';

interface RenderableSprite {
  pos: Vector2;
  textureId: number;
}

export class Raycaster {
  private zBuffer: number[];
  private width: number;
  private height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.zBuffer = new Array(width).fill(0);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    gameState: GameState,
    textures: Record<number, Texture>
  ) {
    const { player, map, enemies, items, particles } = gameState;
    const w = this.width;
    const h = this.height;
    const horizonOffset = player.pitch;

    // 1. Clean Retro Background (Flat colors, no overlays)
    ctx.fillStyle = '#1a1a1a'; // Ceiling
    ctx.fillRect(0, 0, w, h / 2 + horizonOffset);
    
    ctx.fillStyle = '#333333'; // Floor
    ctx.fillRect(0, h / 2 + horizonOffset, w, h);

    // 2. Wall Casting
    this.castWalls(ctx, player, map, textures, w, h);

    // 3. Sprite Casting (Enemies + Items + Particles)
    const allSprites: RenderableSprite[] = [...enemies, ...items, ...particles];
    this.castSprites(ctx, player, allSprites, textures, w, h);
  }

  private castWalls(
    ctx: CanvasRenderingContext2D, 
    player: Player, 
    map: number[][], 
    textures: Record<number, Texture>,
    w: number, 
    h: number
  ) {
    for (let x = 0; x < w; x++) {
      const cameraX = 2 * x / w - 1; 
      const rayDirX = player.dir.x + player.plane.x * cameraX;
      const rayDirY = player.dir.y + player.plane.y * cameraX;

      let mapX = Math.floor(player.pos.x);
      let mapY = Math.floor(player.pos.y);

      let sideDistX;
      let sideDistY;

      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      let perpWallDist;
      let stepX;
      let stepY;

      let hit = 0;
      let side = 0;
      let wallType = 0;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (player.pos.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - player.pos.x) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (player.pos.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - player.pos.y) * deltaDistY;
      }

      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (map[mapX] && map[mapX][mapY] > 0) {
          hit = 1;
          wallType = map[mapX][mapY];
        }
      }

      if (side === 0) perpWallDist = (sideDistX - deltaDistX);
      else perpWallDist = (sideDistY - deltaDistY);

      this.zBuffer[x] = perpWallDist;

      const lineHeight = Math.floor(h / perpWallDist);
      const playerHeightOffset = (player.z * h) / perpWallDist;
      
      let drawStart = -lineHeight / 2 + h / 2 + player.pitch + playerHeightOffset;
      let drawEnd = lineHeight / 2 + h / 2 + player.pitch + playerHeightOffset;

      const texture = textures[wallType] || textures[1];
      let wallX = side === 0 ? player.pos.y + perpWallDist * rayDirY : player.pos.x + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texture.width);
      if (side === 0 && rayDirX > 0) texX = texture.width - texX - 1;
      if (side === 1 && rayDirY < 0) texX = texture.width - texX - 1;

      const clippedStart = Math.max(0, drawStart);
      const clippedEnd = Math.min(h - 1, drawEnd);

      if (clippedEnd > clippedStart) {
        ctx.drawImage(
            texture.image, 
            texX, 0, 1, texture.height, 
            x, clippedStart, 1, clippedEnd - clippedStart 
        );

        if (side === 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(x, clippedStart, 1, clippedEnd - clippedStart);
        }

        const fogDistance = 14.0;
        let fogAmount = Math.min(1, perpWallDist / fogDistance);
        if (fogAmount > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${fogAmount * 0.85})`;
            ctx.fillRect(x, clippedStart, 1, clippedEnd - clippedStart);
        }
      }
    }
  }

  private castSprites(
    ctx: CanvasRenderingContext2D,
    player: Player,
    sprites: RenderableSprite[],
    textures: Record<number, Texture>,
    w: number,
    h: number
  ) {
    const spriteOrder = sprites
      .map((sprite) => {
        const dist = (player.pos.x - sprite.pos.x) ** 2 + (player.pos.y - sprite.pos.y) ** 2;
        return { sprite, dist };
      })
      .sort((a, b) => b.dist - a.dist); 

    for (const item of spriteOrder) {
        const { sprite } = item;
        const spriteX = sprite.pos.x - player.pos.x;
        const spriteY = sprite.pos.y - player.pos.y;
        const invDet = 1.0 / (player.plane.x * player.dir.y - player.dir.x * player.plane.y);
        
        const transformX = invDet * (player.dir.y * spriteX - player.dir.x * spriteY);
        const transformY = invDet * (-player.plane.y * spriteX + player.plane.x * spriteY); 

        if (transformY <= 0) continue;

        const spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));
        const spriteHeight = Math.abs(Math.floor(h / transformY)); 
        const vOffset = player.pitch + (player.z * h) / transformY;

        let drawStartY = -spriteHeight / 2 + h / 2 + vOffset;
        let drawEndY = spriteHeight / 2 + h / 2 + vOffset;

        const spriteWidth = Math.abs(Math.floor(h / transformY)); 
        let drawStartX = Math.max(0, -spriteWidth / 2 + spriteScreenX);
        let drawEndX = Math.min(w - 1, spriteWidth / 2 + spriteScreenX);
        
        const texture = textures[sprite.textureId];
        if (!texture) continue;

        // SPRITE TRANSPARENCY FIX:
        // We draw the sprite slice by slice. We NO LONGER call fillRect here
        // because it draws a black box regardless of the sprite's alpha channel.
        for (let stripe = Math.floor(drawStartX); stripe < Math.floor(drawEndX); stripe++) {
            const texX = Math.floor((stripe - (-spriteWidth / 2 + spriteScreenX)) * texture.width / spriteWidth);
            if (transformY > 0 && stripe > 0 && stripe < w && transformY < this.zBuffer[stripe]) {
                const clippedYStart = Math.max(0, drawStartY);
                const clippedYEnd = Math.min(h - 1, drawEndY);

                if (clippedYEnd > clippedYStart) {
                    ctx.drawImage(
                        texture.image,
                        texX, 0, 1, texture.height,
                        stripe, clippedYStart, 1, clippedYEnd - clippedYStart
                    );
                    
                    // Note: If you want fog on sprites, it must be done via globalCompositeOperation
                    // or by modifying the texture source. Standard fillRect creates the 'black box'.
                }
            }
        }
    }
  }
}
