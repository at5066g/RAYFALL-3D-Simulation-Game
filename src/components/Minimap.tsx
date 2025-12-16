import React, { useEffect, useRef } from 'react';
import type { GameState } from '../types';

interface MinimapProps {
  gameState: GameState;
}

export const Minimap: React.FC<MinimapProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CELL_SIZE = 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { map, player } = gameState;
    const mapW = map.length;
    const mapH = map[0].length;

    canvas.width = mapW * CELL_SIZE;
    canvas.height = mapH * CELL_SIZE;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Walls
    for (let x = 0; x < mapW; x++) {
      for (let y = 0; y < mapH; y++) {
        if (map[x][y] > 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    // Draw Player
    const px = player.pos.x * CELL_SIZE;
    const py = player.pos.y * CELL_SIZE;

    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Draw Direction
    ctx.strokeStyle = '#FFFF00';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + player.dir.x * 10, py + player.dir.y * 10);
    ctx.stroke();

  }, [gameState]); // Re-render when game state updates (usually 60fps, might want to throttle in production)

  return (
    <div className="absolute top-4 left-4 border-2 border-white/50 bg-black/80 shadow-lg">
      <canvas ref={canvasRef} />
    </div>
  );
};