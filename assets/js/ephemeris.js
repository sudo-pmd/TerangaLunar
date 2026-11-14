/**
 * Analytical lunar/terrestrial ephemeris, good to roughly 0.1 deg.
 *
 * Moon: Meeus "Astronomical Algorithms" ch. 47 periodic terms (mean equinox of
 * date). Sun: ch. 25 low-precision series.
 *
 * Lunar body frame (mean Earth / polar axis, the SPICE MOON_ME convention):
 *  - the pole is the Cassini-state equator pole, tilted 1.5424 deg to the
 *    ecliptic and opposite to the 5.145 deg tilt of the orbit;
 *  - the prime meridian faces the MEAN Earth direction, so optical libration
 *    in longitude and latitude comes out of the difference between the true and
 *    the mean Moon, which is exactly what a synchronous rotator does.
 *
 * The pipeline documented in the README uses SPICE kernels; this module is the
 * built-in zero-backend fallback and states its limits in the interface.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export const AU_KM = 149597870.7;
export const MOON_RADIUS_KM = 1737.4;

const ECLIPTIC_TILT = 23.4392911;
const EQUATOR_TILT = 1.5424;
const ORBIT_TILT = 5.145;

/** Periodic terms for lunar longitude: [D, M, M', F, coefficient 1e-6 deg]. */
const MOON_LON = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399],
  [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323],
  [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

/** Periodic terms for lunar latitude: [D, M, M', F, coefficient 1e-6 deg]. */
const MOON_LAT = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794], [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107], [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777], [4, 0, -2, 1, 671], [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366], [2, 1, 0, 1, -351], [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315], [2, -2, 0, -1, 302], [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181], [0, 1, 2, 1, -177], [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166], [1, 0, 1, -1, -164], [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107],
];

/** Periodic terms for lunar distance: [D, M, M', F, coefficient 1e-3 km]. */
const MOON_DIST = [
  [0, 0, 1, 0, -20905355], [2, 0, -1, 0, -3699111], [2, 0, 0, 0, -2955968],
  [0, 0, 2, 0, -569925], [0, 1, 0, 0, 48888], [0, 0, 0, 2, -3149],
  [2, 0, -2, 0, 246158], [2, -1, -1, 0, -152138], [2, 0, 1, 0, -170733],
  [2, -1, 0, 0, -204586], [0, 1, -1, 0, -129620], [1, 0, 0, 0, 108743],
  [0, 1, 1, 0, 104755], [2, 0, 0, -2, 10321], [4, 0, -1, 0, 79661],
  [0, 0, 3, 0, -34782], [4, 0, -2, 0, -23210], [2, 1, -1, 0, -21636],
  [2, 1, 0, 0, 24208], [1, 0, -1, 0, 30824], [1, 1, 0, 0, -8379],
  [2, -1, 1, 0, -16675], [2, 0, 2, 0, -12831], [4, 0, 0, 0, -10445],
  [2, 0, -3, 0, -11650], [0, 1, -2, 0, 14403], [2, 0, -1, 2, -7003],
];

export function toJD(ms) {
  return ms / 86400000 + 2440587.5;
}

export function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

export function norm180(deg) {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

function obliquity() {
  return ECLIPTIC_TILT;
}

/** Apparent geocentric ecliptic longitude of the Sun, plus distance in km. */
export function sunEcliptic(jd) {
  const t = (jd - 2451545.0) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const mr = m * RAD;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mr) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mr) +
    0.000289 * Math.sin(3 * mr);
  const trueLong = l0 + c;
  const v = m + c;
  const r = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v * RAD));
  const omega = 125.04 - 1934.136 * t;
  const lon = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  return { lon: norm360(lon), dist: r * AU_KM };
}

function lunarArguments(jd) {
  const t = (jd - 2451545.0) / 36525;
  return {
    t,
    lp: 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t,
    d: 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t,
    m: 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t,
    mp: 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t,
    f: 93.272095 + 483202.0175233 * t - 0.0036539 * t * t,
  };
}

/** Geocentric ecliptic position of the Moon (mean equinox of date). */
export function moonEcliptic(jd) {
  const { t, lp, d, m, mp, f } = lunarArguments(jd);
  const dR = d * RAD;
  const mR = m * RAD;
  const mpR = mp * RAD;
  const fR = f * RAD;
  const ecc = 1 - 0.002516 * t - 0.0000074 * t * t;

  let sumL = 0;
  let sumB = 0;
  let sumR = 0;
  for (const [cd, cm, cmp, cf, coef] of MOON_LON) {
    let term = coef * Math.sin(cd * dR + cm * mR + cmp * mpR + cf * fR);
    if (cm === 1 || cm === -1) term *= ecc;
    else if (cm === 2 || cm === -2) term *= ecc * ecc;
    sumL += term;
  }
  for (const [cd, cm, cmp, cf, coef] of MOON_LAT) {
    let term = coef * Math.sin(cd * dR + cm * mR + cmp * mpR + cf * fR);
    if (cm === 1 || cm === -1) term *= ecc;
    else if (cm === 2 || cm === -2) term *= ecc * ecc;
    sumB += term;
  }
  for (const [cd, cm, cmp, cf, coef] of MOON_DIST) {
    let term = coef * Math.cos(cd * dR + cm * mR + cmp * mpR + cf * fR);
    if (cm === 1 || cm === -1) term *= ecc;
    else if (cm === 2 || cm === -2) term *= ecc * ecc;
    sumR += term;
  }

  return {
    lon: norm360(lp + sumL / 1e6),
    lat: sumB / 1e6,
    dist: 385000.56 + sumR / 1000,
    meanLon: norm360(lp),
  };
}

/** Ecliptic (deg, deg, km) to equatorial vector of date. */
export function eclToEq(lon, lat, dist) {
  const eps = obliquity() * RAD;
  const l = lon * RAD;
  const b = lat * RAD;
  return {
    x: dist * Math.cos(b) * Math.cos(l),
    y: dist * (Math.cos(b) * Math.sin(l) * Math.cos(eps) - Math.sin(b) * Math.sin(eps)),
    z: dist * (Math.cos(b) * Math.sin(l) * Math.sin(eps) + Math.sin(b) * Math.cos(eps)),
  };
}

/** Geocentric position of the Moon in equatorial coordinates of date (km). */
export function moonEq(jd) {
  const m = moonEcliptic(jd);
  return eclToEq(m.lon, m.lat, m.dist);
}

export function sunEq(jd) {
  const s = sunEcliptic(jd);
  return eclToEq(s.lon, 0, s.dist);
}

/** Geocentric direction of the MEAN Moon: the prime meridian reference. */
function meanEarthEq(jd) {
  const { lp } = lunarArguments(jd);
  // Direction from the Moon toward the mean Earth is the anti-solar-style
  // point 180 deg from the geocentric mean Moon longitude.
  return eclToEq(lp + 180, 0, 1);
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v) {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/** Cassini-state lunar equator pole (equatorial of date). */
function lunarPole(jd) {
  const d = jd - 2451545.0;
  const node = 125.0445 - 0.0529539 * d; // mean ascending node of the orbit
  const orbitPole = eclToEq(node - 90, 90 - ORBIT_TILT, 1);
  const eclipticPole = { x: 0, y: -Math.sin(obliquity() * RAD), z: Math.cos(obliquity() * RAD) };
  const u = normalize(sub(orbitPole, {
    x: eclipticPole.x * dot(orbitPole, eclipticPole),
    y: eclipticPole.y * dot(orbitPole, eclipticPole),
    z: eclipticPole.z * dot(orbitPole, eclipticPole),
  }));
  const c = Math.cos(EQUATOR_TILT * RAD);
  const s = Math.sin(EQUATOR_TILT * RAD);
  return normalize({
    x: c * eclipticPole.x - s * u.x,
    y: c * eclipticPole.y - s * u.y,
    z: c * eclipticPole.z - s * u.z,
  });
}

/** Body basis: z = pole, x = mean Earth meridian, y = z x x. */
function bodyBasis(jd) {
  const pole = lunarPole(jd);
  const dir = meanEarthEq(jd);
  const proj = dot(dir, pole);
  const x = normalize(sub(dir, { x: pole.x * proj, y: pole.y * proj, z: pole.z * proj }));
  const y = cross(pole, x);
  return { x, y, z: pole };
}

function toBody(basis, v) {
  return { x: dot(v, basis.x), y: dot(v, basis.y), z: dot(v, basis.z) };
}

/** Local east/north/up basis at a selenographic site. */
function localBasis(lat, lon) {
  const la = lat * RAD;
  const lo = lon * RAD;
  const sla = Math.sin(la);
  const cla = Math.cos(la);
  const slo = Math.sin(lo);
  const clo = Math.cos(lo);
  return {
    up: { x: cla * clo, y: cla * slo, z: sla },
    east: { x: -slo, y: clo, z: 0 },
    north: { x: -sla * clo, y: -sla * slo, z: cla },
  };
}

function toAltAz(vec, basis) {
  const norm = Math.hypot(vec.x, vec.y, vec.z) || 1;
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(vec, basis.up) / norm))) * DEG;
  const az = norm360(Math.atan2(dot(vec, basis.east), dot(vec, basis.north)) * DEG);
  return { alt, az };
}

/**
 * Sun and Earth as seen from a lunar site, plus the sub-solar and sub-Earth
 * points that drive the 3D globe lighting and the mission pins.
 */
export function siteGeometry(site, ms) {
  const jd = toJD(ms);
  const basis = bodyBasis(jd);
  const moonGeo = moonEq(jd);
  const moon = toBody(basis, moonGeo);
  const sunRel = toBody(basis, sub(sunEq(jd), moonGeo));

  const siteUnit = {
    x: Math.cos(site.lat * RAD) * Math.cos(site.lon * RAD),
    y: Math.cos(site.lat * RAD) * Math.sin(site.lon * RAD),
    z: Math.sin(site.lat * RAD),
  };
  const r = MOON_RADIUS_KM;
  const siteVec = { x: siteUnit.x * r, y: siteUnit.y * r, z: siteUnit.z * r };

  const earthTopo = { x: -moon.x - siteVec.x, y: -moon.y - siteVec.y, z: -moon.z - siteVec.z };
  const sunTopo = { x: sunRel.x - siteVec.x, y: sunRel.y - siteVec.y, z: sunRel.z - siteVec.z };

  const local = localBasis(site.lat, site.lon);
  const sunAltAz = toAltAz(sunTopo, local);
  const earthAltAz = toAltAz(earthTopo, local);

  const sunUnit = normalize(sunRel);

  return {
    sun: { alt: sunAltAz.alt, az: sunAltAz.az, dist: Math.hypot(sunRel.x, sunRel.y, sunRel.z) },
    earth: { alt: earthAltAz.alt, az: earthAltAz.az, dist: Math.hypot(earthTopo.x, earthTopo.y, earthTopo.z) },
    subSolar: {
      lat: Math.asin(Math.max(-1, Math.min(1, sunUnit.z))) * DEG,
      lon: norm360(Math.atan2(sunUnit.y, sunUnit.x) * DEG),
    },
    subEarth: {
      lat: Math.asin(Math.max(-1, Math.min(1, -moon.z / Math.hypot(moon.x, moon.y, moon.z)))) * DEG,
      lon: norm360(Math.atan2(-moon.y, -moon.x) * DEG),
    },
    subSolarDir: sunUnit,
  };
}

export { RAD, DEG };
