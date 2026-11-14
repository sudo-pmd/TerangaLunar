/**
 * 3D Moon.
 *
 * Three.js comes from a CDN; without WebGL the module falls back to a flat,
 * clickable orthographic projection so the site still works.
 *
 * Body frame -> scene frame: (x, y, z)_body -> (x, z, y)_three, so the lunar
 * north pole is +Y and the south pole is -Y.
 *
 * The daylight is not a lamp. It is `dot(normal, subsolar direction)` inside the
 * fragment shader, which keeps the terminator exactly where the ephemeris says
 * it is whatever the albedo map looks like.
 */

import { siteGeometry } from './ephemeris.js';

const STATUS_COLORS = {
  landed: '#f6b23c',
  planned: '#eaf1fb',
  lost: '#71829a',
  reference: '#9fb0c6',
};

const MAP_IMAGE = 'assets/img/moon.jpg';          // 4096 x 2048
const MAP_PREVIEW = 'assets/img/low/moon.jpg';    // 2048 x 1024, first paint
const RELIEF_IMAGE = 'assets/img/ldem_3_8bit.jpg'; // LOLA global relief, 8 bit

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grey Moon used only while the photograph decodes. */
function moonCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(20260416);

  ctx.fillStyle = '#b6b3ab';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 18; i += 1) {
    const x = rand() * canvas.width;
    const y = 90 + rand() * 300;
    const r = 40 + rand() * 130;
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, 'rgba(96,95,92,0.65)');
    grad.addColorStop(0.65, 'rgba(104,103,99,0.35)');
    grad.addColorStop(1, 'rgba(110,109,105,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 700; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const r = 1.5 + rand() ** 3 * 22;
    const inner = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
    inner.addColorStop(0, 'rgba(140,138,132,0.55)');
    inner.addColorStop(0.75, 'rgba(120,118,112,0.35)');
    inner.addColorStop(1, 'rgba(168,166,158,0.15)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/**
 * A marker is a soft halo, a bright core and a thin ring. Drawn once per
 * colour on a 128 px canvas, then reused as a sprite so it always faces the
 * camera and never grows into a blob when you zoom out.
 */
const pinTextures = new Map();

function pinTexture(THREE, color) {
  if (pinTextures.has(color)) return pinTextures.get(color);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const halo = ctx.createRadialGradient(c, c, 2, c, c, c);
  halo.addColorStop(0, 'rgba(255,255,255,0.95)');
  halo.addColorStop(0.16, `${color}`);
  halo.addColorStop(0.42, `${color}55`);
  halo.addColorStop(1, `${color}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(6,10,18,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0a0f1a';
  ctx.beginPath();
  ctx.arc(c, c, 7.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c, c, 5.2, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  pinTextures.set(color, texture);
  return texture;
}

/** Crosshair marker for a free study point, distinct from a catalogue site. */
function probeTexture(THREE) {
  const key = '__probe';
  if (pinTextures.has(key)) return pinTextures.get(key);
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const halo = ctx.createRadialGradient(c, c, 4, c, c, c);
  halo.addColorStop(0, 'rgba(120,240,255,0.55)');
  halo.addColorStop(1, 'rgba(120,240,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(8,12,20,0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#a8f2ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 40, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(c, c - 54); ctx.lineTo(c, c - 22);
  ctx.moveTo(c, c + 22); ctx.lineTo(c, c + 54);
  ctx.moveTo(c - 54, c); ctx.lineTo(c - 22, c);
  ctx.moveTo(c + 22, c); ctx.lineTo(c + 54, c);
  ctx.stroke();

  ctx.fillStyle = '#eafcff';
  ctx.beginPath();
  ctx.arc(c, c, 5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  pinTextures.set(key, texture);
  return texture;
}

/** Selenographic degrees -> scene vector (body z-up becomes scene y-up). */
export function surfaceVector(latDeg, lonDeg, radius = 1) {
  const la = (latDeg * Math.PI) / 180;
  const lo = (lonDeg * Math.PI) / 180;
  return {
    x: Math.cos(la) * Math.cos(lo) * radius,
    y: Math.sin(la) * radius,
    z: Math.cos(la) * Math.sin(lo) * radius,
  };
}

/** Scene point -> selenographic coordinates (degrees, longitude 0..360). */
export function toLatLon(point) {
  const r = Math.hypot(point.x, point.y, point.z) || 1;
  const lat = (Math.asin(Math.max(-1, Math.min(1, point.y / r))) * 180) / Math.PI;
  let lon = (Math.atan2(point.z, point.x) * 180) / Math.PI;
  if (lon < 0) lon += 360;
  return { lat, lon };
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export async function mountMoon(container, options = {}) {
  try {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    return createScene(THREE, OrbitControls, container, options);
  } catch (error) {
    console.warn('[moon3d] 3D indisponible, repli 2D :', error?.message || error);
    return mountFallback(container, options);
  }
}

function createScene(THREE, OrbitControls, container, opts) {
  const {
    sites = [], onSelect, dateMs = Date.now(), reducedMotion = false,
    live = false, fit = false, view = 'globe', probe = null, onPick = null,
    autoRotate = true,
  } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    (container.clientWidth || 1) / (container.clientHeight || 1),
    0.05,
    60,
  );

  const group = new THREE.Group();
  scene.add(group);

  const albedo = new THREE.CanvasTexture(moonCanvas());
  albedo.colorSpace = THREE.SRGBColorSpace;

  const uniforms = {
    dayMap: { value: albedo },
    heightMap: { value: null },
    hasRelief: { value: 0 },
    sunDir: { value: new THREE.Vector3(-1, 0, 0) },
    nightFloor: { value: 0.055 },
    bump: { value: 1.6 },
    relief: { value: 0.014 },
    texel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform sampler2D heightMap;
      uniform float hasRelief;
      uniform float relief;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;
        vec3 p = position;

        // Real LOLA relief, exaggerated on purpose: the true amplitude is
        // +-5 km on a 1737 km radius (0.3 %), invisible at this scale.
        if (hasRelief > 0.5) {
          float h = texture2D(heightMap, vec2(1.0 - uv.x, uv.y)).r;
          p *= 1.0 + (h - 0.5) * relief * 2.0;
        }

        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D heightMap;
      uniform float hasRelief;
      uniform vec3 sunDir;
      uniform float nightFloor;
      uniform float bump;
      uniform vec2 texel;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        // SphereGeometry runs its u the other way round, so the equirectangular
        // maps are sampled mirrored; that is what keeps the maria under their
        // selenographic coordinates. ShaderMaterial ignores texture.repeat, so
        // the flip has to be written here.
        vec2 uv = vec2(1.0 - vUv.x, vUv.y);
        vec3 base = texture2D(dayMap, uv).rgb;

        vec3 n = normalize(vWorldNormal);
        if (hasRelief > 0.5) {
          // Terrain normal from the height field itself, in the body frame.
          // Screen-space derivatives (dFdx/dFdy) look tempting but blow up at
          // the poles, where an equirectangular map compresses longitude to a
          // point; the result was a field of black speckles. Two fixed texel
          // steps stay stable everywhere.
          float t = 1.0 / 1024.0;
          float hL = texture2D(heightMap, uv - vec2(t, 0.0)).r;
          float hR = texture2D(heightMap, uv + vec2(t, 0.0)).r;
          float hD = texture2D(heightMap, uv - vec2(0.0, t * 2.0)).r;
          float hU = texture2D(heightMap, uv + vec2(0.0, t * 2.0)).r;

          vec3 east = cross(vec3(0.0, 1.0, 0.0), n);
          if (length(east) > 0.001) {
            east = normalize(east);
            vec3 north = cross(n, east);
            // Texture +u runs west (the map is mirrored), +v runs north.
            vec2 slope = vec2(hL - hR, hU - hD);
            n = normalize(n - (east * slope.x + north * slope.y) * bump * 1.7);
          }
        }

        float d = dot(n, normalize(sunDir));
        float lit = smoothstep(-0.06, 0.095, d);
        vec3 night = base * nightFloor + vec3(0.006, 0.010, 0.020);
        vec3 day = base * (0.80 + 0.40 * max(d, 0.0));
        gl_FragColor = vec4(mix(night, day, lit), 1.0);
      }`,
  });

  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), material);
  group.add(moon);
  container.dataset.moonTexture = 'procedural';

  // --- textures ---------------------------------------------------------

  const loader = new THREE.TextureLoader();
  let previewDone = false;
  const ready = { hi: null, relief: null };
  let resolveReady = () => {};
  const readyPromise = new Promise((resolve) => { resolveReady = resolve; });
  let readyCount = 0;
  const settle = () => {
    readyCount += 1;
    if (readyCount >= 2) resolveReady();
  };
  // Never hold the loading screen hostage to a slow texture.
  setTimeout(() => resolveReady(), 9000);

  const applyMap = (texture, hiRes) => {
    if (!texture) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    uniforms.dayMap.value = texture;
    uniforms.texel.value.set(1 / texture.image.width, 1 / texture.image.height);
    container.dataset.moonTexture = hiRes ? 'photo-4k' : 'photo-2k';
    if (!hiRes) previewDone = true;
  };

  loader.load(MAP_PREVIEW, (texture) => applyMap(texture, false), undefined, () => {});
  loader.load(MAP_IMAGE, (texture) => {
    applyMap(texture, true);
    ready.hi = texture;
    settle();
  }, undefined, () => {
    // A missing 4K file is not fatal: the 2K preview is already on screen.
    settle();
    if (!previewDone) container.dataset.moonTexture = 'procedural';
  });

  loader.load(RELIEF_IMAGE, (texture) => {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    uniforms.heightMap.value = texture;
    uniforms.hasRelief.value = 1;
    ready.relief = texture;
    settle();
  }, undefined, () => settle());

  // --- markers ----------------------------------------------------------

  const markerGroup = new THREE.Group();
  group.add(markerGroup);
  const markers = [];
  const baseScale = (status) => (status === 'landed' ? 0.062 : status === 'reference' ? 0.04 : 0.05);

  for (const site of sites) {
    const p = surfaceVector(site.lat, site.lon, 1.006);
    const material2 = new THREE.SpriteMaterial({
      map: pinTexture(THREE, STATUS_COLORS[site.status] || STATUS_COLORS.planned),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 0.95,
    });
    const sprite = new THREE.Sprite(material2);
    sprite.position.set(p.x, p.y, p.z);
    const scale = baseScale(site.status);
    sprite.scale.setScalar(scale);
    sprite.userData.site = site;
    sprite.userData.baseScale = scale;
    markerGroup.add(sprite);
    markers.push(sprite);
  }

  const probeSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: probeTexture(THREE),
    transparent: true,
    depthWrite: false,
    opacity: 0.98,
  }));
  probeSprite.visible = false;
  probeSprite.scale.setScalar(0.085);
  markerGroup.add(probeSprite);

  const setProbe = (point) => {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
      probeSprite.visible = false;
      return;
    }
    const p = surfaceVector(point.lat, point.lon, 1.008);
    probeSprite.position.set(p.x, p.y, p.z);
    probeSprite.visible = true;
  };
  setProbe(probe);

  // --- camera, controls --------------------------------------------------

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  // Close enough to read the surface, far enough to keep the disc whole.
  controls.minDistance = 1.06;
  controls.maxDistance = 6.2;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI - 0.02;
  controls.zoomToCursor = true;
  controls.autoRotate = !reducedMotion && !live && !fit && autoRotate;
  controls.autoRotateSpeed = 0.28;

  const pole = { pos: new THREE.Vector3(0.01, -2.6, 0.02), target: new THREE.Vector3(0, 0, 0) };

  /** Distance at which the whole disc fits the container, margins included. */
  const fitDistance = () => {
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.2));
    return 1.07 / Math.sin(Math.min(vFov, hFov) / 2);
  };

  const frameGlobe = () => {
    const distance = fitDistance();
    // Slightly above the southern hemisphere: the polar sites are the subject,
    // a full top-down view would flatten them.
    camera.position.set(0.42, -0.58, 0.78).normalize().multiplyScalar(distance);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    container.dataset.cam = `${camera.position.toArray().map((v) => v.toFixed(2)).join(',')}|aspect${camera.aspect.toFixed(2)}|fit1`;
  };

  /** Camera straight under the south pole: the "seen from below" view. */
  const framePole = () => {
    const distance = Math.min(2.9, fitDistance() * 0.86);
    camera.position.set(0.02, -distance, 0.03);
    controls.target.set(0, 0, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    container.dataset.cam = `${camera.position.toArray().map((v) => v.toFixed(2)).join(',')}|south`;
  };

  camera.position.set(0.42, 0.75, 0.99).normalize().multiplyScalar(4.4);
  camera.up.set(0, 1, 0);
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);

  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });

  if (view === 'south') {
    framePole();
    controls.autoRotate = false;
    controls.rotateSpeed = 0.32;
    controls.minPolarAngle = Math.PI * 0.72;
    controls.maxPolarAngle = Math.PI - 0.02;
  } else if (fit) {
    frameGlobe();
    controls.autoRotate = false;
  }

  // --- lighting (shader driven) -----------------------------------------

  const sunDir = new THREE.Vector3();
  const tmp = siteGeometry(sites[0] || { lat: 0, lon: 0 }, dateMs).subSolarDir;
  const applyTime = (ms) => {
    const dir = siteGeometry(sites[0] || { lat: 0, lon: 0 }, ms).subSolarDir;
    // Body (x, y, z) -> scene (x, z, y).
    sunDir.set(dir.x, dir.z, dir.y).normalize();
    uniforms.sunDir.value.copy(sunDir);
    container.dataset.solar = `${sunDir.x.toFixed(4)},${sunDir.y.toFixed(4)},${sunDir.z.toFixed(4)}`;
  };
  applyTime(dateMs);

  // --- pointer -----------------------------------------------------------

  const tip = document.createElement('div');
  tip.className = 'scene-tip';
  tip.hidden = true;
  container.appendChild(tip);
  const hintEl = document.createElement('p');
  hintEl.className = 'scene-hint';
  hintEl.textContent = opts.hint || '';
  container.appendChild(hintEl);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  const globeHit = new THREE.Vector3();
  let hovered = null;
  let downAt = null;

  const toPointer = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerMove = (event) => {
    toPointer(event);
  };
  const onPointerLeave = () => {
    pointer.set(-10, -10);
  };
  const onPointerDown = (event) => {
    downAt = { x: event.clientX, y: event.clientY };
  };
  const onClick = (event) => {
    // A drag is not a click: rotating the globe must not drop a point.
    if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) return;
    if (hovered) {
      onSelect?.(hovered.userData.site.id);
      return;
    }
    if (!onPick) return;
    toPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(moon, false)[0];
    if (!hit) return;
    globeHit.copy(hit.point);
    onPick(toLatLon(globeHit));
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('click', onClick);

  // --- resize ------------------------------------------------------------

  const resize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    if (fit && !userMoved) frameGlobe();
    if (view === 'south' && !userMoved) framePole();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // --- loop --------------------------------------------------------------

  let raf = 0;
  let disposed = false;

  const tick = () => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    controls.update();

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(markers, false);
    const next = hits.length ? hits[0].object : null;
    if (next !== hovered) {
      if (hovered) hovered.userData.hover = false;
      hovered = next;
      renderer.domElement.style.cursor = hovered ? 'pointer' : (onPick ? 'crosshair' : 'grab');
      if (hovered) {
        const site = hovered.userData.site;
        const rect = container.getBoundingClientRect();
        tip.hidden = false;
        tip.innerHTML = `<strong>${site.mission}</strong><span>${site.name}</span>`
          + `<span class="mono">${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°</span>`;
        const x = Math.min(rect.width - 170, Math.max(8, ((pointer.x + 1) / 2) * rect.width + 14));
        const y = Math.max(40, ((1 - pointer.y) / 2) * rect.height - 12);
        tip.style.transform = `translate(${x}px, ${y}px)`;
      } else {
        tip.hidden = true;
      }
    }

    // Ease the hovered marker instead of snapping it.
    for (const marker of markers) {
      const target = marker === hovered ? marker.userData.baseScale * 1.75 : marker.userData.baseScale;
      const current = marker.scale.x;
      const nextScale = current + (target - current) * 0.25;
      marker.scale.setScalar(nextScale);
      marker.material.opacity = marker === hovered ? 1 : 0.95;
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return {
    ready: readyPromise,
    skipIntro() {},
    /** Move the clock: the terminator follows. */
    setTime(ms) { applyTime(ms); },
    setProbe,
    framePole,
    frameGlobe,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      albedo.dispose();
      for (const texture of [ready.hi, ready.relief]) texture?.dispose();
      material.dispose();
      moon.geometry.dispose();
      for (const marker of markers) marker.material.dispose();
      probeSprite.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      tip.remove();
      hintEl.remove();
    },
  };
}

/** No WebGL: an orthographic view from the south pole, still clickable. */
function mountFallback(container, { sites = [], onSelect, hint }) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 720;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const cx = 360;
  const cy = 360;
  const R = 300;

  const grad = ctx.createRadialGradient(cx - 90, cy - 110, 40, cx, cy, R);
  grad.addColorStop(0, '#d8d6cf');
  grad.addColorStop(0.6, '#b4b1a9');
  grad.addColorStop(1, '#6f6d68');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  const project = (lat, lon) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    return { x: cx + Math.cos(la) * Math.sin(lo) * R, y: cy + Math.cos(la) * Math.cos(lo) * R };
  };

  for (const site of sites) {
    const p = project(site.lat, site.lon);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = site.status === 'landed' ? '#f59e0b'
      : site.status === 'planned' ? '#e2e8f0' : '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,11,20,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const hintEl = document.createElement('p');
  hintEl.className = 'scene-hint';
  hintEl.textContent = hint || '';
  container.appendChild(hintEl);

  const onClick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    let best = null;
    let bestDist = 26;
    for (const site of sites) {
      const p = project(site.lat, site.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = site;
      }
    }
    if (best) onSelect?.(best.id);
  };
  canvas.addEventListener('click', onClick);

  return {
    ready: Promise.resolve(),
    skipIntro() {},
    setTime() {},
    setProbe() {},
    framePole() {},
    frameGlobe() {},
    dispose() {
      canvas.removeEventListener('click', onClick);
      canvas.remove();
      hintEl.remove();
    },
  };
}
