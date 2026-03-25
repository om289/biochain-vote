/**
 * Minimal canvas-based QR Code generator (no dependencies).
 * Uses a simple text-to-matrix pattern for demo purposes.
 * In production, swap this for a proper QR library.
 */
export function generateQRDataURL(text: string, size: number = 200): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Generate a deterministic pattern from the text
  const hash = simpleHash(text);
  const gridSize = 21; // Standard QR is 21x21 minimum
  const cellSize = size / gridSize;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Draw finder patterns (top-left, top-right, bottom-left)
  drawFinderPattern(ctx, 0, 0, cellSize);
  drawFinderPattern(ctx, (gridSize - 7) * cellSize, 0, cellSize);
  drawFinderPattern(ctx, 0, (gridSize - 7) * cellSize, cellSize);

  // Draw data cells based on hash
  ctx.fillStyle = '#000000';
  let hashIndex = 0;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Skip finder pattern areas
      if (isFinderArea(row, col, gridSize)) continue;

      const charCode = hash.charCodeAt(hashIndex % hash.length) + row * col;
      if (charCode % 3 !== 0) {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
      hashIndex++;
    }
  }

  return canvas.toDataURL('image/png');
}

function simpleHash(str: string): string {
  let hash = 0;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  // Convert to a longer hex-like string
  for (let i = 0; i < 64; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i % str.length) + i;
    hash |= 0;
    result += Math.abs(hash % 16).toString(16);
  }
  return result;
}

function drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number) {
  // Outer black border (7x7)
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, cellSize * 7, cellSize * 7);

  // Inner white (5x5)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5);

  // Center black (3x3)
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3);
}

function isFinderArea(row: number, col: number, gridSize: number): boolean {
  // Top-left
  if (row < 8 && col < 8) return true;
  // Top-right
  if (row < 8 && col >= gridSize - 8) return true;
  // Bottom-left
  if (row >= gridSize - 8 && col < 8) return true;
  return false;
}
