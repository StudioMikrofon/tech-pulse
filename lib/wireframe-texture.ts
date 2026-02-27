/**
 * Generates a wireframe globe texture (Jarvis blueprint style) with continent outlines.
 * Returns a data URL for use as globeImageUrl.
 *
 * @param brightness - brightness boost 0-1 (default 0.15 = +15%)
 * @param contrast  - contrast boost 0-1 (default 0.10 = +10%)
 */

// Simplified continent outlines as [lat, lon] pairs
const CONTINENTS: [number, number][][] = [
  // North America
  [
    [60, -140], [65, -168], [72, -160], [71, -155], [70, -140], [68, -135],
    [60, -140], [55, -130], [50, -128], [48, -124], [38, -122], [32, -117],
    [25, -110], [20, -105], [15, -92], [18, -88], [21, -87], [25, -80],
    [30, -82], [30, -85], [33, -80], [35, -76], [40, -74], [42, -70],
    [44, -67], [47, -60], [50, -57], [52, -56], [55, -60], [58, -64],
    [60, -65], [63, -73], [65, -85], [68, -95], [70, -100], [70, -120],
    [68, -135], [60, -140],
  ],
  // South America
  [
    [12, -72], [10, -75], [8, -77], [5, -77], [1, -80], [-5, -81],
    [-15, -75], [-23, -70], [-33, -72], [-40, -73], [-45, -75], [-52, -70],
    [-55, -68], [-54, -64], [-48, -65], [-42, -63], [-35, -57], [-33, -53],
    [-28, -49], [-23, -43], [-15, -39], [-10, -37], [-5, -35], [0, -50],
    [5, -60], [8, -62], [10, -67], [12, -72],
  ],
  // Europe
  [
    [36, -10], [38, -9], [43, -9], [44, -2], [46, -2], [48, -5],
    [50, -5], [51, 1], [54, -3], [56, -5], [58, -3], [59, -1],
    [61, 5], [64, 10], [68, 16], [71, 25], [70, 30], [65, 30],
    [60, 30], [55, 28], [50, 30], [47, 28], [44, 28], [42, 28],
    [40, 26], [38, 24], [36, 22], [35, 25], [36, 28], [34, 32],
    [36, 15], [38, 12], [40, 18], [42, 15], [44, 12], [43, 10],
    [40, 10], [38, 0], [36, -5], [36, -10],
  ],
  // Africa
  [
    [37, -10], [35, -5], [36, 0], [37, 10], [33, 12], [32, 25],
    [30, 32], [22, 37], [15, 42], [12, 44], [5, 42], [0, 42],
    [-5, 40], [-10, 40], [-15, 40], [-20, 35], [-26, 33], [-33, 28],
    [-35, 20], [-34, 18], [-30, 17], [-22, 14], [-17, 12], [-12, 14],
    [-5, 12], [0, 10], [5, 10], [5, 1], [5, -5], [10, -15],
    [15, -17], [20, -17], [25, -15], [30, -10], [35, -5], [37, -10],
  ],
  // Asia (simplified)
  [
    [42, 28], [45, 40], [42, 45], [40, 50], [38, 55], [37, 60],
    [35, 65], [30, 70], [25, 68], [24, 72], [20, 73], [10, 78],
    [7, 80], [2, 104], [5, 108], [10, 110], [20, 110], [22, 115],
    [30, 122], [35, 130], [38, 135], [40, 132], [42, 133], [45, 142],
    [50, 143], [55, 137], [60, 150], [65, 170], [68, 180], [72, 180],
    [75, 140], [73, 120], [72, 80], [70, 60], [68, 50], [65, 40],
    [55, 28], [50, 30], [47, 28], [42, 28],
  ],
  // Australia
  [
    [-12, 130], [-14, 127], [-18, 122], [-22, 114], [-28, 114], [-33, 115],
    [-35, 117], [-35, 138], [-37, 140], [-38, 145], [-38, 148],
    [-34, 151], [-28, 153], [-24, 152], [-19, 146], [-16, 145],
    [-14, 143], [-12, 142], [-11, 136], [-12, 130],
  ],
  // Antarctica (simplified outline)
  [
    [-65, -60], [-68, -65], [-72, -70], [-75, -60], [-78, -40],
    [-80, -20], [-80, 0], [-78, 30], [-75, 60], [-72, 80],
    [-70, 100], [-68, 120], [-66, 140], [-68, 160], [-72, 170],
    [-75, 180], [-78, -170], [-75, -140], [-72, -120], [-70, -100],
    [-68, -80], [-65, -60],
  ],
];

function latLonToXY(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

export function generateWireframeTexture(
  brightness: number = 0.15,
  contrast: number = 0.10,
): string {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Brightness/contrast multipliers
  const bMul = 1 + brightness; // e.g. 1.15
  const cMul = 1 + contrast;   // e.g. 1.10

  // Helper: apply brightness to an alpha value
  const a = (base: number) => Math.min(base * bMul * cMul, 1);

  // Dark background — slightly brighter base
  const bgBright = Math.min(5 + Math.round(brightness * 20), 20);
  ctx.fillStyle = `rgb(${bgBright}, ${bgBright + 2}, ${bgBright + 6})`;
  ctx.fillRect(0, 0, W, H);

  // Grid lines every 15 degrees — brighter
  ctx.strokeStyle = `rgba(0, 212, 255, ${a(0.22).toFixed(3)})`;
  ctx.lineWidth = 1;

  for (let lon = 0; lon <= 360; lon += 15) {
    const x = (lon / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let lat = 0; lat <= 180; lat += 15) {
    const y = (lat / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Brighter equator and prime meridian
  ctx.strokeStyle = `rgba(0, 212, 255, ${a(0.5).toFixed(3)})`;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Tropics (Cancer + Capricorn) — subtle lines
  ctx.strokeStyle = `rgba(0, 212, 255, ${a(0.12).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 12]);
  const tropicY1 = ((90 - 23.44) / 180) * H;
  const tropicY2 = ((90 + 23.44) / 180) * H;
  ctx.beginPath();
  ctx.moveTo(0, tropicY1);
  ctx.lineTo(W, tropicY1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, tropicY2);
  ctx.lineTo(W, tropicY2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw continent outlines
  for (const continent of CONTINENTS) {
    // Fill with subtle color — brighter
    ctx.fillStyle = `rgba(0, 212, 255, ${a(0.08).toFixed(3)})`;
    ctx.beginPath();
    const [startX, startY] = latLonToXY(continent[0][0], continent[0][1], W, H);
    ctx.moveTo(startX, startY);
    for (let i = 1; i < continent.length; i++) {
      const [x, y] = latLonToXY(continent[i][0], continent[i][1], W, H);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Stroke outline — brighter
    ctx.strokeStyle = `rgba(0, 212, 255, ${a(0.45).toFixed(3)})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (let i = 1; i < continent.length; i++) {
      const [x, y] = latLonToXY(continent[i][0], continent[i][1], W, H);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}
