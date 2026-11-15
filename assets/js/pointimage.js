/**
 * The studied point, drawn as a disc.
 *
 * The 3D scene is a WebGL context that a printed page cannot keep, so the study
 * sheet renders its own orthographic view of the Moon: the equirectangular
 * albedo map is resampled once into the disc you would see from Earth, centred
 * on the point. Nothing is faked — it is the same texture the globe uses,
 * reprojected with the inverse of the orthographic projection.
 */

const SOURCE = 'assets/img/moon.jpg';

let sourcePromise = null;

function loadSource() {
  if (!sourcePromise) {
    sourcePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('moon texture unavailable'));
      img.src = SOURCE;
    }).catch(() => null);
  }
  return sourcePromise;
}

const RAD = Math.PI / 180;

/**
 * Draw the disc on a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{lat:number, lon:number, size?:number, label?:string}} options
 */
export async function drawPointDisc(canvas, { lat, lon, size = 520, label = '' } = {}) {
  if (!canvas) return;
  const px = Math.max(160, Math.round(size));
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx = px / 2;
  const cy = px / 2;
  const radius = px / 2 - 2;

  ctx.clearRect(0, 0, px, px);

  const img = await loadSource();

  if (!img) {
    // No texture: a neutral disc, so the sheet still shows where the point is.
    ctx.fillStyle = '#b9b6ae';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    // Sample the source on an offscreen canvas: getImageData is one call
    // instead of thousands of drawImage calls.
    const buf = document.createElement('canvas');
    buf.width = sw;
    buf.height = sh;
    const bctx = buf.getContext('2d', { willReadFrequently: true });
    bctx.drawImage(img, 0, 0);
    let src = null;
    try {
      src = bctx.getImageData(0, 0, sw, sh).data;
    } catch {
      src = null;
    }

    const out = ctx.createImageData(px, px);
    const data = out.data;

    // Basis of the view: the point is the centre of the disc, north is up,
    // east is right — the way the Moon looks from Earth.
    const la0 = lat * RAD;
    const lo0 = lon * RAD;
    const nx = Math.cos(la0) * Math.cos(lo0);
    const ny = Math.cos(la0) * Math.sin(lo0);
    const nz = Math.sin(la0);
    // east = normalize(cross(z, n))
    let ex = -ny;
    let ey = nx;
    let ez = 0;
    const el = Math.hypot(ex, ey) || 1;
    ex /= el; ey /= el; ez /= el;
    // north = cross(n, east)
    const ux = ny * ez - nz * ey;
    const uy = nz * ex - nx * ez;
    const uz = nx * ey - ny * ex;

    for (let y = 0; y < px; y += 1) {
      const sy = -(y + 0.5 - cy) / radius; // -1 bottom .. +1 top
      for (let x = 0; x < px; x += 1) {
        const sx = (x + 0.5 - cx) / radius;
        const rr = sx * sx + sy * sy;
        const i = (y * px + x) * 4;
        if (rr > 1) {
          data[i + 3] = 0;
          continue;
        }
        const vz = Math.sqrt(1 - rr);
        const wx2 = sx * ex + sy * ux + vz * nx;
        const wy2 = sx * ey + sy * uy + vz * ny;
        const wz2 = sx * ez + sy * uz + vz * nz;

        const dLat = Math.asin(Math.max(-1, Math.min(1, wz2))) / RAD;
        const dLon = Math.atan2(wy2, wx2) / RAD;
        let u = (dLon + 180) / 360;
        let v = (90 - dLat) / 180;
        u = ((u % 1) + 1) % 1;
        v = Math.max(0, Math.min(1, v));

        let r;
        let g;
        let b;
        if (src) {
          const tx = Math.min(sw - 1, Math.floor(u * sw));
          const ty = Math.min(sh - 1, Math.floor(v * sh));
          const ti = (ty * sw + tx) * 4;
          r = src[ti]; g = src[ti + 1]; b = src[ti + 2];
        } else {
          r = 176; g = 173; b = 165;
        }

        // A touch of limb darkening so the disc reads as a sphere.
        const shade = 0.72 + 0.28 * vz;
        data[i] = r * shade;
        data[i + 1] = g * shade;
        data[i + 2] = b * shade;
        // Antialias the rim over one pixel.
        const edge = Math.min(1, (1 - Math.sqrt(rr)) * radius);
        data[i + 3] = Math.round(255 * Math.min(1, edge));
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  // Limb, marker, coordinates.
  ctx.strokeStyle = 'rgba(246, 178, 60, 0.55)';
  ctx.lineWidth = Math.max(1, px / 260);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const mark = px * 0.055;
  ctx.strokeStyle = '#f6b23c';
  ctx.fillStyle = '#f6b23c';
  ctx.lineWidth = Math.max(1.6, px / 200);
  ctx.beginPath();
  ctx.arc(cx, cy, mark * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.4, px / 190), 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * mark * 0.75, cy + dy * mark * 0.75);
    ctx.lineTo(cx + dx * mark * 1.6, cy + dy * mark * 1.6);
    ctx.stroke();
  }

  if (label) {
    ctx.font = `${Math.round(px / 30)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
    const w = ctx.measureText(label).width + px * 0.05;
    ctx.fillRect(cx - w / 2, cy + mark * 2.1, w, px / 22);
    ctx.fillStyle = '#ffe1a3';
    ctx.fillText(label, cx, cy + mark * 2.1 + px / 31);
  }
}
