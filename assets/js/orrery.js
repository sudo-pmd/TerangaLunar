/**
 * Sun–Earth–Moon diagram, drawn to scale for the *sizes* only.
 *
 * True radii: Moon 1737.4 km, Earth 6371 km (3.67 Moon radii), Sun 696 000 km
 * (109 Earth radii, so ~400 Moon radii — it would fill any canvas). The Sun is
 * therefore drawn as a limb crossing the frame and distances are compressed;
 * both facts are written on the drawing itself.
 *
 * Dragging the Moon around the Earth changes the phase, which is the same
 * quantity that turns the terminator on the globe. One full turn is one synodic
 * month, so the gesture is the clock: no hidden state, no invented lighting.
 */

const SYNODIC_DAYS = 29.530588;

export function createOrrery(canvas, options = {}) {
  const { getMs, setMs, onChange } = options;
  const ctx = canvas.getContext('2d');
  const EARTH_RATIO = 6371 / 1737.4;

  let width = 0;
  let height = 0;
  let dpr = 1;
  // Sun direction projected on screen: body (x, z) -> canvas (x, -z).
  let sunScreen = { x: 1, y: 0 };
  let dragging = false;
  let lastAngle = null;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };

  /** Phase angle of the Moon around the Earth, 0 = between Earth and Sun. */
  const phaseAngle = () => {
    const days = (getMs() - Date.UTC(2026, 0, 6)) / 86400000;
    return ((days / SYNODIC_DAYS) * 360) % 360;
  };

  const geometry = () => {
    const earthR = Math.max(22, Math.min(34, height * 0.105));
    const moonR = earthR / EARTH_RATIO;
    const earthX = width * 0.62;
    const earthY = height * 0.52;
    const orbit = earthR * 4.1;
    return { earthR, moonR, earthX, earthY, orbit };
  };

  const moonPoint = () => {
    const g = geometry();
    const el = (phaseAngle() * Math.PI) / 180;
    // Ecliptic north up, Sun to the left: new moon sits between Earth and Sun.
    return {
      ...g,
      x: g.earthX - Math.cos(el) * g.orbit,
      y: g.earthY + Math.sin(el) * g.orbit,
      el,
    };
  };

  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);

    const g = moonPoint();
    const centerY = height * 0.52;

    // --- Sun limb ---------------------------------------------------------
    const sunR = height * 0.62;
    const sunX = -sunR * 0.62;
    const glow = ctx.createRadialGradient(sunX, centerY, sunR * 0.2, sunX, centerY, sunR);
    glow.addColorStop(0, 'rgba(255, 236, 189, 0.95)');
    glow.addColorStop(0.55, 'rgba(255, 214, 120, 0.35)');
    glow.addColorStop(1, 'rgba(255, 196, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, centerY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // --- Sun rays: parallel by design, the Sun is not to scale in distance --
    ctx.strokeStyle = 'rgba(255, 219, 150, 0.34)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i += 1) {
      const y = centerY + i * (g.earthR * 0.42);
      ctx.beginPath();
      ctx.moveTo(sunX + sunR * 0.55, y);
      ctx.lineTo(g.x - g.moonR - 3, y);
      ctx.stroke();
    }

    // --- Orbit of the Moon -------------------------------------------------
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(g.earthX, g.earthY, g.orbit, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Earth -------------------------------------------------------------
    const earthGrad = ctx.createRadialGradient(
      g.earthX - g.earthR * 0.4, g.earthY - g.earthR * 0.45, g.earthR * 0.2,
      g.earthX, g.earthY, g.earthR,
    );
    earthGrad.addColorStop(0, '#6fa8dc');
    earthGrad.addColorStop(0.6, '#2b6ca3');
    earthGrad.addColorStop(1, '#0b2c4a');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(g.earthX, g.earthY, g.earthR, 0, Math.PI * 2);
    ctx.fill();

    // Night side of the Earth: the same sun direction, projected top-down.
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.earthX, g.earthY, g.earthR, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 8, 16, 0.55)';
    ctx.fill();
    ctx.restore();

    // --- Moon, lit exactly like the globe -------------------------------
    const lit = Math.atan2(sunScreen.y, sunScreen.x); // screen angle of the Sun
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.moonR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#cfd6e2';
    ctx.fillRect(g.x - g.moonR, g.y - g.moonR, g.moonR * 2, g.moonR * 2);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.moonR, lit + Math.PI / 2, lit + (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 10, 18, 0.78)';
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(168, 242, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.moonR + 4, 0, Math.PI * 2);
    ctx.stroke();

    // --- Labels ------------------------------------------------------------
    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('SOLEIL', 12, 18);
    ctx.textAlign = 'center';
    ctx.fillText('TERRE', g.earthX, g.earthY + g.earthR + 16);
    ctx.fillText('LUNE', g.x, g.y - g.moonR - 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('rayons à l’échelle · distances compressées', 12, height - 12);

    onChange?.(phaseAngle());
  }

  const angleAt = (event) => {
    const rect = canvas.getBoundingClientRect();
    const g = geometry();
    const x = event.clientX - rect.left - g.earthX;
    const y = event.clientY - rect.top - g.earthY;
    return Math.atan2(y, -x); // 0 = between Earth and Sun
  };

  const onDown = (event) => {
    dragging = true;
    lastAngle = angleAt(event);
    canvas.setPointerCapture?.(event.pointerId);
  };

  const onMove = (event) => {
    if (!dragging) return;
    const next = angleAt(event);
    let delta = next - lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle = next;
    // One full turn around the Earth is one synodic month of terminator.
    setMs?.(getMs() - (delta / (Math.PI * 2)) * SYNODIC_DAYS * 86400000);
  };

  const onUp = () => { dragging = false; };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    /** Give the diagram the same subsolar vector as the globe (body frame). */
    setSun(dir) {
      if (dir) sunScreen = { x: dir.x, y: -dir.z };
      draw();
    },
    draw,
    destroy() {
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
