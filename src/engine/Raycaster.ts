import type { GameState, Player, Texture, Enemy, Item, Vector2 } from '../types';

interface RenderableSprite {
  pos: Vector2;
  textureId: number;
}

export class Raycaster {
  // Buffers
  private zBuffer: number[];
  private width: number;
  private height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.zBuffer = new Array(width).fill(0);
  }

  /**
   * Main render loop.
   * Renders the 3D scene onto the provided canvas context.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    gameState: GameState,
    textures: Record<number, Texture>
  ) {
    const { player, map, enemies, items } = gameState;
    const w = this.width;
    const h = this.height;

    // 1. Draw Ceiling and Floor (Simple solid colors for performance)
    ctx.fillStyle = '#383838';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#707070';
    ctx.fillRect(0, h / 2, w, h / 2);

    // 2. Wall Casting
    this.castWalls(ctx, player, map, textures, w, h);

    // 3. Sprite Casting (Enemies + Items)
    // Filter dead enemies, but keep all items
    const visibleEnemies = enemies.filter(e => e.health > 0);
    const allSprites: RenderableSprite[] = [...visibleEnemies, ...items];
    
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

      if (side === 0) {
        perpWallDist = (sideDistX - deltaDistX);
      } else {
        perpWallDist = (sideDistY - deltaDistY);
      }

      // Store in Z-Buffer for sprite occlusion
      this.zBuffer[x] = perpWallDist;

      const lineHeight = Math.floor(h / perpWallDist);
      let drawStart = -lineHeight / 2 + h / 2;
      if (drawStart < 0) drawStart = 0;
      let drawEnd = lineHeight / 2 + h / 2;
      if (drawEnd >= h) drawEnd = h - 1;

      const texNum = wallType;
      const texture = textures[texNum] || textures[1];
      
      let wallX; 
      if (side === 0) {
          wallX = player.pos.y + perpWallDist * rayDirY;
      } else {
          wallX = player.pos.x + perpWallDist * rayDirX;
      }
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texture.width);
      if (side === 0 && rayDirX > 0) texX = texture.width - texX - 1;
      if (side === 1 && rayDirY < 0) texX = texture.width - texX - 1;

      try {
        ctx.drawImage(
            texture.image, 
            texX, 0, 1, texture.height, 
            x, drawStart, 1, drawEnd - drawStart 
        );

        if (side === 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
        }
      } catch (e) {
        ctx.fillStyle = '#880000';
        ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
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
    // 1. Sort sprites from far to close
    const spriteOrder = sprites
      .map((sprite) => {
        const dist = 
          (player.pos.x - sprite.pos.x) * (player.pos.x - sprite.pos.x) + 
          (player.pos.y - sprite.pos.y) * (player.pos.y - sprite.pos.y);
        return { sprite, dist };
      })
      .sort((a, b) => b.dist - a.dist); // Descending order

    // 2. Project and draw sprites
    for (const item of spriteOrder) {
        const sprite = item.sprite;
        
        // Translate sprite position to relative to camera
        const spriteX = sprite.pos.x - player.pos.x;
        const spriteY = sprite.pos.y - player.pos.y;

        // Transform sprite with the inverse camera matrix
        const invDet = 1.0 / (player.plane.x * player.dir.y - player.dir.x * player.plane.y);
        
        const transformX = invDet * (player.dir.y * spriteX - player.dir.x * spriteY);
        const transformY = invDet * (-player.plane.y * spriteX + player.plane.x * spriteY); // this is depth (Z)

        // If sprite is behind the player, skip
        if (transformY <= 0) continue;

        const spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));

        // Calculate height of the sprite on screen
        const spriteHeight = Math.abs(Math.floor(h / transformY)); 
        
        // Calculate lowest and highest pixel to fill in current stripe
        let drawStartY = -spriteHeight / 2 + h / 2;
        if (drawStartY < 0) drawStartY = 0;
        let drawEndY = spriteHeight / 2 + h / 2;
        if (drawEndY >= h) drawEndY = h - 1;

        // Calculate width of the sprite
        const spriteWidth = Math.abs(Math.floor(h / transformY)); // Assume square aspect ratio for sprite
        let drawStartX = -spriteWidth / 2 + spriteScreenX;
        let drawEndX = spriteWidth / 2 + spriteScreenX;
        
        // Clip horizontally
        if (drawStartX < 0) drawStartX = 0;
        if (drawEndX >= w) drawEndX = w - 1;

        const texture = textures[sprite.textureId];
        if (!texture) continue;

        for (let stripe = Math.floor(drawStartX); stripe < Math.floor(drawEndX); stripe++) {
            const texX = Math.floor((stripe - (-spriteWidth / 2 + spriteScreenX)) * texture.width / spriteWidth);
            
            if (transformY > 0 && stripe > 0 && stripe < w && transformY < this.zBuffer[stripe]) {
                ctx.drawImage(
                    texture.image,
                    texX, 0, 1, texture.height,
                    stripe, drawStartY, 1, drawEndY - drawStartY
                );
            }
        }
    }
  }
}