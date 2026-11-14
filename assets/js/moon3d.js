/**
 * 3D Moon hero. Three.js is loaded from a CDN; if it (or WebGL) is missing the
 * module falls back to a flat, still-clickable orthographic projection so the
 * landing page always works.
 *
 * Body frame -> scene frame: (x, y, z)_body -> (x, z, y)_three, so the lunar
 * north pole is +Y in the scene.
 */

import { siteGeometry } from './ephemeris.js';

const PIN_COLORS = {
  landed: 0xf59e0b,
  planned: 0xe2e8f0,
  lost: 0x64748b,
  reference: 0x94a3b8,
};

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

function moonCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(20260416);

  ctx.fillStyle = '#b6b3ab';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Maria: broad dark basalt plains.
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

  // Craters with a bright rim.
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
    ctx.strokeStyle = 'rgba(226,224,216,0.22)';
    ctx.lineWidth = Math.max(0.5, r * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }

  // A few bright ray craters (Tycho-like).
  for (let i = 0; i < 7; i += 1) {
    const x = rand() * canvas.width;
    const y = 120 + rand() * 300;
    const r = 3 + rand() * 6;
    const rays = ctx.createRadialGradient(x, y, r, x, y, r * 9);
    rays.addColorStop(0, 'rgba(236,234,226,0.5)');
    rays.addColorStop(1, 'rgba(236,234,226,0)');
    ctx.fillStyle = rays;
    ctx.beginPath();
    ctx.arc(x, y, r * 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(244,242,234,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine speckle.
  for (let i = 0; i < 4000; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, 1.6, 1.6);
  }

  return canvas;
}

function earthCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(7719);

  const ocean = ctx.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, '#0f2f5c');
  ocean.addColorStop(0.5, '#1b4f8a');
  ocean.addColorStop(1, '#0f2f5c');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, 1024, 512);

  const landColors = ['#3d5e34', '#56703c', '#8a7a52', '#6b6a45'];
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * 1024;
    const y = 90 + rand() * 330;
    const r = 30 + rand() * 90;
    ctx.fillStyle = landColors[Math.floor(rand() * landColors.length)];
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let k = 0; k < 9; k += 1) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.5 + rand() * 0.8);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * 0.65;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Polar ice.
  ctx.fillStyle = 'rgba(240,246,252,0.9)';
  ctx.fillRect(0, 0, 1024, 26);
  ctx.fillRect(0, 486, 1024, 26);

  // Clouds.
  for (let i = 0; i < 60; i += 1) {
    const x = rand() * 1024;
    const y = rand() * 512;
    const r = 14 + rand() * 46;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function surfaceVector(site, radius) {
  const la = (site.lat * Math.PI) / 180;
  const lo = (site.lon * Math.PI) / 180;
  return {
    x: Math.cos(la) * Math.cos(lo) * radius,
    y: Math.sin(la) * radius,
    z: Math.cos(la) * Math.sin(lo) * radius,
  };
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export async function mountMoon(container, options) {
  const { sites, onSelect, dateMs, reducedMotion, hint, skipLabel, fit, live } = options;
  try {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    return createScene(THREE, OrbitControls, container, {
      sites, onSelect, dateMs, reducedMotion, hint, skipLabel, fit, live,
    });
  } catch (error) {
    console.warn('[moon3d] 3D indisponible, repli 2D :', error?.message || error);
    return mountFallback(container, { sites, onSelect, hint });
  }
}

function createScene(THREE, OrbitControls, container, opts) {
  const { sites, onSelect, dateMs, reducedMotion, live = false, fit = false } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 120);

  // Start from the procedural relief so the globe appears immediately, then
  // swap in the real photographic lunar map once it is decoded.
  const texture = new THREE.CanvasTexture(moonCanvas());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const group = new THREE.Group();
  scene.add(group);

  // Day/night is computed in the shader from the real subsolar direction, so the
  // terminator is always visible and always where the geometry says it is — a
  // directional light alone washes out on a bright albedo map.
  const uniforms = {
    dayMap: { value: texture },
    sunDir: { value: new THREE.Vector3(1, 0, 0) },
    nightFloor: { value: 0.09 },
  };

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1, 160, 120),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        void main() {
          vUv = uv;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D dayMap;
        uniform vec3 sunDir;
        uniform float nightFloor;
        varying vec2 vUv;
        varying vec3 vNormalView;
        void main() {
          vec3 base = texture2D(dayMap, vUv).rgb;
          vec3 sunView = normalize((viewMatrix * vec4(sunDir, 0.0)).xyz);
          float d = dot(normalize(vNormalView), sunView);
          // Soft, physically placed terminator.
          float lit = smoothstep(-0.055, 0.085, d);
          vec3 night = base * nightFloor + vec3(0.004, 0.007, 0.016);
          vec3 day = base * (0.82 + 0.35 * max(d, 0.0));
          gl_FragColor = vec4(mix(night, day, lit), 1.0);
        }`,
    }),
  );
  group.add(moon);
  container.dataset.moonTexture = 'procedural';

  // Real lunar albedo map (NASA-derived, 1024x512 equirectangular). Mirrored in
  // u because the sphere runs the other way round, so the maria stay under the
  // selenographic coordinates of the markers.
  new THREE.TextureLoader().load(
    'assets/img/moon.jpg',
    (photo) => {
      photo.colorSpace = THREE.SRGBColorSpace;
      photo.anisotropy = renderer.capabilities.getMaxAnisotropy();
      photo.wrapS = THREE.RepeatWrapping;
      photo.repeat.x = -1;
      photo.offset.x = 1;
      uniforms.dayMap.value = photo;
      container.dataset.moonTexture = 'photo';
      texture.dispose();
    },
    undefined,
    () => { /* keep the procedural relief */ },
  );

  const earthTex = new THREE.CanvasTexture(earthCanvas());
  earthTex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 48, 32),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.85, metalness: 0 }),
  );
  earth.position.set(-3.3, 0.75, -2.2);
  scene.add(earth);

  const sunDir = siteGeometry(sites[0], dateMs).subSolarDir;
  const light = new THREE.DirectionalLight(0xfff4e0, 2.6);
  light.position.set(sunDir.x * 8, sunDir.z * 8, sunDir.y * 8);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x8899bb, 0.14));

  // The terminator is drawn as a thin ring whose normal is the subsolar
  // direction: day and night are separated by a line that moves with the clock.
  const terminator = new THREE.Mesh(
    new THREE.RingGeometry(1.003, 1.007, 160),
    new THREE.MeshBasicMaterial({
      color: 0x9fb3d1,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  group.add(terminator);
  const ringNormal = new THREE.Vector3(0, 0, 1);
  const sunVector = new THREE.Vector3();
  const ringQuat = new THREE.Quaternion();

  // Live mode: the terminator follows the real subsolar point, so the day/night
  // boundary on the globe advances with the clock instead of being frozen.
  let simMs = dateMs;
  const applyTime = (ms) => {
    const dir = siteGeometry(sites[0], ms).subSolarDir;
    light.position.set(dir.x * 8, dir.z * 8, dir.y * 8);
    sunVector.set(dir.x, dir.z, dir.y).normalize();
    uniforms.sunDir.value.copy(sunVector);
    ringQuat.setFromUnitVectors(ringNormal, sunVector);
    terminator.quaternion.copy(ringQuat);
    // Observable trace of the lighting input, used by the self-check.
    container.dataset.solar = `${sunVector.x.toFixed(4)},${sunVector.y.toFixed(4)},${sunVector.z.toFixed(4)}`;
  };
  applyTime(dateMs);

  // Subtle south-polar cap.
  const cap = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.3, 64),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  cap.position.set(0, -0.985, 0);
  cap.rotation.x = -Math.PI / 2;
  group.add(cap);

  const pins = [];
  const pinGeo = new THREE.SphereGeometry(0.018, 14, 12);
  for (const site of sites) {
    const p = surfaceVector(site, 1.012);
    const mesh = new THREE.Mesh(
      pinGeo,
      new THREE.MeshBasicMaterial({ color: PIN_COLORS[site.status] ?? 0xe2e8f0 }),
    );
    mesh.position.set(p.x, p.y, p.z);
    mesh.userData.site = site;
    group.add(mesh);
    pins.push(mesh);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.45;
  controls.maxDistance = 5.2;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI - 0.15;
  controls.autoRotate = !reducedMotion && !live;
  controls.autoRotateSpeed = 0.32;

  const wide = { pos: new THREE.Vector3(0.6, 1.5, 4.6), target: new THREE.Vector3(0, 0, 0) };
  const pole = { pos: new THREE.Vector3(0.85, -1.15, 1.75), target: new THREE.Vector3(0, -0.92, 0) };

  camera.position.copy(wide.pos);
  controls.target.copy(wide.target);
  camera.lookAt(wide.target);

  let intro = !reducedMotion && !live;
  let introStart = performance.now();
  const introMs = 2600;
  controls.enabled = !intro;

  // Hero framing: whole globe, centred, south pole towards the viewer. The
  // distance is derived from whichever field of view is narrower, with a margin,
  // so a tall phone screen does not crop the disc either.
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });

  const frameGlobe = () => {
    if (!fit) return;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.2));
    const half = Math.min(vFov, hFov) / 2;
    const distance = 1.24 / Math.sin(half);
    sunVector.set(0.193, -0.482, 0.854).normalize();
    camera.position.copy(sunVector).multiplyScalar(distance);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    container.dataset.cam = `${camera.position.toArray().map((v) => v.toFixed(2)).join(',')}|aspect${camera.aspect.toFixed(2)}|fit1`;
  };

  if (fit) {
    intro = false;
    controls.enabled = true;
    controls.autoRotate = false;
    frameGlobe();
  }

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
  let hovered = null;

  const onPointerMove = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    if (intro) finishIntro();
  };
  const onPointerLeave = () => {
    pointer.set(-10, -10);
  };
  const onClick = () => {
    if (hovered) onSelect(hovered.userData.site.id);
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onClick);

  function finishIntro() {
    intro = false;
    controls.enabled = true;
    camera.position.copy(pole.pos);
    controls.target.copy(pole.target);
    controls.update();
    container.dataset.cam = `${camera.position.toArray().map((v) => v.toFixed(2)).join(',')}|intro0`;
  }

  const resize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    if (fit && !userMoved) frameGlobe();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  let raf = 0;
  let disposed = false;

  const tick = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);

    if (intro) {
      const p = Math.min(1, (now - introStart) / introMs);
      const e = easeInOutCubic(p);
      camera.position.lerpVectors(wide.pos, pole.pos, e);
      controls.target.lerpVectors(wide.target, pole.target, e);
      camera.lookAt(controls.target);
      if (p >= 1) {
        intro = false;
        controls.enabled = true;
      }
    } else {
      controls.update();
    }

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pins, false);
    const next = hits.length ? hits[0].object : null;
    if (next !== hovered) {
      if (hovered) hovered.scale.setScalar(1);
      hovered = next;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
      if (hovered) {
        hovered.scale.setScalar(1.9);
        const rect = container.getBoundingClientRect();
        tip.hidden = false;
        tip.innerHTML = `<strong>${hovered.userData.site.mission}</strong><span>${hovered.userData.site.name}</span><span class="mono">${hovered.userData.site.lat.toFixed(2)}°, ${hovered.userData.site.lon.toFixed(2)}°</span>`;
        tip.style.transform = `translate(${((pointer.x + 1) / 2) * rect.width + 14}px, ${((1 - pointer.y) / 2) * rect.height - 12}px)`;
      } else {
        tip.hidden = true;
      }
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return {
    skipIntro: finishIntro,
    /** Move the clock: the light (and so the terminator) follows. */
    setTime(ms) {
      simMs = ms;
      if (live) applyTime(ms);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      texture.dispose();
      earthTex.dispose();
      terminator.geometry.dispose();
      terminator.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      tip.remove();
      hintEl.remove();
    },
  };
}

function mountFallback(container, { sites, onSelect, hint }) {
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

  // Orthographic projection centred on the south pole.
  const project = (lat, lon) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    const x = Math.cos(la) * Math.sin(lo);
    const y = Math.cos(la) * Math.cos(lo);
    const visible = Math.sin(la) < 0 || y > 0;
    return { x: cx + x * R, y: cy + y * R, visible };
  };

  for (const site of sites) {
    const p = project(site.lat, site.lon);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = site.status === 'landed' ? '#f59e0b' : site.status === 'planned' ? '#e2e8f0' : '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,11,20,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0b1020';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(site.name.slice(0, 18), p.x + 16, p.y + 6);
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
    if (best) onSelect(best.id);
  };
  canvas.addEventListener('click', onClick);

  return {
    skipIntro() {},
    dispose() {
      canvas.removeEventListener('click', onClick);
      canvas.remove();
      hintEl.remove();
    },
  };
}
