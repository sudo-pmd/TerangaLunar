/**
 * Starfield backdrop.
 *
 * One fixed canvas behind the whole document, so every page shares the same
 * sky. Stars are drawn once into an offscreen buffer and the buffer is simply
 * re-blitted; only a handful of bright stars twinkle, which keeps the cost of a
 * full-screen animation negligible. It degrades to a static field with reduced
 * motion, pauses in a hidden tab, and is skipped entirely if 2D canvas is
 * unavailable.
 */

const DENSITY = 1 / 5200; // stars per CSS pixel

export function mountStarfield(target = document.body) {
  if (typeof document === 'undefined') return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'starfield';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return () => {};

  target.insertBefore(canvas, target.firstChild);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let width = 0;
  let height = 0;
  let dpr = 1;
  let buffer = null;
  let stars = [];
  let raf = 0;
  let running = true;
  let start = 0;

  const build = () => {
    width = window.innerWidth;
    height = Math.max(window.innerHeight, 600);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const count = Math.round(width * height * DENSITY);
    // Deterministic field: the same sky on every reload.
    let seed = 0x5eed1a;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    stars = Array.from({ length: count }, () => {
      const roll = rand();
      const band = Math.pow(rand(), 1.7); // more faint stars than bright ones
      return {
        x: rand() * width,
        y: band * height,
        r: 0.35 + roll * 1.25,
        a: 0.18 + rand() * 0.62,
        warm: rand() > 0.82,
        bright: roll > 0.965,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 0.9,
      };
    });

    buffer = document.createElement('canvas');
    buffer.width = canvas.width;
    buffer.height = canvas.height;
    const bctx = buffer.getContext('2d');
    bctx.scale(dpr, dpr);
    for (const star of stars) {
      if (star.bright) continue; // twinkling stars are drawn live
      bctx.beginPath();
      bctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      bctx.fillStyle = star.warm
        ? `rgba(246, 232, 200, ${star.a})`
        : `rgba(226, 236, 255, ${star.a})`;
      bctx.fill();
    }
    draw(performance.now());
  };

  const draw = (now) => {
    if (!buffer) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buffer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t = reduced.matches ? 0 : (now - start) / 1000;
    for (const star of stars) {
      if (!star.bright) continue;
      const pulse = 0.55 + 0.45 * Math.sin(t * star.speed + star.phase);
      const alpha = star.a * pulse;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = star.warm
        ? `rgba(250, 238, 210, ${alpha})`
        : `rgba(232, 240, 255, ${alpha})`;
      ctx.fill();
      if (star.r > 1.1) {
        ctx.globalAlpha = alpha * 0.35;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.7;
        const len = star.r * 3.4;
        ctx.beginPath();
        ctx.moveTo(star.x - len, star.y);
        ctx.lineTo(star.x + len, star.y);
        ctx.moveTo(star.x, star.y - len);
        ctx.lineTo(star.x, star.y + len);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  };

  const tick = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    draw(now);
  };

  const startLoop = () => {
    if (raf || reduced.matches) return;
    start = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const stopLoop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onResize = () => {
    build();
    draw(performance.now());
  };
  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };
  const onMotionChange = () => {
    if (reduced.matches) {
      stopLoop();
      draw(performance.now());
    } else {
      startLoop();
    }
  };

  build();
  startLoop();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onMotionChange);

  return () => {
    running = false;
    stopLoop();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onMotionChange);
    canvas.remove();
  };
}
