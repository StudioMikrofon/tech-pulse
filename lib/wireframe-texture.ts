/**
 * Generates a wireframe globe texture (Jarvis blueprint style).
 * Returns a data URL for use as globeImageUrl.
 */
export function generateWireframeTexture(): string {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Dark background
  ctx.fillStyle = "#050710";
  ctx.fillRect(0, 0, W, H);

  // Grid lines every 15 degrees
  ctx.strokeStyle = "rgba(0, 212, 255, 0.25)";
  ctx.lineWidth = 1;

  // Longitude lines (vertical)
  for (let lon = 0; lon <= 360; lon += 15) {
    const x = (lon / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Latitude lines (horizontal)
  for (let lat = 0; lat <= 180; lat += 15) {
    const y = (lat / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Brighter equator and prime meridian
  ctx.strokeStyle = "rgba(0, 212, 255, 0.5)";
  ctx.lineWidth = 2;

  // Equator
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Prime meridian
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Subtle continent outlines hint — small scattered dots
  ctx.fillStyle = "rgba(0, 212, 255, 0.08)";
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillRect(x, y, 2, 2);
  }

  return canvas.toDataURL("image/png");
}
