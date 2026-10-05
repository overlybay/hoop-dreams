import * as THREE from 'three';

/* ============ HOOP DREAMS v2 — up to 5v5 streetball, first to 21 ============ */

// ---------- constants ----------
const COURT_W = 15, COURT_L = 14;            // x: -7.5..7.5, z: -7..7
const HX = 0, HZ = -6.0, RIM_Y = 3.05;       // hoop center
const THREE_PT = 6.75, TARGET = 21, MAXP = 10;
const SPEED = 6.0, SPRINT_MULT = 1.45, GRAV = 22;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TEAM_COLORS = [0xd23b3b, 0x2f7bff];    // 0 = HOME (red), 1 = AWAY (blue)
const TEAM_NAMES = ['HOME', 'AWAY'];

// ---------- tiny utils ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mkCode() { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; return s; }

// ---------- audio (tiny synth) ----------
let AC = null, masterGain = null, muted = false;
function audio() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); masterGain = AC.createGain(); masterGain.gain.value = 0.5; masterGain.connect(AC.destination); }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(f0, f1, dur, type = 'sine', vol = 0.2) {
  if (muted) return; const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur, freq = 3000, vol = 0.18) {
  if (muted) return; const ac = audio(), t = ac.currentTime;
  const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(masterGain); src.start(t);
}
const S = {
  bounce: () => beep(120, 55, 0.09, 'sine', 0.10),
  swish: () => noiseBurst(0.28, 2800, 0.22),
  rim: () => beep(420, 180, 0.14, 'square', 0.08),
  shoot: () => beep(300, 520, 0.09, 'sine', 0.10),
  steal: () => beep(700, 350, 0.08, 'square', 0.10),
  cross: () => beep(280, 560, 0.09, 'sine', 0.12),
  pass: () => beep(500, 700, 0.07, 'sine', 0.10),
  block: () => beep(200, 90, 0.12, 'square', 0.12),
  count: () => beep(440, 440, 0.12, 'sine', 0.18),
  go: () => beep(660, 990, 0.25, 'sine', 0.2),
  buzzer: () => beep(170, 140, 0.9, 'sawtooth', 0.22),
  gb: () => beep(220, 1250, 0.55, 'sawtooth', 0.14),
  green: () => beep(880, 1320, 0.12, 'sine', 0.14),
};

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const ui = {
  menu: $('menu'), lobby: $('lobby'), lobbyg: $('lobbyg'), joinui: $('joinui'), hud: $('hud'),
  controls: $('controls'), meter: $('meter'), banner: $('banner'), gameover: $('gameover'),
  roomCode: $('room-code'), shareLink: $('share-link'), lobbyStatus: $('lobby-status'),
  hostName: $('host-name'), btnStart: $('btn-start'),
  rosterHome: $('roster-home'), rosterAway: $('roster-away'), countHome: $('count-home'), countAway: $('count-away'),
  lobbygTeam: $('lobbyg-team'), lobbygStatus: $('lobbyg-status'),
  rosterHomeG: $('roster-home-g'), rosterAwayG: $('roster-away-g'), countHomeG: $('count-home-g'), countAwayG: $('count-away-g'),
  joinName: $('join-name'), joinCode: $('join-code'), joinStatus: $('join-status'),
  scoreHome: $('score-home'), scoreAway: $('score-away'), sideHome: $('side-home'), sideAway: $('side-away'),
  hudCode: $('hud-code'),
  trickFill: $('trick-fill'), meterFill: $('meter-fill'), meterNeedle: $('meter-needle'),
  goTitle: $('go-title'), goScore: $('go-score'),
  btnRematch: $('btn-rematch'), goWait: $('go-wait'),
  joyBase: $('joy-base'), joyKnob: $('joy-knob'),
  proBase: $('pro-base'), proKnob: $('pro-knob'), proHint: $('pro-hint'),
  padPill: $('pad-pill'),
  hudLoc: $('hud-loc'),
  locate: $('locate'), locSearch: $('loc-search'), locResults: $('loc-results'),
  locPresets: $('loc-presets'), locStatus: $('loc-status'),
  rotateOverlay: $('rotate-overlay'),
  mlyToken: $('mly-token'), btnMlySave: $('btn-mly-save'), mlyStatus: $('mly-status'),
  photoCredit: $('photo-credit'),
};
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
let bannerTimer = null;
function showBanner(txt, cls = '', dur = 1200) {
  ui.banner.textContent = txt; ui.banner.className = cls;
  show(ui.banner);
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => hide(ui.banner), dur);
}

// ---------- game state ----------
const G = {
  mode: null,            // 'host' | 'guest' | 'practice'
  peer: null, code: null, myIdx: 0,
  phase: 'menu',         // menu | lobby | countdown | play | over
  cdT: 0, cdLast: 4, freezeT: 0,
  players: [], ball: null,
  conns: {},             // host: playerIdx -> PeerJS connection
  inputs: {},            // host: playerIdx -> latest input
  score: [0, 0], tick: 0,
  lastInputSeq: 0,
  snap: null, rpos: {},
  over: false, winner: -1,
  gbFlash: 0, offenseTeam: 0,
  overShown: false, paused: false,
};
const NULL_INP = { mx: 0, mz: 0, sprint: false, stickSprint: false, shootHeld: false, dribble: 0, steal: 0, pass: 0, block: 0, sw: 0, cut: 0, postup: false, stepback: 0, quickShot: 0, proDir: 0, pdx: 0, pdz: 0 };
function newPlayer(name, team) {
  return {
    name: String(name || 'BALLER').slice(0, 12), team, color: TEAM_COLORS[team],
    x: 0, z: 0, vx: 0, vz: 0, face: Math.PI, y: 0,
    hasBall: false,
    stealCd: 0, crossCd: 0, passCd: 0, blockCd: 0, swCd: 0, cutCd: 0, stepCd: 0,
    stumble: 0,
    jumpT: -1, jumpDur: 0.55, jumpH: 1.1,
    shootPow: -1, autoRel: 0, postStr: false,
    armUp: 0, dashT: 0, dashDx: 0, dashDz: 0,
    trick: 0, gb: false, moving: false, active: true,
    mesh: null, runPh: Math.random() * 6,
  };
}
function newBall() { return { x: 0, y: 1, z: 2, vx: 0, vy: 0, vz: 0, state: 'held', holder: 0, passTo: -1, flyT: 0, flyDur: 0.55, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, willScore: false, pts: 2, gbShot: false, shooterIdx: 0, mesh: null, lastBounce: 0, looseT: 0 }; }
function activeCount() { return G.players.filter(p => p.active).length; }
function resetPositions(offenseTeam) {
  G.offenseTeam = offenseTeam;
  const off = G.players.filter(p => p.active && p.team === offenseTeam);
  const def = G.players.filter(p => p.active && p.team !== offenseTeam);
  off.forEach((p, i) => {
    if (i === 0) { p.x = 0; p.z = 2.5; }
    else { p.x = ((i - 1) - (off.length - 2) / 2) * 3.4; p.z = 4.4; }
    p.vx = p.vz = 0; p.face = Math.PI; p.hasBall = (i === 0);
    p.shootPow = -1; p.autoRel = 0; p.postStr = false; p.stepCd = 0;
    p.jumpT = -1; p.stumble = 0; p.dashT = 0; p.y = 0;
  });
  def.forEach((p, i) => {
    p.x = (i - (def.length - 1) / 2) * 3.2; p.z = 0.4;
    p.vx = p.vz = 0; p.face = 0; p.hasBall = false;
    p.shootPow = -1; p.autoRel = 0; p.postStr = false; p.stepCd = 0;
    p.jumpT = -1; p.stumble = 0; p.dashT = 0; p.y = 0;
  });
  const b = G.ball, bh = off[0];
  b.state = 'held'; b.holder = G.players.indexOf(bh); b.vx = b.vy = b.vz = 0;
  if (b.mesh) b.mesh.visible = true; // v4 fix: ball was left invisible after boot
}
function resetMatch() {
  G.score = [0, 0]; G.tick = 0; G.over = false; G.winner = -1; G.freezeT = 0; G.offenseTeam = 0;
  for (const p of G.players) { p.trick = 0; p.gb = false; p.stealCd = p.crossCd = p.passCd = p.blockCd = p.swCd = p.cutCd = 0; }
  if (G.players.length) resetPositions(0);
}

/* ================= LOCATIONS (v4 — choose your court) ================= */
const LOC_PRESETS = [
  // National legends
  { name: 'RUCKER PARK', sub: 'HARLEM, NYC', lat: 40.8292, lng: -73.9365, variant: 'dusk' },
  { name: 'VENICE BEACH', sub: 'LOS ANGELES, CA', lat: 33.9850, lng: -118.4695, variant: 'day' },
  { name: 'DYCKMAN PARK', sub: 'WASHINGTON HTS, NYC', lat: 40.8662, lng: -73.9272, variant: 'night' },
  { name: 'THE CAGE', sub: 'WEST 4TH ST, NYC', lat: 40.7312, lng: -74.0006, variant: 'dusk' },
  { name: 'DREW LEAGUE', sub: 'LOS ANGELES, CA', lat: 33.9425, lng: -118.2437, variant: 'night' },
  { name: 'BARRY FARMS', sub: 'WASHINGTON, DC', lat: 38.8598, lng: -76.9970, variant: 'dusk' },
  { name: 'FONDE REC', sub: 'HOUSTON, TX', lat: 29.7686, lng: -95.3689, variant: 'night' },
  { name: 'MOSSWOOD PARK', sub: 'OAKLAND, CA', lat: 37.8240, lng: -122.2605, variant: 'day' },
  { name: 'JACKSON PARK', sub: 'CHICAGO, IL', lat: 41.7747, lng: -87.5804, variant: 'dusk' },
  { name: 'SMITH PLAYGROUND', sub: 'PHILADELPHIA, PA', lat: 39.9254, lng: -75.1873, variant: 'night' },
  { name: 'MADISON SQUARE', sub: 'BALTIMORE, MD', lat: 39.3024, lng: -76.5986, variant: 'dusk' },
  { name: 'DRUID HILL PARK', sub: 'BALTIMORE, MD', lat: 39.3235, lng: -76.6445, variant: 'day' },
  { name: 'FLAMINGO PARK', sub: 'MIAMI, FL', lat: 25.7847, lng: -80.1375, variant: 'day' },
  { name: 'JUDKINS PARK', sub: 'SEATTLE, WA', lat: 47.5903, lng: -122.3038, variant: 'night' },
  { name: 'ORANGE MOUND', sub: 'MEMPHIS, TN', lat: 35.1070, lng: -89.9721, variant: 'dusk' },
  // Georgia — Atlanta + 200-mile radius
  { name: 'PIEDMONT PARK', sub: 'ATLANTA, GA', lat: 33.7890, lng: -84.3719, variant: 'day' },
  { name: 'GRANT PARK', sub: 'ATLANTA, GA', lat: 33.7359, lng: -84.3709, variant: 'dusk' },
  { name: 'WASHINGTON PARK', sub: 'ATLANTA, GA', lat: 33.7576, lng: -84.4230, variant: 'night' },
  { name: 'BESSIE BRANHAM PARK', sub: 'ATLANTA, GA', lat: 33.7543, lng: -84.3208, variant: 'day' },
  { name: 'CENTRAL PARK', sub: 'ATLANTA, GA', lat: 33.7683, lng: -84.3764, variant: 'dusk' },
  { name: 'SOUTHSIDE PARK', sub: 'ATLANTA, GA', lat: 33.6621, lng: -84.3694, variant: 'night' },
  { name: 'PERKERSON PARK', sub: 'ATLANTA, GA', lat: 33.7112, lng: -84.4127, variant: 'day' },
  { name: 'CHASTAIN PARK', sub: 'ATLANTA, GA', lat: 33.8712, lng: -84.3910, variant: 'day' },
  { name: 'MARIETTA', sub: 'GEORGIA', lat: 33.9528, lng: -84.5496, variant: 'dusk' },
  { name: 'DECATUR', sub: 'GEORGIA', lat: 33.7748, lng: -84.2963, variant: 'day' },
  { name: 'COLLEGE PARK', sub: 'GEORGIA', lat: 33.6534, lng: -84.4494, variant: 'night' },
  { name: 'EAST POINT', sub: 'GEORGIA', lat: 33.6796, lng: -84.4394, variant: 'dusk' },
  { name: 'SANDY SPRINGS', sub: 'GEORGIA', lat: 33.9243, lng: -84.3785, variant: 'day' },
  { name: 'MACON', sub: 'GEORGIA', lat: 32.8407, lng: -83.6324, variant: 'dusk' },
  { name: 'ATHENS', sub: 'GEORGIA', lat: 33.9598, lng: -83.3764, variant: 'night' },
  { name: 'AUGUSTA', sub: 'GEORGIA', lat: 33.4710, lng: -81.9748, variant: 'day' },
  { name: 'COLUMBUS', sub: 'GEORGIA', lat: 32.4611, lng: -84.9880, variant: 'dusk' },
  { name: 'SAVANNAH', sub: 'GEORGIA', lat: 32.0790, lng: -81.0921, variant: 'night' },
  { name: 'ALBANY', sub: 'GEORGIA', lat: 31.5782, lng: -84.1557, variant: 'day' },
  { name: 'VALDOSTA', sub: 'GEORGIA', lat: 30.8327, lng: -83.2785, variant: 'dusk' },
  { name: 'CHATTANOOGA', sub: 'TENNESSEE', lat: 35.0457, lng: -85.3095, variant: 'night' },
  { name: 'GREENVILLE', sub: 'SOUTH CAROLINA', lat: 34.8514, lng: -82.3985, variant: 'day' },
  { name: 'BIRMINGHAM', sub: 'ALABAMA', lat: 33.5207, lng: -86.8024, variant: 'dusk' },
  { name: 'MONTGOMERY', sub: 'ALABAMA', lat: 32.3777, lng: -86.3091, variant: 'night' },
  { name: 'COLUMBIA', sub: 'SOUTH CAROLINA', lat: 34.0008, lng: -81.0352, variant: 'day' },
  { name: 'RANDOM BLACKTOP', sub: 'SOMEWHERE, USA', lat: 0, lng: 0, variant: 'night' },
];
const FALLBACK_LOC = { name: 'STREETBALL', sub: 'USA', lat: 0, lng: 0, variant: 'night' };

// Real photo backdrops via Mapillary (free, no card — crowdsourced street-level
// photos, CC BY-SA). The user pastes a free token from mapillary.com into the
// in-game settings (saved to localStorage) — no rebuild needed. Empty token =
// stylized skyline backdrop (game keeps working normally).
const MAPILLARY_TOKEN_BUILTIN = 'MLY|28893815526901836|f5d781284fe936d37bf1209a7136af74';
function mlyToken() {
  try { return (localStorage.getItem('hd_mly_token') || '').trim() || MAPILLARY_TOKEN_BUILTIN; }
  catch (_) { return MAPILLARY_TOKEN_BUILTIN; }
}
const mlyPhotoCache = {}; // "lat,lng" -> { url, capturedAt } (in-memory, per session)
let photoMesh = null;
function buildPhotoMesh() {
  // Large curved plane behind the far end of the court; the Mapillary photo
  // is painted on it. Camera sits at +z looking toward -z, so the arc is
  // centered on -z and we view its inner face (BackSide).
  const geo = new THREE.CylinderGeometry(42, 42, 20, 48, 1, true, Math.PI - 1.25, 2.5);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
  photoMesh = new THREE.Mesh(geo, mat);
  photoMesh.position.y = 8.5;
  photoMesh.visible = false;
  scene.add(photoMesh);
}
function hidePhotoBackdrop() {
  if (photoMesh) photoMesh.visible = false;
  if (ui.photoCredit) ui.photoCredit.classList.add('hidden');
}
function showPhotoBackdrop(url) {
  if (!photoMesh || !url) return;
  new THREE.TextureLoader().load(url,
    t => {
      t.colorSpace = THREE.SRGBColorSpace;
      const old = photoMesh.material.map;
      photoMesh.material.map = t;
      photoMesh.material.needsUpdate = true;
      if (old) old.dispose();
      photoMesh.visible = true;
      if (ui.photoCredit) ui.photoCredit.classList.remove('hidden');
    },
    undefined,
    () => { /* photo failed (CORS/network) — keep the stylized backdrop */ });
}
/* ---- v6: real satellite map under the court (free Esri World Imagery, no key) ---- */
function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180) / 360 * n);
  const lr = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n);
  return { x, y };
}
let satTex = null, satKey = '';
function showMapCredit() {
  if (ui.photoCredit) ui.photoCredit.classList.remove('hidden');
}
function loadSatelliteGround(lat, lng) {
  // Paints a real satellite view of the chosen court onto the ground plane.
  // Esri World_Imagery tiles are free with no key; 3x3 tiles at z18 ~ 200m across.
  if (!lat || !lng || !groundMesh) return;
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (key === satKey && satTex) return; // already showing this spot
  const z = 18, c = latLngToTile(lat, lng, z), S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S * 3;
  const ctx = cv.getContext('2d');
  let done = 0, failed = false;
  const base = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (failed) return;
      ctx.drawImage(img, (dx + 1) * S, (dy + 1) * S);
      if (++done === 9) {
        try {
          const t = new THREE.CanvasTexture(cv);
          t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
          const old = groundMesh.material.map;
          groundMesh.material.map = t;
          groundMesh.material.color.set(0xffffff);
          groundMesh.material.needsUpdate = true;
          if (old) old.dispose();
          if (satTex) satTex.dispose();
          satTex = t; satKey = key;
          showMapCredit();
        } catch (_) { /* keep the dark ground */ }
      }
    };
    img.onerror = () => { failed = true; };
    img.src = base + z + '/' + (c.y + dy) + '/' + (c.x + dx);
  }
}
async function loadLocationBackdrop(lat, lng) {
  // v4: real street-level photo of the chosen court via Mapillary API v4
  // radius search. Graceful fallback everywhere: no token, no coverage, or
  // any fetch/texture failure -> stylized skyline. Never breaks the game.
  hidePhotoBackdrop();
  const tok = mlyToken();
  if (!tok || !lat || !lng) return false;
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  try {
    let pick = mlyPhotoCache[key];
    if (!pick) {
      const url = 'https://graph.mapillary.com/images?access_token=' + encodeURIComponent(tok)
        + '&lat=' + lat + '&lng=' + lng + '&radius=50&limit=10'
        + '&fields=id,computed_geometry,thumb_2048_url,captured_at,compass_angle';
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return false;
      const j = await r.json();
      const arr = (j && j.data) || [];
      let best = null, bestD = 1e9;
      for (const im of arr) {
        if (!im || !im.thumb_2048_url) continue;
        const g = im.computed_geometry, c = g && g.coordinates;
        const d = c ? Math.hypot(c[1] - lat, c[0] - lng) : 0.01;
        if (d < bestD) { bestD = d; best = im; }
      }
      if (!best) return false;
      pick = { url: best.thumb_2048_url, capturedAt: best.captured_at };
      mlyPhotoCache[key] = pick;
    }
    showPhotoBackdrop(pick.url);
    return true;
  } catch (_) { return false; }
}
function seededRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function applyVariant(v) {
  // night | dusk | day — recolor sky, fog, lights, stars
  if (v === 'day') {
    scene.background.set(0x8fc3e8); scene.fog.color.set(0x8fc3e8); scene.fog.near = 40; scene.fog.far = 120;
    if (starsPts) starsPts.visible = false;
    if (moonMesh) moonMesh.visible = false;
    if (LT.hemi) { LT.hemi.intensity = 1.35; LT.hemi.color.set(0xffffff); }
    if (LT.amb) LT.amb.intensity = 0.5;
    if (LT.key) { LT.key.intensity = 2.0; LT.key.color.set(0xfff6e0); }
  } else if (v === 'dusk') {
    scene.background.set(0x2a1430); scene.fog.color.set(0x2a1430); scene.fog.near = 34; scene.fog.far = 95;
    if (starsPts) starsPts.visible = false;
    if (moonMesh) moonMesh.visible = false;
    if (LT.hemi) { LT.hemi.intensity = 1.0; LT.hemi.color.set(0xffb37a); }
    if (LT.amb) LT.amb.intensity = 0.3;
    if (LT.key) { LT.key.intensity = 1.9; LT.key.color.set(0xff9a5c); }
  } else {
    scene.background.set(0x05070d); scene.fog.color.set(0x05070d); scene.fog.near = 34; scene.fog.far = 95;
    if (starsPts) starsPts.visible = true;
    if (moonMesh) moonMesh.visible = true;
    if (LT.hemi) { LT.hemi.intensity = 0.95; LT.hemi.color.set(0x9db8ff); }
    if (LT.amb) LT.amb.intensity = 0.25;
    if (LT.key) { LT.key.intensity = 1.7; LT.key.color.set(0xfff1d6); }
  }
}
function rebuildSkyline(loc) {
  if (skylineGrp) scene.remove(skylineGrp);
  skylineGrp = new THREE.Group(); scene.add(skylineGrp);
  const seed = [...(loc.name || 'X')].reduce((a, c) => a + c.charCodeAt(0), 7);
  const R = seededRand(seed);
  const wt = windowTexture();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: wt });
  const n = 22 + Math.floor(R() * 8);
  for (let i = 0; i < n; i++) {
    const w = 3 + R() * 4, h = 6 + R() * 16, d = 3 + R() * 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const side = i % 3;
    if (side === 0) b.position.set(-34 + R() * 68, h / 2 - 0.5, -30 + R() * 10);
    else if (side === 1) b.position.set(-30 + R() * 10, h / 2 - 0.5, -18 + R() * 30);
    else b.position.set(20 + R() * 10, h / 2 - 0.5, -18 + R() * 30);
    skylineGrp.add(b);
  }
}
function applyLocation(loc) {
  G.loc = loc || FALLBACK_LOC;
  loadLocationBackdrop(G.loc.lat, G.loc.lng).catch(() => {}); // Mapillary photo; falls back silently
  loadSatelliteGround(G.loc.lat, G.loc.lng); // v6: real satellite map under the court
  if (courtMesh) {
    const old = courtMesh.material.map;
    courtMesh.material.map = courtTexture(G.loc.name, G.loc.sub);
    courtMesh.material.needsUpdate = true;
    if (old) old.dispose();
  }
  applyVariant(G.loc.variant || 'night');
  rebuildSkyline(G.loc);
  if (ui.hudLoc) ui.hudLoc.textContent = G.loc.name + (G.loc.sub ? ' — ' + G.loc.sub : '');
}
function renderLocPresets() {
  ui.locPresets.innerHTML = LOC_PRESETS.map((l, i) =>
    `<button class="loc-preset" data-i="${i}"><div class="pn">${esc(l.name)}</div><div class="ps">${esc(l.sub)}</div></button>`
  ).join('');
  ui.locPresets.querySelectorAll('.loc-preset').forEach(b =>
    b.onclick = () => { audio(); pickLocation(LOC_PRESETS[+b.dataset.i]); });
}
let locDeb = null;
async function searchLoc(q) {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(q),
      { headers: { 'Accept': 'application/json' } });
    const arr = await r.json();
    if (!arr.length) { ui.locResults.innerHTML = '<p class="status">No results — try another search.</p>'; return; }
    ui.locResults.innerHTML = arr.map((o, i) => {
      const parts = String(o.display_name || '').split(',');
      return `<button class="loc-res" data-i="${i}">${esc(parts.slice(0, 3).join(','))}</button>`;
    }).join('');
    ui.locResults.querySelectorAll('.loc-res').forEach(b => b.onclick = () => {
      audio();
      const o = arr[+b.dataset.i], parts = String(o.display_name || '').split(',');
      pickLocation({
        name: (parts[0] || 'BLACKTOP').trim().toUpperCase().slice(0, 24) || 'BLACKTOP',
        sub: parts.slice(1, 3).join(',').trim().toUpperCase().slice(0, 30) || 'USA',
        lat: +o.lat || 0, lng: +o.lon || 0, variant: 'night',
      });
    });
  } catch (_) {
    ui.locResults.innerHTML = '<p class="status">Search unavailable — pick a preset court below.</p>';
  }
}
function showLocate(mode) {
  G.locMode = mode; // 'host' | 'practice'
  ui.locSearch.value = ''; ui.locResults.innerHTML = ''; ui.locStatus.textContent = '';
  renderLocPresets();
  hide(ui.lobby); hide(ui.menu);
  show(ui.locate);
  setTimeout(() => ui.locSearch.focus(), 300);
}
function pickLocation(loc) {
  hide(ui.locate);
  if (G.locMode === 'host') hostPickLocation(loc);
  else { applyLocation(loc); startPractice(); }
}
function wireLocate() {
  ui.locSearch.addEventListener('input', () => {
    clearTimeout(locDeb);
    const q = ui.locSearch.value.trim();
    if (q.length < 3) { ui.locResults.innerHTML = ''; return; }
    locDeb = setTimeout(() => searchLoc(q), 450);
  });
  ui.locSearch.addEventListener('keydown', e => e.stopPropagation());
  $('btn-loc-back').onclick = () => {
    hide(ui.locate);
    if (G.locMode === 'host') show(ui.lobby); else show(ui.menu);
  };
}

/* ================= NETCODE (PeerJS star: host <-> each guest) ================= */
function baseUrl() { return location.href.split('?')[0]; }
function rosterMsg() { return G.players.map(p => ({ name: p.name, team: p.team, active: p.active })); }

function renderRoster(ulH, ulA, cH, cA) {
  for (const team of [0, 1]) {
    const list = G.players.filter(p => p.team === team && p.active);
    const ul = team === 0 ? $(ulH) : $(ulA);
    ul.innerHTML = list.length
      ? list.map(p => `<li>${esc(p.name)}</li>`).join('')
      : '<li class="empty">&mdash;</li>';
    $(team === 0 ? cH : cA).textContent = list.length;
  }
}
function renderHostRoster() {
  renderRoster('roster-home', 'roster-away', 'count-home', 'count-away');
  const n = activeCount();
  ui.btnStart.disabled = n < 2;
  ui.lobbyStatus.textContent = n < 2 ? 'Share the link — need at least 2 players' : n + ' players in — press START when ready';
}
function renderGuestRoster(roster) {
  G._groster = roster;
  for (const team of [0, 1]) {
    const list = roster.filter(r => r.team === team && r.active);
    const ul = $(team === 0 ? 'roster-home-g' : 'roster-away-g');
    ul.innerHTML = list.length ? list.map(r => `<li>${esc(r.name)}</li>`).join('') : '<li class="empty">&mdash;</li>';
    $(team === 0 ? 'count-home-g' : 'count-away-g').textContent = list.length;
  }
}

function setupHost() {
  G.mode = 'host'; G.myIdx = 0; G.code = mkCode();
  G.players = [newPlayer('HOST', 0)];
  G.conns = {}; G.inputs = {};
  hide(ui.menu); show(ui.lobby);
  ui.roomCode.textContent = G.code;
  ui.shareLink.value = baseUrl() + '?join=' + G.code;
  ui.hostName.value = '';
  renderHostRoster();
  const peer = new Peer('hoopdreams-' + G.code);
  G.peer = peer;
  peer.on('open', () => { G.phase = 'lobby'; });
  peer.on('connection', c => {
    c.on('open', () => {
      if (G.phase !== 'lobby') { try { c.send({ type: 'reject', reason: 'started' }); } catch (_) {} setTimeout(() => c.close(), 600); return; }
      if (activeCount() >= MAXP) { try { c.send({ type: 'reject', reason: 'full' }); } catch (_) {} setTimeout(() => c.close(), 600); return; }
    });
    c.on('data', d => {
      if (!d) return;
      if (d.type === 'hello') {
        if (G.phase !== 'lobby' || activeCount() >= MAXP) { try { c.send({ type: 'reject', reason: G.phase !== 'lobby' ? 'started' : 'full' }); } catch (_) {} setTimeout(() => c.close(), 600); return; }
        const idx = G.players.length, team = idx % 2;   // alternate: 1st guest=AWAY, 2nd=HOME...
        const p = newPlayer(d.name || ('BALLER' + (idx + 1)), team);
        G.players.push(p);
        G.conns[idx] = c; c._pidx = idx;
        try { c.send({ type: 'welcome', idx, team }); } catch (_) {}
        S.go();
        broadcastLobby();
      } else if (d.type === 'input') {
        const i = c._pidx;
        if (i != null && G.players[i] && G.players[i].active) G.inputs[i] = normInput(d);
      }
    });
    const drop = () => onGuestLeft(c);
    c.on('close', drop); c.on('error', drop);
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { G.code = mkCode(); try { peer.destroy(); } catch (_) {} setupHost(); }
    else ui.lobbyStatus.textContent = 'Connection error — cancel and retry.';
  });
  resetMatch();
  G.phase = 'lobby';
}
function normInput(d) {
  return {
    mx: +d.mx || 0, mz: +d.mz || 0,
    sprint: !!d.sprint, stickSprint: !!d.stickSprint, shootHeld: !!d.shoot,
    dribble: d.dribble ? 1 : 0, steal: d.steal ? 1 : 0, pass: d.pass ? 1 : 0,
    block: d.block ? 1 : 0, sw: d.sw ? 1 : 0, cut: d.cut ? 1 : 0,
    postup: !!d.postup, stepback: d.stepback ? 1 : 0, quickShot: d.quickShot ? 1 : 0,
    proDir: d.proDir ? 1 : 0, pdx: +d.pdx || 0, pdz: +d.pdz || 0,
  };
}
function broadcastLobby() {
  renderHostRoster();
  const msg = { type: 'lobby', roster: rosterMsg() };
  for (const k in G.conns) { try { G.conns[k].send(msg); } catch (_) {} }
}
function onGuestLeft(c) {
  const idx = c._pidx;
  if (idx == null || !G.players[idx]) return;
  const p = G.players[idx];
  if (!p.active) return;
  p.active = false;
  delete G.conns[idx]; delete G.inputs[idx];
  if (p.mesh) p.mesh.grp.visible = false;
  if (G.phase === 'lobby') { broadcastLobby(); return; }
  // mid-game: hand their ball to nearest active teammate, or reset
  if (G.ball.holder === idx && (G.ball.state === 'held')) {
    const mates = G.players.map((q, i) => ({ q, i })).filter(o => o.q.active && o.q.team === p.team);
    if (mates.length) {
      let best = mates[0], bd = 1e9;
      for (const o of mates) { const d = dist2d(p.x, p.z, o.q.x, o.q.z); if (d < bd) { bd = d; best = o; } }
      best.q.hasBall = true; G.ball.holder = best.i;
    } else { resetPositions(1 - p.team); G.freezeT = 1.0; }
  }
  showBanner(p.name.toUpperCase() + ' LEFT', '', 1500);
}
function hostStart() {
  const n = (ui.hostName.value || '').trim() || 'HOST';
  G.players[0].name = n.slice(0, 12);
  if (activeCount() < 2) return;
  showLocate('host'); // host picks the court, then the game starts
}
function hostPickLocation(loc) {
  applyLocation(loc);
  buildPlayers();
  const msg = { type: 'start', roster: rosterMsg(), loc };
  for (const k in G.conns) { try { G.conns[k].send(msg); } catch (_) {} }
  startCountdown();
}

function setupGuest(code, name) {
  G.mode = 'guest'; G.myIdx = -1; G.code = code;
  G._gname = (name || '').trim() || 'BALLER';
  hide(ui.menu); hide(ui.joinui);
  ui.joinStatus.textContent = '';
  const peer = new Peer();
  G.peer = peer;
  let done = false;
  peer.on('open', () => {
    const c = peer.connect('hoopdreams-' + code, { reliable: true });
    G.conn = c;
    c.on('open', () => {
      try { c.send({ type: 'hello', name: G._gname }); } catch (_) {}
    });
    c.on('data', d => {
      if (!d) return;
      if (d.type === 'welcome') {
        done = true; G.myIdx = d.idx;
        hide(ui.joinui); show(ui.lobbyg);
        ui.lobbygTeam.textContent = TEAM_NAMES[d.team];
        ui.lobbygTeam.style.color = d.team === 0 ? '#ff8a7a' : '#7ab8ff';
      } else if (d.type === 'lobby') {
        renderGuestRoster(d.roster);
      } else if (d.type === 'start') {
        guestBuildPlayers(d.roster);
        applyLocation(d.loc || FALLBACK_LOC);
        hide(ui.lobbyg); hide(ui.menu);
        show(ui.hud); show(ui.controls);
        ui.hudCode.textContent = 'ROOM ' + code;
      } else if (d.type === 'state') {
        onHostState(d);
      } else if (d.type === 'reject') {
        done = true;
        ui.joinStatus.textContent = d.reason === 'full' ? 'Room is full (10 players).' : 'Game already started.';
        show(ui.joinui); try { peer.destroy(); } catch (_) {}
      }
    });
    c.on('close', () => onHostGone());
    c.on('error', () => onHostGone());
    setTimeout(() => {
      if (!done) { ui.joinStatus.textContent = "Couldn't find that room. Check the code."; show(ui.joinui); try { peer.destroy(); } catch (_) {} }
    }, 9000);
  });
  peer.on('error', e => {
    if (e.type === 'peer-unreachable') { ui.joinStatus.textContent = "Couldn't find that room. Check the code."; show(ui.joinui); }
  });
  G.phase = 'lobby';
}
function guestBuildPlayers(roster) {
  for (const p of G.players) if (p.mesh) scene.remove(p.mesh.grp);
  G.players = roster.map(r => { const p = newPlayer(r.name, r.team); p.active = r.active; return p; });
  G.rpos = {};
  buildPlayers();
  resetMatch();
  for (const p of G.players) if (!p.active && p.mesh) p.mesh.grp.visible = false;
}
function onHostGone() {
  if (G.phase === 'over' || G.phase === 'menu' || G.phase === 'lobby') return;
  showBanner('HOST LEFT', '', 2500);
  setTimeout(() => location.reload(), 2600);
}
function hostBroadcast() {
  const anyOpen = Object.values(G.conns).some(c => c.open);
  if (!anyOpen) return;
  const ps = G.players.map(p => [ +p.x.toFixed(3), +p.z.toFixed(3), +p.vx.toFixed(2), +p.vz.toFixed(2),
    +p.face.toFixed(2), p.hasBall ? 1 : 0, p.y > 0.02 ? 1 : 0, +p.armUp.toFixed(2),
    p.stumble > 0 ? 1 : 0, p.shootPow >= 0 ? +p.shootPow.toFixed(2) : -1, p.moving ? 1 : 0, p.active ? 1 : 0 ]);
  const b = G.ball;
  const msg = {
    type: 'state', tick: G.tick, phase: G.phase, cdT: +G.cdT.toFixed(2),
    ps, ball: { st: b.state, x: +b.x.toFixed(3), y: +b.y.toFixed(3), z: +b.z.toFixed(3),
      holder: b.holder, tx: +b.tx.toFixed(2), ty: +b.ty.toFixed(2), tz: +b.tz.toFixed(2) },
    score: G.score.slice(), trick: G.players.map(p => Math.round(p.trick)),
    gb: G.players.map(p => p.gb ? 1 : 0), winner: G.winner,
  };
  for (const k in G.conns) { try { const c = G.conns[k]; if (c.open) c.send(msg); } catch (_) {} }
}
function onHostState(s) {
  const prevScore = G.snap ? G.snap.score.slice() : G.score.slice();
  const prevPhase = G.phase;
  G.snap = s;
  G.phase = s.phase; G.cdT = s.cdT;
  G.score = s.score.slice(); G.winner = s.winner;
  if (G.mode === 'guest' && (s.phase === 'countdown' || s.phase === 'play') && !inputTimer) startInputLoop();
  if (G.mode === 'guest' && s.phase !== 'countdown' && s.phase !== 'play') stopInputLoop();
  if (prevPhase === 'over' && s.phase !== 'over') { hide(ui.gameover); show(ui.controls); G.overShown = false; }
  if (prevPhase !== 'countdown' && s.phase === 'countdown') G.cdLast = 4;
  if (s.phase === 'over' && !G.overShown) { G.overShown = true; showGameOver(); }
  if (G.mode === 'guest' && (s.score[0] + s.score[1]) > (prevScore[0] + prevScore[1])) S.swish();
}
let inputTimer = null;
function startInputLoop() {
  stopInputLoop();
  inputTimer = setInterval(() => {
    if (G.conn && G.conn.open && (G.phase === 'play' || G.phase === 'countdown')) {
      const src = G.rotPause ? NULL_INP : input;
      G.conn.send({ type: 'input', seq: ++G.lastInputSeq,
        mx: +src.mx.toFixed(3), mz: +src.mz.toFixed(3),
        sprint: src.sprint ? 1 : 0, stickSprint: src.stickSprint ? 1 : 0,
        shoot: src.shootHeld ? 1 : 0,
        dribble: src.dribble ? 1 : 0, steal: src.steal ? 1 : 0, pass: src.pass ? 1 : 0,
        block: src.block ? 1 : 0, sw: src.sw ? 1 : 0, cut: src.cut ? 1 : 0,
        postup: src.postup ? 1 : 0, stepback: src.stepback ? 1 : 0, quickShot: src.quickShot ? 1 : 0,
        proDir: src.proDir ? 1 : 0, pdx: +src.pdx.toFixed(3), pdz: +src.pdz.toFixed(3) });
      input.dribble = input.steal = input.pass = input.block = input.sw = input.cut = 0;
      input.stepback = input.quickShot = input.proDir = 0;
    }
  }, 33);
}
function stopInputLoop() { if (inputTimer) clearInterval(inputTimer); inputTimer = null; }

/* ================= THREE.JS SCENE ================= */
let renderer, scene, camera;
let courtMesh = null, skylineGrp = null, starsPts = null, moonMesh = null, groundMesh = null;
const LT = {}; // light refs for location variants (v4)
const PX = x => (x + COURT_W / 2) / COURT_W * 1024;
const PZ = z => (z + COURT_L / 2) / COURT_L * 960;

function courtTexture(name, sub) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 960;
  const g = cv.getContext('2d');
  g.fillStyle = '#23282f'; g.fillRect(0, 0, 1024, 960);
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = `rgba(${Math.random() > .5 ? '255,255,255' : '0,0,0'},${rand(0.02, 0.07)})`;
    g.fillRect(Math.random() * 1024, Math.random() * 960, rand(1, 3), rand(1, 3));
  }
  g.fillStyle = '#31497e'; g.fillRect(PX(-1.8), PZ(-7), PX(1.8) - PX(-1.8), PZ(-1.2) - PZ(-7));
  g.strokeStyle = 'rgba(240,244,250,.92)'; g.lineWidth = 5;
  const line = (x1, z1, x2, z2) => { g.beginPath(); g.moveTo(PX(x1), PZ(z1)); g.lineTo(PX(x2), PZ(z2)); g.stroke(); };
  line(-7.5, -7, 7.5, -7); line(-7.5, 7, 7.5, 7);
  line(-7.5, -7, -7.5, 7); line(7.5, -7, 7.5, 7);
  line(-1.8, -7, -1.8, -1.2); line(1.8, -7, 1.8, -1.2); line(-1.8, -1.2, 1.8, -1.2);
  g.beginPath(); g.arc(PX(0), PZ(-1.2), (1.8 / COURT_W) * 1024, 0, Math.PI * 2); g.stroke();
  const hz = PZ(HZ);
  g.beginPath();
  for (let a = -68; a <= 68; a += 2) {
    const rad = a * Math.PI / 180;
    const x = HX + Math.sin(rad) * THREE_PT, z = HZ + Math.cos(rad) * THREE_PT;
    const px = PX(x), py = PZ(z);
    a === -68 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.stroke();
  line(-7.5 + 0.9, -7, -7.5 + 0.9, -4.4); line(7.5 - 0.9, -7, 7.5 - 0.9, -4.4);
  g.beginPath(); g.arc(PX(HX), hz, (1.25 / COURT_W) * 1024, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  // v4: paint the chosen court name big on the asphalt (half-court)
  const nm = String(name || 'STREETBALL').slice(0, 26), sb = String(sub || '').slice(0, 34);
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(235,240,248,0.20)';
  g.font = '900 76px -apple-system, "Segoe UI", sans-serif';
  g.fillText(nm, 512, 700);
  if (sb) { g.font = '700 34px -apple-system, "Segoe UI", sans-serif'; g.fillStyle = 'rgba(235,240,248,0.16)'; g.fillText(sb, 512, 762); }
  g.restore();
  const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
function windowTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a101d'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 250; y += 16) for (let x = 8; x < 120; x += 16)
    if (Math.random() < 0.28) { g.fillStyle = Math.random() < .7 ? '#ffd98a' : '#9fd0ff'; g.fillRect(x, y, 8, 10); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

function initThree() {
  const canvas = $('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.Fog(0x05070d, 34, 95);
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
  layoutCamera();

  scene.add(new THREE.HemisphereLight(0x9db8ff, 0x201812, 0.95));
  LT.hemi = scene.children[scene.children.length - 1];
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  LT.amb = scene.children[scene.children.length - 1];
  const key = new THREE.DirectionalLight(0xfff1d6, 1.7); key.position.set(7, 14, 7); scene.add(key); LT.key = key;
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.5); fill.position.set(-8, 10, -4); scene.add(fill); LT.fill = fill;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ color: 0x11141a }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  groundMesh = ground; // v6: satellite map texture gets painted here
  courtMesh = new THREE.Mesh(new THREE.PlaneGeometry(COURT_W, COURT_L), new THREE.MeshLambertMaterial({ map: courtTexture() }));
  courtMesh.rotation.x = -Math.PI / 2; scene.add(courtMesh);
  buildPhotoMesh(); // v4: curved plane for real Mapillary photo backdrops

  buildHoop(); buildLights(); buildStars();
  rebuildSkyline(FALLBACK_LOC);
  window.addEventListener('resize', layoutCamera);
}
function layoutCamera() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h); camera.aspect = a; camera.updateProjectionMatrix();
  const back = a < 0.8 ? 1.55 : a < 1.2 ? 1.32 : 1.12;   // pulled back for up to 10 players
  camera.position.set(0, 10.4 * back, 12.6 * back);
  camera.lookAt(0, 0.7, -1.8);
}
function buildHoop() {
  const grp = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.2, 10), dark);
  pole.position.set(0, 2.1, HZ - 1.05); grp.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.0), dark);
  arm.position.set(0, 3.85, HZ - 0.55); grp.add(arm);
  const bb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.06),
    new THREE.MeshLambertMaterial({ color: 0xdfe8f2, transparent: true, opacity: 0.85 }));
  bb.position.set(0, 3.55, HZ - 0.42); grp.add(bb);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2286, 0.028, 10, 24),
    new THREE.MeshLambertMaterial({ color: 0xe8641c, emissive: 0x552200 }));
  rim.rotation.x = Math.PI / 2; rim.position.set(HX, RIM_Y, HZ); grp.add(rim);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    pts.push(new THREE.Vector3(HX + Math.cos(a) * 0.22, RIM_Y - 0.02, HZ + Math.sin(a) * 0.22));
    pts.push(new THREE.Vector3(HX + Math.cos(a + 0.3) * 0.11, RIM_Y - 0.42, HZ + Math.sin(a + 0.3) * 0.11));
  }
  for (let ring = 0; ring < 2; ring++) {
    const y = RIM_Y - 0.16 - ring * 0.13, r = 0.185 - ring * 0.045;
    for (let i = 0; i < 10; i++) {
      const a1 = i / 10 * Math.PI * 2, a2 = (i + 1) / 10 * Math.PI * 2;
      pts.push(new THREE.Vector3(HX + Math.cos(a1) * r, y, HZ + Math.sin(a1) * r));
      pts.push(new THREE.Vector3(HX + Math.cos(a2) * r, y, HZ + Math.sin(a2) * r));
    }
  }
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.9 })));
  scene.add(grp);
}
function buildLights() {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x1c212b });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  for (const [x, z] of [[-10.5, 8.5], [10.5, 8.5], [-10.5, -9.5], [10.5, -9.5]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 10.5, 8), poleMat);
    pole.position.set(x, 5.25, z); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.4), headMat);
    head.position.set(x, 10.6, z); head.lookAt(0, 0, -1); scene.add(head);
  }
}
// skyline is built by rebuildSkyline(loc) — see LOCATIONS section (v4)
function buildStars() {
  const n = 350, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = rand(0.15, 1.4), r = 150;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starsPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.9, sizeAttenuation: false }));
  scene.add(starsPts);
  moonMesh = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ color: 0xf4f1de, fog: false }));
  moonMesh.position.set(-38, 42, -90); moonMesh.lookAt(0, 10, 0); scene.add(moonMesh);
}

// ---------- players & ball meshes ----------
let shadowTex = null;
function makePlayerMesh(color) {
  const grp = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0x7a4b2e });
  const jersey = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x141821 });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 8), dark);
    leg.position.set(sx * 0.15, 0.32, 0); grp.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    shoe.position.set(sx * 0.15, 0.07, 0.05); grp.add(shoe);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.62, 6, 12), jersey);
  body.position.y = 1.06; grp.add(body);
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.42, 1.38, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.58, 8), skin);
    arm.position.y = -0.29; pivot.add(arm); pivot.rotation.z = sx * 0.18; grp.add(pivot); arms.push(pivot);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
  head.position.y = 1.78; grp.add(head);
  if (!shadowTex) shadowTex = blobTexture();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; grp.add(sh);
  scene.add(grp);
  return { grp, armL: arms[0], armR: arms[1], shadow: sh };
}
function makeNameSprite(name, tint) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  const txt = String(name || '').toUpperCase().slice(0, 12);
  g.font = '800 30px -apple-system, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(txt, 128, 32);
  g.fillStyle = tint; g.fillText(txt, 128, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(2.4, 0.6, 1); sp.position.set(0, 2.55, 0);
  return sp;
}
function buildPlayers() {
  for (const p of G.players) {
    if (p.mesh) { scene.remove(p.mesh.grp); p.mesh = null; }
    if (!p.active) continue;
    p.mesh = makePlayerMesh(p.color);
    p.mesh.grp.add(makeNameSprite(p.name, p.team === 0 ? '#ffb3ab' : '#aed4ff'));
  }
}
function makeBallMesh() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14),
    new THREE.MeshLambertMaterial({ color: 0xe86a1c, emissive: 0x3a1500 }));
  scene.add(m); return m;
}
function syncMesh(p) {
  const m = p.mesh; if (!m) return;
  m.grp.position.set(p.x, p.y, p.z);
  m.grp.rotation.y = p.face;
  const targetArm = p.armUp > 0.02 ? -2.5 : -0.15;
  m.armL.rotation.x = lerp(m.armL.rotation.x, targetArm, 0.35);
  m.armR.rotation.x = lerp(m.armR.rotation.x, targetArm, 0.35);
  if (p.stumble > 0) m.grp.rotation.z = Math.sin(performance.now() / 60) * 0.22;
  else m.grp.rotation.z = 0;
  const s = p.y > 0.02 ? clamp(1 - p.y * 0.18, 0.6, 1) : 1;
  m.shadow.scale.set(s, s, 1);
  m.shadow.material.opacity = p.y > 0.02 ? 0.7 : 1;
}

/* ================= INPUT (touch + keyboard, 2K-mobile style) ================= */
const input = { mx: 0, mz: 0, sprint: false, stickSprint: false, shootHeld: false, dribble: 0, steal: 0, pass: 0, block: 0, sw: 0, cut: 0, postup: false, stepback: 0, quickShot: 0, proDir: 0, pdx: 0, pdz: 0 };
const keys = {};
addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true; audio();
  if (e.code === 'Space') { input.shootHeld = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
  if (e.code === 'KeyE') input.dribble = 1;
  if (e.code === 'KeyQ') input.steal = 1;
  if (e.code === 'KeyF') input.pass = 1;
  if (e.code === 'KeyR') input.block = 1;
  if (e.code === 'KeyX') input.sw = 1;
  if (e.code === 'KeyC') input.cut = 1;
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') input.shootHeld = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
});
function pollKeys() {
  let x = 0, z = 0;
  if (keys.KeyW || keys.ArrowUp) z -= 1;
  if (keys.KeyS || keys.ArrowDown) z += 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (x || z) { const l = Math.hypot(x, z); input.mx = x / l; input.mz = z / l; }
}
(function () {
  const zone = $('joy-zone'); let tid = null, ox = 0, oy = 0;
  const R = 44;
  zone.addEventListener('touchstart', e => {
    e.preventDefault(); audio();
    const t = e.changedTouches[0]; tid = t.identifier; ox = t.clientX; oy = t.clientY;
    ui.joyBase.style.display = 'block';
    ui.joyBase.style.left = (ox - 60) + 'px'; ui.joyBase.style.top = (oy - 60) + 'px';
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === tid) {
      let dx = t.clientX - ox, dy = t.clientY - oy;
      const l = Math.hypot(dx, dy);
      input.stickSprint = l >= R * 0.92;   // push joystick to the edge = sprint
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      ui.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      input.mx = dx / R; input.mz = dy / R;
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) if (t.identifier === tid) {
      tid = null; input.mx = 0; input.mz = 0; input.stickSprint = false;
      ui.joyBase.style.display = 'none';
      ui.joyKnob.style.transform = 'translate(-50%,-50%)';
    }
  };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
})();
function bindBtn(id, down, up) {
  const el = $(id);
  el.addEventListener('touchstart', e => { e.preventDefault(); audio(); el.classList.add('held'); down(); }, { passive: false });
  const off = e => { e.preventDefault(); el.classList.remove('held'); up && up(); };
  el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
  el.addEventListener('mousedown', e => { e.preventDefault(); down(); });
  el.addEventListener('mouseup', () => up && up());
}
bindBtn('b-sprint', () => input.sprint = true, () => input.sprint = false);
bindBtn('b-pass', () => input.pass = 1);
bindBtn('b-switch', () => input.sw = 1);
bindBtn('b-cut', () => input.cut = 1);
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

/* ============ PRO STICK (v4 — the 2K right stick, touch) ============ */
/* LEFT virtual stick moves. RIGHT stick: flick = dribble/steal, push up +   */
/* release = jumper (timing meter), push down hold = post up, down tap =     */
/* stepback jumper. On defense: flick = steal swipe, push up = block.        */
(function () {
  const zone = $('pro-zone'); let tid = null, ox = 0, oy = 0, t0 = 0;
  const R = 52, FLICK_MS = 250, FLICK_PX = 28;
  let shootMode = false, downHeld = false;
  const me = () => G.players[G.myIdx];
  zone.addEventListener('touchstart', e => {
    e.preventDefault(); audio();
    const t = e.changedTouches[0]; tid = t.identifier; ox = t.clientX; oy = t.clientY; t0 = performance.now();
    ui.proBase.style.display = 'block';
    ui.proBase.style.left = (ox - 66) + 'px'; ui.proBase.style.top = (oy - 66) + 'px';
    shootMode = false; downHeld = false;
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === tid) {
      let dx = t.clientX - ox, dy = t.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      ui.proKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const p = me(); if (!p) return;
      const onOff = G.offenseTeam === p.team, hasBall = p.hasBall;
      const upHeld = dy < -R * 0.55, dnHeld = dy > R * 0.55;
      if (hasBall && upHeld && !shootMode) { shootMode = true; input.shootHeld = true; }
      if (hasBall && dnHeld && !downHeld) { downHeld = true; input.postup = true; }
      else if (!dnHeld && downHeld) { downHeld = false; input.postup = false; }
      if (!onOff && upHeld && !shootMode) { /* block fires on release */ }
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) if (t.identifier === tid) {
      const dt = performance.now() - t0;
      const dx = t.clientX - ox, dy = t.clientY - oy;
      const l = Math.hypot(dx, dy);
      const p = me();
      tid = null; ui.proBase.style.display = 'none';
      ui.proKnob.style.transform = 'translate(-50%,-50%)';
      if (shootMode) { input.shootHeld = false; shootMode = false; }
      if (downHeld) { input.postup = false; downHeld = false; }
      if (!p) return;
      const onOff = G.offenseTeam === p.team, hasBall = p.hasBall;
      const quick = dt < FLICK_MS && l > FLICK_PX && !shootMode;
      const upRel = dy < -R * 0.5, dnRel = dy > R * 0.5;
      if (!onOff) {
        // DEFENSE: any flick = steal swipe, push-up release = block jump
        if (quick) input.steal = 1;
        else if (upRel) input.block = 1;
        return;
      }
      if (!hasBall) return; // off-ball offense: stick does nothing
      if (quick) {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (ay >= ax && dy > 0) input.stepback = 1;                    // flick down = stepback jumper
        else if (ay > ax && dy < 0) input.quickShot = 1;              // flick up = quick jumper
        else {                                                        // flick left/right = dribble move
          const nl = Math.hypot(dx, dy) || 1;
          input.pdx = dx / nl; input.pdz = dy / nl;                   // screen: right=+x, down=+z
          input.proDir = 1; input.dribble = 1;
        }
      }
    }
  };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
})();

/* ============ GAMEPAD (Bluetooth console controllers, standard mapping) ============ */
/* Merged with touch/keyboard: all three write into the same `input` object.       */
const pad = { prev: [], rsUp: false, rsL: false, rsR: false, rsDown: false, downT0: 0, driving: false, connected: false, quitArm: 0, lastActivity: 0 };
const PAD_DZ = 0.25, PAD_IDLE_MS = 8000;   // touch controls return after 8s of no pad input
function padDZ(v) { const a = Math.abs(v); return a < PAD_DZ ? 0 : (v - Math.sign(v) * PAD_DZ) / (1 - PAD_DZ); }
function firstPad() {
  if (!navigator.getGamepads) return null;
  const ps = navigator.getGamepads();
  for (const p of ps) if (p && p.connected) return p;
  return null;
}
function padBtn(gp, i) { const b = gp.buttons[i]; return b ? (b.pressed || b.value > 0.4) : false; }
function padQuickShot() {
  // right-stick flick up on offense: quick jumper (sim auto-releases at ~0.6 power)
  input.quickShot = 1;
}
function onPadStart() {
  audio();
  if (G.mode === 'practice' && (G.phase === 'play' || G.phase === 'countdown')) {
    G.paused = !G.paused;
    showBanner(G.paused ? 'PAUSED' : 'GO!', '', 900);
    return;
  }
  const now = performance.now();
  if (now - pad.quitArm < 3000) { location.reload(); return; }
  pad.quitArm = now;
  showBanner('PRESS START AGAIN TO QUIT', '', 1700);
}
function pollGamepad() {
  const gp = firstPad();
  if (!gp) {
    if (pad.connected) {
      pad.connected = false;
      if (pad.driving) { pad.driving = false; input.mx = 0; input.mz = 0; input.stickSprint = false; }
      input.shootHeld = false; input.sprint = false;
      pad.prev = []; pad.rsUp = pad.rsL = pad.rsR = false;
      if (ui.padPill) ui.padPill.classList.add('hidden');
    }
    return;
  }
  if (!pad.connected) {
    pad.connected = true;
    if (ui.padPill) ui.padPill.classList.remove('hidden');
    showBanner('CONTROLLER CONNECTED', '', 1300);
  }
  // --- left stick + d-pad -> move (magnitude = speed, full tilt = sprint) ---
  let lx = padDZ(gp.axes[0] || 0), lz = padDZ(gp.axes[1] || 0);
  let mag = Math.hypot(lx, lz);
  if (mag > 1) { lx /= mag; lz /= mag; mag = 1; }
  let dx = 0, dz = 0;
  if (padBtn(gp, 14)) dx -= 1;
  if (padBtn(gp, 15)) dx += 1;
  if (padBtn(gp, 12)) dz -= 1;
  if (padBtn(gp, 13)) dz += 1;
  if (mag > 0.01 || dx || dz) {
    input.mx = mag > 0.01 ? lx : dx;
    input.mz = mag > 0.01 ? lz : dz;
    input.stickSprint = mag > 0.92;
    pad.driving = true;
  } else if (pad.driving) {
    pad.driving = false; input.mx = 0; input.mz = 0; input.stickSprint = false;
  }
  // --- buttons (edge-detected: no auto-repeat) ---
  const b = i => padBtn(gp, i);
  const prev = pad.prev;
  const edge = i => b(i) && !prev[i];
  // --- right stick = pro stick (v4): offense flicks = shot/dribble/stepback/postup,
  // --- defense: flick = steal, push up = block
  const me = G.players[G.myIdx];
  const onD = !!(me && me.active && G.offenseTeam !== me.team);
  const hasBall = !!(me && me.hasBall);
  const rsx = padDZ(gp.axes[2] || 0), rsy = padDZ(gp.axes[3] || 0);
  const now = performance.now();
  if (!onD && hasBall) {
    if (rsy < -0.7 && !pad.rsUp) { pad.rsUp = true; padQuickShot(); }
    else if (rsy >= -0.45) pad.rsUp = false;
    if (rsx < -0.7 && !pad.rsL) { pad.rsL = true; input.pdx = -1; input.pdz = 0; input.proDir = 1; input.dribble = 1; }
    else if (rsx >= -0.45) pad.rsL = false;
    if (rsx > 0.7 && !pad.rsR) { pad.rsR = true; input.pdx = 1; input.pdz = 0; input.proDir = 1; input.dribble = 1; }
    else if (rsx <= 0.45) pad.rsR = false;
    if (rsy > 0.7 && !pad.rsDown) { pad.rsDown = true; pad.downT0 = now; input.postup = true; }
    else if (rsy <= 0.45 && pad.rsDown) {
      pad.rsDown = false; input.postup = false;
      if (now - pad.downT0 < 250) input.stepback = 1; // quick down-tap = stepback jumper
    }
  } else if (onD) {
    if (rsy < -0.7 && !pad.rsUp) { pad.rsUp = true; input.block = 1; }
    else if (rsy >= -0.45) pad.rsUp = false;
    const flicked = (rsx < -0.7 && !pad.rsL) || (rsx > 0.7 && !pad.rsR) || (rsy > 0.7 && !pad.rsDown);
    if (flicked) {
      pad.rsL = rsx < -0.7; pad.rsR = rsx > 0.7; pad.rsDown = rsy > 0.7;
      input.steal = 1;
    } else {
      if (rsx >= -0.45) pad.rsL = false;
      if (rsx <= 0.45) pad.rsR = false;
      if (rsy <= 0.45) pad.rsDown = false;
    }
  } else {
    pad.rsUp = pad.rsL = pad.rsR = pad.rsDown = false; input.postup = false;
  }
  if (edge(2)) input.shootHeld = true;            // X / Square: hold-release timing
  if (!b(2) && prev[2]) input.shootHeld = false;
  if (edge(0)) input.pass = 1;                    // A / Cross
  if (edge(1)) input.dribble = 1;                 // B / Circle
  if (edge(3)) input.block = 1;                   // Y / Triangle
  if (edge(5)) input.steal = 1;                   // RB / R1
  if (b(4) || b(6)) input.sprint = true;          // LB / L1 / LT hold
  else if (prev[4] || prev[6]) input.sprint = false;
  if (edge(9)) onPadStart();                      // Start / Options
  // track "in use": any stick/button activity keeps touch controls hidden
  let padActiveNow = mag > 0.01 || dx !== 0 || dz !== 0 || Math.abs(rsx) > 0.3 || Math.abs(rsy) > 0.3;
  if (!padActiveNow) for (let i = 0; i < 10; i++) if (b(i)) { padActiveNow = true; break; }
  if (padActiveNow) pad.lastActivity = performance.now();
  pad.prev = Array.prototype.map.call(gp.buttons, x => x.pressed || x.value > 0.4);
}

/* ================= SIMULATION (host-authoritative) ================= */
function inpFor(i) {
  if (i === G.myIdx) return input;
  if (G.mode === 'host') return G.inputs[i] || NULL_INP;
  return NULL_INP;
}
function clearEdge(inp) { inp.dribble = inp.steal = inp.pass = inp.block = inp.sw = inp.cut = inp.stepback = inp.quickShot = 0; inp.proDir = 0; }
function nearestOpp(p, idx, maxD) {
  let best = null, bd = maxD;
  for (let j = 0; j < G.players.length; j++) {
    if (j === idx) continue;
    const q = G.players[j];
    if (!q.active || q.team === p.team) continue;
    const d = dist2d(p.x, p.z, q.x, q.z);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function gbCheck(p, idx) {
  if (p.trick >= 100 && !p.gb) {
    p.gb = true;
    if (idx === G.myIdx) { showBanner('GAMEBREAKER READY', 'gb', 1200); S.gb(); }
  }
}
function applyMovement(p, inp, dt) {
  let sp = SPEED * ((inp.sprint || inp.stickSprint) ? SPRINT_MULT : 1);
  if (p.postStr) sp *= 0.55; // v4: backing down is slow but strong
  const sp2 = p.stumble > 0 ? sp * 0.35 : sp;
  if (p.dashT > 0) { p.dashT -= dt; p.x += p.dashDx * 11 * dt; p.z += p.dashDz * 11 * dt; }
  else {
    const k = 1 - Math.exp(-12 * dt);
    p.vx = lerp(p.vx, inp.mx * sp2, k); p.vz = lerp(p.vz, inp.mz * sp2, k);
    p.x += p.vx * dt; p.z += p.vz * dt;
  }
  p.x = clamp(p.x, -7.2, 7.2); p.z = clamp(p.z, -6.7, 6.7);
  p.moving = Math.hypot(p.vx, p.vz) > 0.8;
  if (p.moving && p.dashT <= 0) p.face = Math.atan2(p.vx, p.vz);
  if (p.moving) p.runPh += dt * ((inp.sprint || inp.stickSprint) ? 13 : 10); else p.runPh += dt * 3;
}
function updateJump(p, dt) {
  if (p.jumpT < 0) return;
  p.jumpT += dt;
  const k = p.jumpT / p.jumpDur;
  if (k >= 1) { p.jumpT = -1; p.y = 0; }
  else p.y = p.jumpH * 4 * k * (1 - k);
}
function releaseShot(p, idx) {
  const d = dist2d(p.x, p.z, HX, HZ);
  const dunk = d < 2.6;
  let makeP = dunk ? 0.90 : d < 4 ? 0.70 : d < THREE_PT ? 0.55 : 0.42;
  const pw = p.shootPow;
  if (pw >= 0.65 && pw <= 0.90) { makeP += 0.22; S.green(); if (idx === G.myIdx) showBanner('GREEN!', '', 650); }
  else if (pw < 0.35) makeP -= 0.30;
  else if (pw > 0.97) makeP -= 0.18;
  const o = nearestOpp(p, idx, 2.4);
  if (o) {
    if (o.jumpT >= 0) makeP -= 0.22;
    else if (dist2d(o.x, o.z, p.x, p.z) < 1.5) makeP -= 0.08;
  }
  let gbUsed = false;
  if (p.gb) { makeP = 1; gbUsed = true; p.gb = false; p.trick = 0; G.gbFlash = 1; showBanner('GAMEBREAKER!', 'gb', 1400); S.gb(); }
  makeP = clamp(makeP, 0.02, 1);
  const make = Math.random() < makeP;
  const pts = d > THREE_PT ? 3 : 2;
  p.hasBall = false; p.shootPow = -1; p.armUp = 1;
  p.jumpT = 0; p.jumpDur = dunk ? 0.55 : 0.45; p.jumpH = dunk ? 1.55 : 0.9;
  const b = G.ball;
  b.state = 'fly'; b.holder = -1; b.passTo = -1;
  b.fx = p.x + Math.sin(p.face) * 0.4; b.fy = 2.0 + (dunk ? 1.0 : 0); b.fz = p.z + Math.cos(p.face) * 0.4;
  b.flyT = 0; b.flyDur = dunk ? 0.38 : 0.55;
  if (make) { b.tx = HX; b.ty = RIM_Y; b.tz = HZ; }
  else { const a = Math.random() * Math.PI * 2, r = rand(0.34, 0.58); b.tx = HX + Math.cos(a) * r; b.ty = RIM_Y + rand(-0.04, 0.14); b.tz = HZ + Math.sin(a) * r; }
  b.willScore = make; b.pts = pts; b.gbShot = gbUsed; b.shooterIdx = idx;
  S.shoot();
}
function tryDribble(p, idx, inp) {
  if (p.crossCd > 0 || !p.hasBall) return;
  p.crossCd = 1.2; p.dashT = 0.18;
  let dx = inp.mx, dz = inp.mz;
  if (inp.proDir && (inp.pdx || inp.pdz)) { dx = inp.pdx; dz = inp.pdz; }  // v4: pro-stick flick direction
  else if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(p.face); dz = Math.cos(p.face); }
  const l = Math.hypot(dx, dz) || 1; p.dashDx = dx / l; p.dashDz = dz / l;
  p.trick = Math.min(100, p.trick + 12); gbCheck(p, idx);
  S.cross();
  const o = nearestOpp(p, idx, 2.3);
  if (o && Math.random() < 0.22) {
    o.stumble = 1.1; if (idx === G.myIdx) showBanner('ANKLE BREAKER!', '', 800);
  }
}
function tryStepback(p, idx) {
  // v4: quick down-flick on the pro stick — dash away from the rim into a jumper
  if (p.stepCd > 0 || !p.hasBall || p.shootPow >= 0) return;
  p.stepCd = 1.4;
  const dx = p.x - HX, dz = p.z - HZ, l = Math.hypot(dx, dz) || 1;
  p.dashT = 0.25; p.dashDx = dx / l; p.dashDz = dz / l;
  p.face = Math.atan2(dx, dz);
  p.shootPow = 0; p.autoRel = 0.65; S.shoot();
  p.trick = Math.min(100, p.trick + 6); gbCheck(p, idx);
  if (idx === G.myIdx) showBanner('STEPBACK!', '', 650);
}
function trySteal(p, idx) {
  if (p.stealCd > 0 || p.hasBall) return;
  p.stealCd = 2.2; p.armUp = 0.7;
  const h = G.ball.holder, hp = h >= 0 ? G.players[h] : null;
  if (hp && hp.active && hp.team !== p.team && dist2d(p.x, p.z, hp.x, hp.z) < 1.9) {
    const chance = hp.postStr ? 0.12 : 0.38; // v4: post-up strength protects the ball
    if (Math.random() < chance) {
    hp.hasBall = false; hp.shootPow = -1;
    p.hasBall = true;
    const b = G.ball; b.state = 'held'; b.holder = idx; b.vx = b.vy = b.vz = 0;
    G.offenseTeam = p.team;
    p.trick = Math.min(100, p.trick + 10); gbCheck(p, idx);
    S.steal();
    if (idx === G.myIdx) showBanner('STEAL!', '', 700);
    }
  }
}
function tryPass(p, idx) {
  if (p.passCd > 0 || !p.hasBall) return;
  let best = -1, bestScore = -1;
  for (let j = 0; j < G.players.length; j++) {
    if (j === idx) continue;
    const q = G.players[j];
    if (!q.active || q.team !== p.team) continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.6) continue;
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    const score = ((dx * fx + dz * fz) / d) * 2 - d * 0.08;
    if (score > bestScore) { bestScore = score; best = j; }
  }
  if (best < 0) return;
  p.passCd = 0.8;
  p.hasBall = false; p.shootPow = -1;
  const b = G.ball, q = G.players[best];
  b.state = 'pass'; b.holder = -1; b.passTo = best;
  b.fx = p.x; b.fy = 1.4; b.fz = p.z;
  b.flyT = 0; b.flyDur = clamp(dist2d(p.x, p.z, q.x, q.z) * 0.05, 0.18, 0.5);
  S.pass();
}
function tryBlock(p, idx) {
  if (p.blockCd > 0) return;
  p.blockCd = 0.9;
  if (p.jumpT < 0) { p.jumpT = 0; p.jumpDur = 0.55; p.jumpH = 1.15; p.armUp = 1; S.block(); }
}
function trySwitch(p, idx) {
  if (p.swCd > 0) return;
  p.swCd = 2.5;
  const b = G.ball;
  const dx = b.x - p.x, dz = b.z - p.z, l = Math.hypot(dx, dz) || 1;
  p.dashT = 0.22; p.dashDx = dx / l; p.dashDz = dz / l; p.face = Math.atan2(dx, dz);
  S.cross();
}
function tryCut(p, idx) {
  if (p.cutCd > 0 || p.hasBall) return;
  p.cutCd = 1.6;
  const dx = HX - p.x, dz = HZ - p.z, l = Math.hypot(dx, dz) || 1;
  p.dashT = 0.28; p.dashDx = dx / l; p.dashDz = dz / l;
  S.cross();
}
function scoreBasket(idx, pts) {
  const p = G.players[idx], team = p.team;
  G.score[team] += pts;
  S.swish();
  showBanner(p.name.toUpperCase() + ' +' + pts, '', 800);
  if (pts === 3) { p.trick = Math.min(100, p.trick + 16); gbCheck(p, idx); }
  if (G.score[team] >= TARGET) {
    G.phase = 'over'; G.winner = team; S.buzzer();
    showGameOver();
  } else {
    resetPositions(1 - team);
    G.freezeT = 1.0;
    showBanner('CHECK', '', 700);
  }
}
function gainPossession(i) {
  const p = G.players[i];
  p.hasBall = true;
  const b = G.ball; b.state = 'held'; b.holder = i; b.vx = b.vy = b.vz = 0;
  if (b.mesh) b.mesh.visible = true; // v4 fix: keep the ball visible on possession changes
  G.offenseTeam = p.team;
}
function updateBall(dt) {
  const b = G.ball;
  if (b.state === 'held') {
    const p = G.players[b.holder];
    if (!p || !p.active) { b.state = 'loose'; b.vx = rand(-2, 2); b.vy = 3; b.vz = rand(1, 3); b.looseT = 0; return; }
    const ph = p.runPh;
    b.x = p.x + Math.sin(p.face) * 0.55;
    b.z = p.z + Math.cos(p.face) * 0.55;
    b.y = 0.28 + Math.abs(Math.sin(ph)) * (p.moving ? 0.5 : 0.34);
    const cyc = Math.floor(ph / Math.PI);
    if (cyc !== b.lastBounce) { b.lastBounce = cyc; S.bounce(); }
  } else if (b.state === 'fly') {
    b.flyT += dt;
    const t = clamp(b.flyT / b.flyDur, 0, 1);
    b.x = lerp(b.fx, b.tx, t); b.z = lerp(b.fz, b.tz, t);
    b.y = lerp(b.fy, b.ty, t) + 3.6 * t * (1 - t);
    if (t >= 1) {
      if (b.willScore) { scoreBasket(b.shooterIdx, b.pts); }
      else {
        S.rim();
        b.state = 'loose';
        b.vx = rand(-3.2, 3.2); b.vy = rand(2.2, 4.2); b.vz = rand(0.8, 3.6);
        b.looseT = 0;
      }
    }
  } else if (b.state === 'pass') {
    const q = G.players[b.passTo];
    if (!q || !q.active) { b.state = 'loose'; b.vx = rand(-2, 2); b.vy = 3; b.vz = rand(1, 3); b.looseT = 0; return; }
    b.flyT += dt;
    const t = clamp(b.flyT / b.flyDur, 0, 1);
    b.tx = q.x; b.ty = 1.1; b.tz = q.z;
    b.x = lerp(b.fx, b.tx, t); b.z = lerp(b.fz, b.tz, t);
    b.y = lerp(b.fy, b.ty, t) + 1.4 * t * (1 - t);
    let intercepted = false;
    for (let i = 0; i < G.players.length; i++) {
      const p = G.players[i];
      if (!p.active || p.team === q.team) continue;
      if (b.y < 2.2 && dist2d(p.x, p.z, b.x, b.z) < 0.85) {
        gainPossession(i); S.steal();
        if (i === G.myIdx) showBanner('INTERCEPTED!', '', 700);
        intercepted = true; break;
      }
    }
    if (!intercepted && t >= 1) gainPossession(b.passTo);
  } else if (b.state === 'loose') {
    b.looseT = (b.looseT || 0) + dt;
    b.vy -= GRAV * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < 0.17) { b.y = 0.17; b.vy *= -0.55; b.vx *= 0.9; b.vz *= 0.9; if (Math.abs(b.vy) < 0.9) b.vy = 0; if (Math.abs(b.vy) > 1.2) S.bounce(); }
    if (b.x > 7.4 || b.x < -7.4) { b.vx *= -0.7; b.x = clamp(b.x, -7.4, 7.4); }
    if (b.z > 6.9 || b.z < -6.9) { b.vz *= -0.7; b.z = clamp(b.z, -6.9, 6.9); }
    for (let i = 0; i < G.players.length; i++) {
      const p = G.players[i];
      if (!p.active) continue;
      if (b.y < 1.7 && dist2d(p.x, p.z, b.x, b.z) < 1.15) { gainPossession(i); break; }
    }
    if (G.mode === 'practice' && b.looseT > 1.4) { resetPositions(0); }
  }
}
function simTick(dt) {
  G.tick++;
  if (G.phase === 'countdown') {
    G.cdT -= dt;
    const n = Math.ceil(G.cdT);
    if (n < G.cdLast && n > 0) { G.cdLast = n; showBanner(String(n), '', 700); S.count(); }
    if (G.cdT <= 0) { G.phase = 'play'; showBanner('GO!', '', 700); S.go(); }
    return;
  }
  if (G.phase !== 'play') return;
  if (G.freezeT > 0) { G.freezeT -= dt; return; }
  for (let i = 0; i < G.players.length; i++) {
    const p = G.players[i];
    if (!p.active) continue;
    const inp = inpFor(i);
    p.stealCd = Math.max(0, p.stealCd - dt);
    p.crossCd = Math.max(0, p.crossCd - dt);
    p.passCd = Math.max(0, p.passCd - dt);
    p.blockCd = Math.max(0, p.blockCd - dt);
    p.swCd = Math.max(0, p.swCd - dt);
    p.cutCd = Math.max(0, p.cutCd - dt);
    p.stepCd = Math.max(0, p.stepCd - dt);
    p.postStr = !!(inp.postup && p.hasBall && dist2d(p.x, p.z, HX, HZ) < 4.5); // v4: post-up strength
    applyMovement(p, inp, dt);
    updateJump(p, dt);
    if (p.shootPow >= 0) {
      p.shootPow = Math.min(1, p.shootPow + dt / 0.9);
      p.armUp = Math.min(1, p.armUp + dt * 7);
      if (p.autoRel > 0) { p.autoRel -= dt; if (p.autoRel <= 0) releaseShot(p, i); } // v4: stepback auto-release
      else if (!inp.shootHeld) releaseShot(p, i);
    } else if (inp.shootHeld && p.hasBall && p.dashT <= 0 && p.stumble <= 0) {
      p.shootPow = 0; S.shoot();
    } else if (inp.quickShot && p.hasBall && p.dashT <= 0 && p.stumble <= 0) {
      p.shootPow = 0; p.autoRel = 0.6; S.shoot(); // v4: pro-stick flick-up jumper
    }
    if (inp.dribble) tryDribble(p, i, inp);
    if (inp.stepback) tryStepback(p, i);
    if (inp.steal) trySteal(p, i);
    if (inp.pass) tryPass(p, i);
    if (inp.block) tryBlock(p, i);
    if (inp.sw) trySwitch(p, i);
    if (inp.cut) tryCut(p, i);
    clearEdge(inp);
    if (p.shootPow < 0) p.armUp = Math.max(0, p.armUp - dt * 2.5);
  }
  updateBall(dt);
}

/* ================= GUEST: interpolation + local prediction ================= */
const render = { bx: 0, by: 1, bz: 2, init: false, prevPhase: 'lobby' };
function guestTick(dt) {
  const me = G.players[G.myIdx];
  if (me && G.phase === 'play') applyMovement(me, input, dt);
  const s = G.snap;
  if (!s) return;
  if (me) {
    const sp = s.ps[G.myIdx];
    if (sp) {
      const kc = 1 - Math.exp(-8 * dt);
      me.x = lerp(me.x, sp[0], kc); me.z = lerp(me.z, sp[1], kc);
      me.face = sp[4]; me.hasBall = !!sp[5]; me.armUp = sp[7];
      me.y = sp[6] ? 0.85 : 0;
      if (sp[8]) me.stumble = 0.25;
    }
  }
  const b = s.ball;
  if (!render.init) { render.bx = b.x; render.by = b.y; render.bz = b.z; render.init = true; }
  const k = 1 - Math.exp(-14 * dt);
  render.bx = lerp(render.bx, b.x, k); render.by = lerp(render.by, b.y, k); render.bz = lerp(render.bz, b.z, k);
  const n = Math.ceil(s.cdT);
  if (s.phase === 'countdown' && n < G.cdLast && n > 0) { G.cdLast = n; showBanner(String(n), '', 700); S.count(); }
  if (render.prevPhase === 'countdown' && s.phase === 'play') { showBanner('GO!', '', 700); S.go(); }
  render.prevPhase = s.phase;
}

/* ================= VISUALS + HUD ================= */
function updateVisuals(dt) {
  const b = G.ball;
  if (!b || !b.mesh) return;
  if (G.mode === 'guest' && G.snap) {
    const s = G.snap;
    for (let i = 0; i < G.players.length; i++) {
      const p = G.players[i], sp = s.ps[i];
      if (!sp || !p.mesh) continue;
      if (i === G.myIdx) { syncMesh(p); continue; }
      let rp = G.rpos[i];
      if (!rp) rp = G.rpos[i] = { x: sp[0], z: sp[1] };
      const k = 1 - Math.exp(-14 * dt);
      rp.x = lerp(rp.x, sp[0], k); rp.z = lerp(rp.z, sp[1], k);
      p.x = rp.x; p.z = rp.z; p.face = sp[4]; p.hasBall = !!sp[5]; p.armUp = sp[7];
      p.y = sp[6] ? 0.85 : 0; p.moving = !!sp[10];
      if (sp[8]) p.stumble = 0.25;
      p.mesh.grp.visible = !!sp[11];
      syncMesh(p);
    }
    b.mesh.position.set(render.bx, render.by, render.bz);
    b.mesh.rotation.x += dt * 5;
  } else {
    for (const p of G.players) if (p.active && p.mesh) syncMesh(p);
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.x += dt * (b.state === 'fly' || b.state === 'pass' ? 9 : 3);
  }
  const gl = G.gbFlash > 0 ? (0.5 + Math.sin(performance.now() / 55) * 0.5) : 0;
  b.mesh.material.emissive.setRGB(0.23 + gl * 0.55, 0.08 + gl * 0.3, gl * 0.05);
}
function updateButtons() {
  const show = (id, on) => { $(id).style.display = on ? 'flex' : 'none'; };
  const inGame = G.phase === 'play' || G.phase === 'countdown';
  // controller in use (connected + recent input) -> hide touch controls, show tiny pad icon
  const padActive = pad.connected && inGame && (performance.now() - pad.lastActivity < PAD_IDLE_MS);
  $('joy-zone').style.display = padActive ? 'none' : '';
  $('pro-zone').style.display = padActive ? 'none' : '';
  $('btns').style.display = padActive ? 'none' : '';
  const pi = $('pad-icon');
  if (pi) pi.style.display = padActive ? 'flex' : 'none';
  const me = G.players[G.myIdx];
  if (!me || !me.active || !inGame || padActive) {
    ['b-pass', 'b-cut', 'b-switch', 'b-sprint'].forEach(id => show(id, false));
    hide(ui.proHint);
    return;
  }
  const solo = G.mode === 'practice';
  const hasBall = me.hasBall, onOff = G.offenseTeam === me.team;
  show('b-pass', hasBall && !solo);
  show('b-cut', !hasBall && onOff && !solo);
  show('b-switch', !onOff && !solo);
  show('b-sprint', true);
  // one-time pro-stick coach mark
  if (!G._proHintShown) { G._proHintShown = true; show(ui.proHint); setTimeout(() => hide(ui.proHint), 5000); }
}
function updateHUD() {
  if (!G.mode) return;
  ui.scoreHome.textContent = G.score[0];
  ui.scoreAway.textContent = G.mode === 'practice' ? '–' : G.score[1];
  const me = G.players[G.myIdx];
  const myTeam = me ? me.team : 0;
  ui.sideHome.classList.toggle('mine', myTeam === 0);
  ui.sideAway.classList.toggle('mine', myTeam === 1 && G.mode !== 'practice');
  let trick = 0, gb = false, pow = -1;
  if (G.mode === 'guest' && G.snap && G.myIdx >= 0) {
    const sp = G.snap.ps[G.myIdx];
    trick = G.snap.trick[G.myIdx] || 0; gb = !!G.snap.gb[G.myIdx]; pow = sp ? sp[9] : -1;
  } else if (me) { trick = me.trick; gb = me.gb; pow = me.shootPow; }
  ui.trickFill.style.width = clamp(trick, 0, 100) + '%';
  ui.trickFill.classList.toggle('full', gb);
  if (pow >= 0 && G.phase === 'play') {
    show(ui.meter);
    ui.meterFill.style.width = (pow * 100) + '%';
    ui.meterNeedle.style.left = (pow * 100) + '%';
  } else hide(ui.meter);
  updateButtons();
}
function showGameOver() {
  hide(ui.controls); hide(ui.meter);
  if (G.mode === 'practice') ui.goTitle.textContent = 'NICE RUN!';
  else ui.goTitle.textContent = G.winner === 0 ? 'HOME WINS' : 'AWAY WINS';
  ui.goScore.textContent = G.mode === 'practice' ? G.score[0] + ' PTS' : G.score[0] + ' : ' + G.score[1];
  show(ui.gameover);
  if (G.mode === 'host' || G.mode === 'practice') { show(ui.btnRematch); hide(ui.goWait); }
  else { hide(ui.btnRematch); show(ui.goWait); }
}

/* ================= FLOW ================= */
let bcTimer = null;
function checkOrientation() {
  // v4: Hoop Dreams plays in landscape — portrait shows a full-screen overlay + pauses
  const portrait = innerHeight > innerWidth;
  const active = (G.phase === 'play' || G.phase === 'countdown') && (G.mode === 'host' || G.mode === 'guest' || G.mode === 'practice');
  if (portrait && active) {
    show(ui.rotateOverlay);
    if (G.mode === 'host' || G.mode === 'practice') G.paused = true;
    G.rotPause = true;
  } else {
    hide(ui.rotateOverlay);
    if (G.mode === 'host' || G.mode === 'practice') G.paused = false;
    G.rotPause = false;
  }
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 300));
function startCountdown() {
  hide(ui.lobby); hide(ui.lobbyg); hide(ui.menu); hide(ui.gameover);
  show(ui.hud); show(ui.controls);
  ui.hudCode.textContent = (G.mode === 'practice' ? 'PRACTICE' : 'ROOM ' + G.code);
  // v4: try to lock landscape (works on Android Chrome; iOS Safari ignores gracefully)
  try {
    if (screen.orientation && screen.orientation.lock) {
      const p = screen.orientation.lock('landscape');
      if (p && p.catch) p.catch(() => {});
    }
  } catch (_) {}
  resetMatch();
  G.paused = false;
  G.phase = 'countdown'; G.cdT = 3.4; G.cdLast = 4; render.prevPhase = 'lobby'; G.overShown = false;
  if (G.mode === 'host' && !bcTimer) bcTimer = setInterval(hostBroadcast, 50);
  checkOrientation();
}
function startPractice() {
  G.mode = 'practice'; G.myIdx = 0;
  for (const p of G.players) if (p.mesh) scene.remove(p.mesh.grp);
  G.players = [newPlayer('YOU', 0)];
  G.rpos = {};
  buildPlayers();
  startCountdown();
}
function wireMenu() {
  document.addEventListener('click', e => { if (e.target && e.target.tagName === 'BUTTON') e.target.blur(); });
  $('btn-host').onclick = () => { audio(); setupHost(); };
  $('btn-join').onclick = () => { audio(); hide(ui.menu); show(ui.joinui); setTimeout(() => ui.joinCode.focus(), 300); };
  $('btn-practice').onclick = () => { audio(); showLocate('practice'); };
  $('btn-cancel-lobby').onclick = () => location.reload();
  $('btn-cancel-lobbyg').onclick = () => location.reload();
  $('btn-cancel-join').onclick = () => { hide(ui.joinui); show(ui.menu); };
  $('btn-start').onclick = () => { audio(); hostStart(); };
  $('btn-do-join').onclick = () => {
    const c = ui.joinCode.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(c)) { ui.joinStatus.textContent = 'Enter the 4-letter code.'; return; }
    ui.joinStatus.textContent = 'Connecting…';
    setupGuest(c, ui.joinName.value);
  };
  ui.joinCode.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-do-join').click(); e.stopPropagation(); });
  ui.joinName.addEventListener('keydown', e => e.stopPropagation());
  ui.hostName.addEventListener('keydown', e => e.stopPropagation());
  $('btn-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(ui.shareLink.value); $('btn-copy').textContent = 'COPIED'; }
    catch (_) { ui.shareLink.select(); document.execCommand('copy'); }
    setTimeout(() => $('btn-copy').textContent = 'COPY', 1500);
  };
  $('btn-mute').onclick = e => { muted = !muted; e.target.style.opacity = muted ? 0.35 : 1; if (!muted) audio(); };
  $('pad-icon').onclick = () => { audio(); onPadStart(); };
  $('btn-quit').onclick = () => location.reload();
  $('btn-go-quit').onclick = () => location.reload();
  $('btn-rematch').onclick = () => {
    hide(ui.gameover); show(ui.controls);
    resetMatch(); G.phase = 'countdown'; G.cdT = 3.4; G.cdLast = 4;
  };
  // v4: Mapillary token settings — free real-photo backdrops, no rebuild needed
  ui.mlyToken.value = mlyToken();
  ui.mlyToken.addEventListener('keydown', e => e.stopPropagation());
  ui.btnMlySave.onclick = () => {
    audio();
    const v = ui.mlyToken.value.trim();
    try {
      if (v) localStorage.setItem('hd_mly_token', v);
      else localStorage.removeItem('hd_mly_token');
    } catch (_) {}
    ui.mlyStatus.textContent = v
      ? 'Saved — real photos load automatically when you pick a court.'
      : 'Cleared — stylized backdrops only.';
  };
}

/* ================= MAIN LOOP + BOOT ================= */
let lastT = 0, acc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, ((t - lastT) / 1000) || 0.016); lastT = t;
  pollKeys();
  pollGamepad();
  if (G.mode === 'host' || G.mode === 'practice') {
    if (!G.paused) {
      acc += dt; let n = 0;
      while (acc >= 1 / 60 && n < 4) { simTick(1 / 60); acc -= 1 / 60; n++; }
      if (n === 4) acc = 0;
    }
  } else if (G.mode === 'guest') guestTick(dt);
  updateVisuals(dt); updateHUD();
  if (G.gbFlash > 0) G.gbFlash = Math.max(0, G.gbFlash - dt * 1.4);
  renderer.render(scene, camera);
}
function boot() {
  initThree();
  G.ball = newBall(); G.ball.mesh = makeBallMesh();
  G.ball.mesh.visible = false;
  wireMenu();
  wireLocate();
  const q = new URLSearchParams(location.search).get('join');
  if (q && /^[a-z0-9]{4}$/i.test(q)) { hide(ui.menu); show(ui.joinui); ui.joinCode.value = q.toUpperCase(); }
  requestAnimationFrame(loop);
}
boot();
