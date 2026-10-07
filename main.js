import * as THREE from 'three';

/* ============================================================
   CONFIG
   ============================================================ */
const CONFIG = {
  world: { groundSize: 220, playableRadius: 55 },
  player: { radius: 0.45, maxSpeed: 6.5, acceleration: 30, deceleration: 22, turnSpeed: 14 },
  camera: {
    distance: 8, minPitch: -0.10, maxPitch: 1.15,
    sensitivityMouse: 0.0045, sensitivityTouch: 0.006,
    smoothYaw: 16, smoothPitch: 16, smoothPos: 14,
    collisionPadding: 0.5, minDist: 2.0, minY: 0.8, lookHeight: 1.25, extraHeight: 0.6,
  },
  mining: {
    range: 3.5, minRange: 0.9, baseDamage: 20,
    attackDuration: 0.55, hitTime: 0.42, cooldown: 0.80,
    faceSpeed: 12, directionWeight: 0.65, distanceWeight: 0.35,
  },
  rocks: {
    respawnEnabled: true, respawnTime: 30000,
    types: {
      small: { label: 'SMALL ROCK', maxHealth: 50, hardness: 1, requiredToolLevel: 1, scale: 0.6, color: 0x8a8f98, dropRange: [1, 2] },
      medium: { label: 'STONE ROCK', maxHealth: 100, hardness: 2, requiredToolLevel: 1, scale: 1.0, color: 0x808a94, dropRange: [2, 4] },
      large: { label: 'LARGE ROCK', maxHealth: 200, hardness: 3, requiredToolLevel: 2, scale: 1.5, color: 0x6b7680, dropRange: [3, 7] },
    },
  },
  effects: { damageNumberPoolSize: 24, debrisPerBreak: 16, debrisLife: 0.7 },
  detector: {
    range: 30, scanInterval: 0.15, signalNoise: 0.05, noiseSmoothSpeed: 6,
    markerDistance: 5, targetLockDistance: 2.5, rarityWeight: 0.35,
    beepMinInterval: 1.1, beepMaxInterval: 0.12,
  },
  minerals: {
    coal:    { name: 'COAL',    rarity: 'common',    rarityWeight: 1.0, color: 0x3a3a3a, glowColor: 0x222222, detectionRange: 22, depth: 3,  value: 10 },
    iron:    { name: 'IRON',    rarity: 'common',    rarityWeight: 1.1, color: 0xb07358, glowColor: 0x7a3a1a, detectionRange: 24, depth: 6,  value: 18 },
    copper:  { name: 'COPPER',  rarity: 'uncommon',  rarityWeight: 1.4, color: 0xd47a3a, glowColor: 0x8a3a0a, detectionRange: 26, depth: 10, value: 30 },
    gold:    { name: 'GOLD',    rarity: 'rare',      rarityWeight: 2.0, color: 0xffd93a, glowColor: 0xa87a00, detectionRange: 30, depth: 18, value: 100 },
    diamond: { name: 'DIAMOND', rarity: 'very_rare', rarityWeight: 3.2, color: 0x6ee0ff, glowColor: 0x1a708a, detectionRange: 34, depth: 30, value: 500 },
  },
  mineralNodes: { count: 12, minDistanceFromSpawn: 8, minDistanceBetween: 6, radiusRange: [3, 8] },

  // ---- PHASE 4 ----
  oreTypes: {
    coal:    { name: 'Coal',    rarity: 'common',    baseValue: 10,  weight: 1.0, icon: '🪨', color: 0x2a2a2a, glowColor: 0x101010 },
    iron:    { name: 'Iron',    rarity: 'common',    baseValue: 18,  weight: 1.2, icon: '🔩', color: 0xb07358, glowColor: 0x5a2a10 },
    copper:  { name: 'Copper',  rarity: 'uncommon',  baseValue: 30,  weight: 1.3, icon: '🟤', color: 0xd47a3a, glowColor: 0x8a3a0a },
    gold:    { name: 'Gold',    rarity: 'rare',      baseValue: 100, weight: 1.5, icon: '🟡', color: 0xffd93a, glowColor: 0xa87a00 },
    diamond: { name: 'Diamond', rarity: 'very_rare', baseValue: 500, weight: 0.5, icon: '💎', color: 0x6ee0ff, glowColor: 0x1a708a },
  },
  inventory: {
    maxWeight: 20,          // kg
  },
  pickup: {
    range: 2.5,             // pickup distance
    entityRadius: 0.18,     // visual size of ore chunk
    bobSpeed: 2.5,
    bobHeight: 0.12,
    spinSpeed: 1.4,
    dropDelay:0.7,
  },
  sellZone: {
    position: { x: -22, z: 14 },
    radius: 5,
  },
  save: {
    key: 'mining_simulator_save',
    throttleMs: 2000,
  },
};

const PLAYER_STATE = Object.freeze({ IDLE: 'IDLE', WALK: 'WALK', MINING: 'MINING' });
const DETECTOR_STATE = Object.freeze({ OFF: 'OFF', SCANNING: 'SCANNING', TARGET_FOUND: 'TARGET_FOUND' });
const CONTEXT_ACTION = Object.freeze({ NONE: 'NONE', MINE: 'MINE', PICKUP: 'PICKUP', SELL: 'SELL' });

const RARITY_LABEL = {
  common: 'COMMON', uncommon: 'UNCOMMON', rare: 'RARE', very_rare: 'VERY RARE',
};

/* ============================================================
   GRAPHICS QUALITY
   ============================================================ */
const QUALITY_PRESETS = {
  LOW:    { maxPixelRatio: 1.0, shadows: false, shadowMapSize: 512,  antialias: false, shadowType: THREE.BasicShadowMap,    fogNear: 35, fogFar: 85,  rockCount: 26, treeCount: 8,  debrisMultiplier: 0.6 },
  MEDIUM: { maxPixelRatio: 1.5, shadows: true,  shadowMapSize: 1024, antialias: true,  shadowType: THREE.PCFShadowMap,      fogNear: 45, fogFar: 115, rockCount: 38, treeCount: 14, debrisMultiplier: 1.0 },
  HIGH:   { maxPixelRatio: 2.0, shadows: true,  shadowMapSize: 2048, antialias: true,  shadowType: THREE.PCFSoftShadowMap,  fogNear: 55, fogFar: 145, rockCount: 50, treeCount: 20, debrisMultiplier: 1.3 },
};

class GraphicsQuality {
  constructor() { this.level = this.detect(); this.preset = QUALITY_PRESETS[this.level]; }
  detect() {
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    if (isMobile) return 'LOW';
    const cores = navigator.hardwareConcurrency;
    const mem = navigator.deviceMemory;
    if ((cores && cores <= 4) || (mem && mem <= 4)) return 'MEDIUM';
    return 'HIGH';
  }
  setLevel(level) { if (!QUALITY_PRESETS[level]) return; this.level = level; this.preset = QUALITY_PRESETS[level]; }
  getPixelRatio() { return Math.min(window.devicePixelRatio || 1, this.preset.maxPixelRatio); }
}

/* ============================================================
   EVENT BUS
   ============================================================ */
class EventBus {
  constructor() { this.map = new Map(); }
  on(event, fn) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    const s = this.map.get(event);
    if (s) s.delete(fn);
  }
  emit(event, data) {
    const s = this.map.get(event);
    if (!s) return;
    for (const fn of s) {
      try { fn(data); }
      catch (err) { console.error('[EventBus] handler error for', event, err); }
    }
  }
}

const EVENTS = Object.freeze({
  ROCK_DESTROYED: 'ROCK_DESTROYED',
  ORE_DROPPED: 'ORE_DROPPED',
  ORE_PICKED_UP: 'ORE_PICKED_UP',
  INVENTORY_CHANGED: 'INVENTORY_CHANGED',
  INVENTORY_FULL: 'INVENTORY_FULL',
  PLAYER_ENTER_SELL_ZONE: 'PLAYER_ENTER_SELL_ZONE',
  PLAYER_EXIT_SELL_ZONE: 'PLAYER_EXIT_SELL_ZONE',
  ORE_SOLD: 'ORE_SOLD',
  MONEY_CHANGED: 'MONEY_CHANGED',
  SAVE_CHANGED: 'SAVE_CHANGED',
});

/* ============================================================
   COHERENT JITTER HELPER
   ============================================================ */
function coherentJitter(geo, amount) {
  const pos = geo.attributes.position;
  const cache = new Map();
  const PRECISION = 1e4;
  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i), oy = pos.getY(i), oz = pos.getZ(i);
    const kx = Math.round(ox * PRECISION), ky = Math.round(oy * PRECISION), kz = Math.round(oz * PRECISION);
    const key = kx + '_' + ky + '_' + kz;
    let off = cache.get(key);
    if (!off) {
      off = {
        x: (hashRand(kx, ky, kz, 1) * 2 - 1) * amount,
        y: (hashRand(kx, ky, kz, 2) * 2 - 1) * amount * 0.7,
        z: (hashRand(kx, ky, kz, 3) * 2 - 1) * amount,
      };
      cache.set(key, off);
    }
    pos.setXYZ(i, ox + off.x, oy + off.y, oz + off.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}
function hashRand(x, y, z, seed) {
  let h = (x * 374761393) + (y * 668265263) + (z * 2147483647) + (seed * 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

/* ============================================================
   INPUT STATE + MANAGER
   ============================================================ */
class InputState {
  constructor() {
    this.moveX = 0; this.moveZ = 0;
    this.cameraDX = 0; this.cameraDY = 0;
    this.minePressed = false;       // generic "action" edge trigger (E / click / context btn)
    this.detectorToggled = false;
    this.inventoryToggled = false;
  }
  consumeCameraDelta() { const d = { dx: this.cameraDX, dy: this.cameraDY }; this.cameraDX = 0; this.cameraDY = 0; return d; }
  consumeMinePressed() { const v = this.minePressed; this.minePressed = false; return v; }
  consumeDetectorToggled() { const v = this.detectorToggled; this.detectorToggled = false; return v; }
  consumeInventoryToggled() { const v = this.inventoryToggled; this.inventoryToggled = false; return v; }
}

class InputManager {
  constructor(inputState) {
    this.input = inputState;
    this.keys = Object.create(null);
    this.joystick = { x: 0, y: 0 };
    this.mouseDragging = false;
    this.lastMouseX = 0; this.lastMouseY = 0;
    this._mouseDownAt = 0; this._mouseMoved = 0;
    this._accCamDX = 0; this._accCamDY = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    const prewarm = () => {
      window.removeEventListener('pointerdown', prewarm);
      window.removeEventListener('keydown', prewarm);
      window.removeEventListener('touchstart', prewarm);
      window.dispatchEvent(new CustomEvent('prewarm-audio'));
    };
    window.addEventListener('pointerdown', prewarm, { once: true, passive: true });
    window.addEventListener('keydown', prewarm, { once: true });
    window.addEventListener('touchstart', prewarm, { once: true, passive: true });
  }

  addCameraDelta(dx, dy) { this._accCamDX += dx; this._accCamDY += dy; }
  triggerAction() { this.input.minePressed = true; }
  toggleDetector() { this.input.detectorToggled = true; }
  toggleInventory() { this.input.inventoryToggled = true; }

  update() {
    let kx = 0, kz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    kz += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  kz -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  kx -= 1;
    const kLen = Math.hypot(kx, kz);
    if (kLen > 1) { kx /= kLen; kz /= kLen; }
    let mx = kx + this.joystick.x;
    let mz = kz + this.joystick.y;
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1) { mx /= mLen; mz /= mLen; }
    this.input.moveX = mx;
    this.input.moveZ = mz;
    this.input.cameraDX = this._accCamDX;
    this.input.cameraDY = this._accCamDY;
    this._accCamDX = 0; this._accCamDY = 0;
  }

  _onKeyDown(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE' && !e.repeat) this.input.minePressed = true;
    if (e.code === 'KeyQ' && !e.repeat) this.input.detectorToggled = true;
    if (e.code === 'KeyI' && !e.repeat) this.input.inventoryToggled = true;
    if (e.code === 'Escape' && !e.repeat) this.input.detectorToggled = true;
    this.keys[e.code] = true;
    if (e.code === 'Digit1') window.dispatchEvent(new CustomEvent('quality', { detail: 'LOW' }));
    if (e.code === 'Digit2') window.dispatchEvent(new CustomEvent('quality', { detail: 'MEDIUM' }));
    if (e.code === 'Digit3') window.dispatchEvent(new CustomEvent('quality', { detail: 'HIGH' }));
  }
  _onKeyUp(e) { this.keys[e.code] = false; }
  _onBlur() { this.keys = Object.create(null); this.mouseDragging = false; this.joystick.x = 0; this.joystick.y = 0; }

  _onMouseDown(e) {
    if (e.button === 0 || e.button === 2) {
      this.mouseDragging = true;
      this.lastMouseX = e.clientX; this.lastMouseY = e.clientY;
      this._mouseDownAt = performance.now(); this._mouseMoved = 0;
      e.preventDefault();
    }
  }
  _onMouseMove(e) {
    if (!this.mouseDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX; this.lastMouseY = e.clientY;
    this._mouseMoved += Math.abs(dx) + Math.abs(dy);
    this.addCameraDelta(dx * CONFIG.camera.sensitivityMouse, dy * CONFIG.camera.sensitivityMouse);
  }
  _onMouseUp(e) {
    if (e.button === 0 && this.mouseDragging) {
      const dt = performance.now() - this._mouseDownAt;
      if (this._mouseMoved < 6 && dt < 300) this.input.minePressed = true;
    }
    this.mouseDragging = false;
  }
}

/* ============================================================
   VIRTUAL JOYSTICK + CAMERA TOUCH (unchanged from Phase 3)
   ============================================================ */
class VirtualJoystick {
  constructor(zoneEl, baseEl, knobEl, inputManager) {
    this.zone = zoneEl; this.base = baseEl; this.knob = knobEl; this.input = inputManager;
    this.touchId = null; this.centerX = 0; this.centerY = 0; this.maxRadius = 60;
    this.zone.addEventListener('touchstart', e => this._onStart(e), { passive: false });
    this.zone.addEventListener('touchmove',  e => this._onMove(e),  { passive: false });
    this.zone.addEventListener('touchend',   e => this._onEnd(e),   { passive: false });
    this.zone.addEventListener('touchcancel',e => this._onEnd(e),   { passive: false });
  }
  _onStart(e) {
    e.preventDefault();
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    const rect = this.base.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.maxRadius = rect.width * 0.36;
    this._apply(t.clientX, t.clientY);
  }
  _onMove(e) {
    if (this.touchId === null) return;
    e.preventDefault();
    for (const t of e.touches) if (t.identifier === this.touchId) { this._apply(t.clientX, t.clientY); return; }
  }
  _onEnd(e) {
    if (this.touchId === null) return;
    for (const t of e.changedTouches) if (t.identifier === this.touchId) {
      this.touchId = null;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.input.joystick.x = 0; this.input.joystick.y = 0; return;
    }
  }
  _apply(clientX, clientY) {
    let dx = clientX - this.centerX, dy = clientY - this.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.maxRadius) { dx = (dx / dist) * this.maxRadius; dy = (dy / dist) * this.maxRadius; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.input.joystick.x = dx / this.maxRadius;
    this.input.joystick.y = -dy / this.maxRadius;
  }
}

class CameraTouch {
  constructor(zoneEl, inputManager) {
    this.zone = zoneEl; this.input = inputManager;
    this.touchId = null; this.lastX = 0; this.lastY = 0;
    this.zone.addEventListener('touchstart', e => this._onStart(e), { passive: false });
    this.zone.addEventListener('touchmove',  e => this._onMove(e),  { passive: false });
    this.zone.addEventListener('touchend',   e => this._onEnd(e),   { passive: false });
    this.zone.addEventListener('touchcancel',e => this._onEnd(e),   { passive: false });
  }
  _onStart(e) {
    e.preventDefault();
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    this.lastX = t.clientX; this.lastY = t.clientY;
  }
  _onMove(e) {
    if (this.touchId === null) return;
    e.preventDefault();
    for (const t of e.touches) if (t.identifier === this.touchId) {
      const dx = t.clientX - this.lastX, dy = t.clientY - this.lastY;
      this.lastX = t.clientX; this.lastY = t.clientY;
      this.input.addCameraDelta(dx * CONFIG.camera.sensitivityTouch, dy * CONFIG.camera.sensitivityTouch);
      return;
    }
  }
  _onEnd(e) {
    if (this.touchId === null) return;
    for (const t of e.changedTouches) if (t.identifier === this.touchId) { this.touchId = null; return; }
  }
}

/* ============================================================
   DAMAGE NUMBER POOL + DEBRIS SYSTEM
   ============================================================ */
class DamageNumberPool {
  constructor(layerEl) {
    this.layer = layerEl; this.pool = []; this.active = [];
    for (let i = 0; i < CONFIG.effects.damageNumberPoolSize; i++) {
      const el = document.createElement('div');
      el.className = 'damage-number';
      el.style.display = 'none';
      this.layer.appendChild(el);
      this.pool.push(el);
    }
    this._v = new THREE.Vector3();
  }
  spawn(worldPos, camera, text, isCrit = false) {
    const el = this.pool.pop(); if (!el) return;
    this._v.copy(worldPos).project(camera);
    const x = ( this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    el.textContent = text;
    el.classList.toggle('crit', isCrit);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.display = 'block';
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    this.active.push({ el, life: 0.9 });
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i]; item.life -= dt;
      if (item.life <= 0) {
        item.el.style.display = 'none';
        this.active.splice(i, 1); this.pool.push(item.el);
      }
    }
  }
}

class DebrisSystem {
  constructor(scene) { this.scene = scene; this.active = []; this._gravity = -18; }
  spawn(position, color, count, quality) {
    const n = Math.max(4, Math.round(count * quality.preset.debrisMultiplier));
    const geo = new THREE.TetrahedronGeometry(0.12, 0);
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.6;
      mesh.position.y += Math.random() * 0.6;
      mesh.position.z += (Math.random() - 0.5) * 0.6;
      mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
      mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      this.scene.add(mesh);
      this.active.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6),
        angVel: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        life: CONFIG.effects.debrisLife, maxLife: CONFIG.effects.debrisLife,
      });
    }
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]; p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.active.splice(i, 1); continue; }
      p.vel.y += this._gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vel.y *= -0.35; p.vel.x *= 0.7; p.vel.z *= 0.7; }
      p.mesh.rotation.x += p.angVel.x * dt;
      p.mesh.rotation.y += p.angVel.y * dt;
      p.mesh.rotation.z += p.angVel.z * dt;
      const t = p.life / p.maxLife;
      p.mesh.scale.multiplyScalar(0.985 + 0.015 * t);
    }
  }
}

/* ============================================================
   PHASE 4 — INVENTORY SYSTEM (data only, no DOM)
   ============================================================ */
class InventorySystem {
  constructor(eventBus, maxWeight) {
    this.eventBus = eventBus;
    this.maxWeight = maxWeight;
    this.items = new Map(); // itemId → quantity
  }

  /** Returns { added, overflow } */
  addItem(itemId, qty = 1) {
    const ore = CONFIG.oreTypes[itemId];
    if (!ore) return { added: 0, overflow: qty };
    if (qty <= 0) return { added: 0, overflow: 0 };

    const perWeight = ore.weight;
    const roomWeight = this.maxWeight - this.getTotalWeight();
    const maxAddableByWeight = Math.floor(roomWeight / perWeight);
    const added = Math.min(qty, maxAddableByWeight);
    const overflow = qty - added;

    if (added > 0) {
      const cur = this.items.get(itemId) || 0;
      this.items.set(itemId, cur + added);
      this.eventBus.emit(EVENTS.INVENTORY_CHANGED, { itemId, added, overflow });
    }
    if (overflow > 0) {
      this.eventBus.emit(EVENTS.INVENTORY_FULL, { itemId, overflow });
    }
    return { added, overflow };
  }

  removeItem(itemId, qty = 1) {
    const cur = this.items.get(itemId) || 0;
    const removed = Math.min(cur, qty);
    if (removed <= 0) return 0;
    const next = cur - removed;
    if (next <= 0) this.items.delete(itemId);
    else this.items.set(itemId, next);
    this.eventBus.emit(EVENTS.INVENTORY_CHANGED, { itemId, removed });
    return removed;
  }

  getQuantity(itemId) { return this.items.get(itemId) || 0; }
  getTotalWeight() {
    let w = 0;
    for (const [id, qty] of this.items) {
      const ore = CONFIG.oreTypes[id]; if (!ore) continue;
      w += qty * ore.weight;
    }
    return w;
  }
  hasSpace(itemId, qty = 1) {
    const ore = CONFIG.oreTypes[itemId]; if (!ore) return false;
    return this.getTotalWeight() + ore.weight * qty <= this.maxWeight + 1e-6;
  }
  isEmpty() { return this.items.size === 0; }
  clear() {
    this.items.clear();
    this.eventBus.emit(EVENTS.INVENTORY_CHANGED, { cleared: true });
  }
  /** Iterate entries sorted by rarity desc (for UI). */
  getEntries() {
    const rarityRank = { common: 0, uncommon: 1, rare: 2, very_rare: 3 };
    const arr = [];
    for (const [id, qty] of this.items) {
      const ore = CONFIG.oreTypes[id]; if (!ore) continue;
      arr.push({ itemId: id, qty, ore });
    }
    arr.sort((a, b) => (rarityRank[b.ore.rarity] - rarityRank[a.ore.rarity]) || a.itemId.localeCompare(b.itemId));
    return arr;
  }
  toJSON() {
    const obj = {};
    for (const [id, qty] of this.items) obj[id] = qty;
    return obj;
  }
  fromJSON(data) {
    this.items.clear();
    if (!data || typeof data !== 'object') return;
    for (const id in data) {
      if (CONFIG.oreTypes[id] && typeof data[id] === 'number' && data[id] > 0) {
        this.items.set(id, data[id]);
      }
    }
    this.eventBus.emit(EVENTS.INVENTORY_CHANGED, { loaded: true });
  }
}

/* ============================================================
   PHASE 4 — CURRENCY SYSTEM
   ============================================================ */
class CurrencySystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.money = 0;
  }
  add(amount) {
    if (amount <= 0) return;
    this.money += amount;
    this.eventBus.emit(EVENTS.MONEY_CHANGED, { money: this.money, delta: amount });
  }
  spend(amount) {
    if (amount <= 0 || this.money < amount) return false;
    this.money -= amount;
    this.eventBus.emit(EVENTS.MONEY_CHANGED, { money: this.money, delta: -amount });
    return true;
  }
  get() { return this.money; }
  set(v) { this.money = v; this.eventBus.emit(EVENTS.MONEY_CHANGED, { money: v, delta: 0 }); }
}

/* ============================================================
   PHASE 4 — ORE ENTITY (pickup)
   ============================================================ */
class OreEntity {
  constructor(itemId, qty, x, z, scene) {
    this.itemId = itemId;
    this.qty = qty;
    this.scene = scene;
    this.x = x; this.z = z;
    this.y = 0.4;
    this._t = Math.random() * 10;
    this._baseY = 0.4;
    this.collected = false;
    this._spawnTime = performance.now();

    const def = CONFIG.oreTypes[itemId];
    this.group = new THREE.Group();
    this.group.position.set(x, this.y, z);

    const geo = new THREE.OctahedronGeometry(CONFIG.pickup.entityRadius, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.glowColor,
      emissiveIntensity: 0.35,
      flatShading: true,
      roughness: 0.4,
      metalness: 0.2,
    });
    this.crystal = new THREE.Mesh(geo, mat);
    this.crystal.castShadow = true;
    this.group.add(this.crystal);

    const geo2 = new THREE.OctahedronGeometry(CONFIG.pickup.entityRadius * 0.7, 0);
    const c2 = new THREE.Mesh(geo2, mat);
    c2.position.set(0.12, 0.05, -0.06);
    c2.rotation.set(Math.random(), Math.random(), Math.random());
    this.group.add(c2);

    scene.add(this.group);

    // ---- DOM label (world-projected) ----
    this._projVec = new THREE.Vector3();
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'ore-label';
    this.labelEl.style.display = 'none';
    this._refreshLabelContent();
    document.getElementById('ore-label-layer').appendChild(this.labelEl);
  }

  _refreshLabelContent() {
    const def = CONFIG.oreTypes[this.itemId];
    const total = def.baseValue * this.qty;
    this.labelEl.innerHTML =
      `<span class="ore-label-icon">${def.icon}</span>` +
      `<span class="ore-label-name">${def.name.toUpperCase()}</span>` +
      `<span class="ore-label-qty">×${this.qty}</span>` +
      `<span class="ore-label-value">$${total}</span>`;
  }

  canPickup() {
    return performance.now() - this._spawnTime > CONFIG.pickup.dropDelay * 1000;
  }

  update(dt) {
    this._t += dt;
    const bob = Math.sin(this._t * CONFIG.pickup.bobSpeed) * CONFIG.pickup.bobHeight;
    this.group.position.y = this._baseY + bob;
    this.crystal.rotation.y += dt * CONFIG.pickup.spinSpeed;
  }

  /** Project label to screen. showLabel controls distance-based visibility. */
  updateLabel(camera, showLabel) {
    if (this.collected || !showLabel) {
      if (this.labelEl.style.display !== 'none') this.labelEl.style.display = 'none';
      return;
    }
    this._projVec.copy(this.group.position);
    this._projVec.y += 0.55;
    this._projVec.project(camera);
    if (this._projVec.z > 1) {
      if (this.labelEl.style.display !== 'none') this.labelEl.style.display = 'none';
      return;
    }
    const x = ( this._projVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._projVec.y * 0.5 + 0.5) * window.innerHeight;
    this.labelEl.style.display = 'flex';
    this.labelEl.style.left = x + 'px';
    this.labelEl.style.top = y + 'px';
  }

  setQty(newQty) {
    this.qty = newQty;
    this._refreshLabelContent();
  }

  destroy() {
    this.collected = true;
    this.scene.remove(this.group);
    if (this.labelEl && this.labelEl.parentNode) {
      this.labelEl.parentNode.removeChild(this.labelEl);
    }
    this.group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}

/* ============================================================
   PHASE 4 — PICKUP SYSTEM
   ============================================================ */
class PickupSystem {
  constructor(scene, inventory, eventBus, camera) {
    this.scene = scene;
    this.inventory = inventory;
    this.eventBus = eventBus;
    this.camera = camera;
    this.entities = [];
    this.nearest = null;
    this._labelMaxDist = 15;      // show label only within 15m
    this._labelMaxDistSq = this._labelMaxDist * this._labelMaxDist;
  }

  spawnOre(itemId, x, z, qty = 1) {
    const e = new OreEntity(itemId, qty, x, z, this.scene);
    this.entities.push(e);
    this.eventBus.emit(EVENTS.ORE_DROPPED, { itemId, qty, x, z });
    return e;
  }

  update(dt, playerPos) {
    let nearest = null;
    let nearestDistSq = Infinity;
    const r = CONFIG.pickup.range;
    const rSq = r * r;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.collected) { this.entities.splice(i, 1); continue; }
      e.update(dt);

      const dx = e.x - playerPos.x;
      const dz = e.z - playerPos.z;
      const dSq = dx * dx + dz * dz;

      // Label visibility: within 15m
      const showLabel = dSq < this._labelMaxDistSq;
      e.updateLabel(this.camera, showLabel);

      // Nearest (only counting as target if pickup delay passed)
      if (dSq < rSq && dSq < nearestDistSq && e.canPickup()) {
        nearestDistSq = dSq;
        nearest = e;
      }
    }
    this.nearest = nearest;
  }

  pickupNearest() {
    const e = this.nearest;
    if (!e || e.collected) return false;

    const { added, overflow } = this.inventory.addItem(e.itemId, e.qty);

    if (added > 0) {
      this.eventBus.emit(EVENTS.ORE_PICKED_UP, { itemId: e.itemId, qty: added });
    }

    if (overflow <= 0) {
      e.destroy();
      this.nearest = null;
      return added > 0;
    } else {
      e.setQty(overflow);
      return false;
    }
  }
}

/* ============================================================
   PHASE 4 — SELL ZONE (3D marker + trigger)
   ============================================================ */
class SellZone {
  constructor(scene, eventBus, position, radius) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.position = position;
    this.radius = radius;
    this.playerInside = false;

    const g = new THREE.Group();
    g.position.set(position.x, 0, position.z);

    // Platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.15, 24),
      new THREE.MeshStandardMaterial({ color: 0x6b7280, flatShading: true, roughness: 0.9 })
    );
    platform.position.y = 0.075;
    platform.receiveShadow = true;
    g.add(platform);

    // Ring edge
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 6, 32),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x166534, emissiveIntensity: 0.4, flatShading: true })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    g.add(ring);

    // Awning structure (simple roof)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, flatShading: true, roughness: 0.9 });
    for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), postMat);
      post.position.set(px, 1.6, pz);
      post.castShadow = true;
      g.add(post);
    }
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.2, 7.2),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true, roughness: 0.9 })
    );
    roof.position.y = 3.3;
    roof.castShadow = true;
    g.add(roof);

    // Sign
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, emissive: 0x166534, emissiveIntensity: 0.6, flatShading: true,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.15), signMat);
    sign.position.set(0, 3.8, -3.3);
    g.add(sign);

    // Floor marker disc (pulsing)
    this.disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.85, 32),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80, transparent: true, opacity: 0.18,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.16;
    g.add(this.disc);

    scene.add(g);
    this.group = g;
  }

  update(dt, playerPos) {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const inside = (dx * dx + dz * dz) <= (this.radius * this.radius);

    if (inside !== this.playerInside) {
      this.playerInside = inside;
      this.eventBus.emit(inside ? EVENTS.PLAYER_ENTER_SELL_ZONE : EVENTS.PLAYER_EXIT_SELL_ZONE);
    }

    const t = performance.now() * 0.002;
    this.disc.material.opacity = 0.12 + Math.sin(t) * 0.06;
  }

  containsPoint(x, z) {
    const dx = x - this.position.x, dz = z - this.position.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
  }
}

/* ============================================================
   PHASE 4 — SELLING SYSTEM
   ============================================================ */
class SellingSystem {
  constructor(inventory, currency, eventBus) {
    this.inventory = inventory;
    this.currency = currency;
    this.eventBus = eventBus;
  }
  computeItemValue(itemId) {
    const ore = CONFIG.oreTypes[itemId]; if (!ore) return 0;
    return this.inventory.getQuantity(itemId) * ore.baseValue;
  }
  computeTotalValue() {
    let total = 0;
    for (const [id, qty] of this.inventory.items) {
      const ore = CONFIG.oreTypes[id]; if (!ore) continue;
      total += qty * ore.baseValue;
    }
    return total;
  }
  sellAll() {
    if (this.inventory.isEmpty()) return { success: false, total: 0 };
    const total = this.computeTotalValue();
    const breakdown = this.inventory.getEntries().map(e => ({
      itemId: e.itemId, qty: e.qty, value: e.qty * e.ore.baseValue,
    }));
    this.inventory.clear();
    this.currency.add(total);
    this.eventBus.emit(EVENTS.ORE_SOLD, { total, breakdown });
    return { success: true, total };
  }
}

/* ============================================================
   PHASE 4 — CONTEXT ACTION SYSTEM
   ============================================================ */
class ContextActionSystem {
  constructor({ player, miningSystem, pickupSystem, sellZone, inventory, sellingSystem, eventBus }) {
    this.player = player;
    this.miningSystem = miningSystem;
    this.pickupSystem = pickupSystem;
    this.sellZone = sellZone;
    this.inventory = inventory;
    this.sellingSystem = sellingSystem;
    this.eventBus = eventBus;

    this.current = CONTEXT_ACTION.NONE;
    this.button = document.getElementById('context-action-button');
    this.iconEl = document.getElementById('ctx-icon');
    this.labelEl = document.getElementById('ctx-label');

    this.button.addEventListener('click', (e) => { e.preventDefault(); this.trigger(); });
    this.button.addEventListener('touchstart', (e) => { e.preventDefault(); this.trigger(); }, { passive: false });
  }

  update() {
    let next = CONTEXT_ACTION.NONE;
    let icon = '', label = '';

    // Priority: SELL > PICKUP > MINE
    if (this.sellZone.playerInside && !this.inventory.isEmpty()) {
      next = CONTEXT_ACTION.SELL; icon = '🏪'; label = 'SELL';
    } else if (this.pickupSystem.nearest) {
      next = CONTEXT_ACTION.PICKUP; icon = '✋'; label = 'PICK UP';
    } else if (this.miningSystem.targetRock) {
      next = CONTEXT_ACTION.MINE; icon = '⛏️'; label = 'MINE';
    }

    if (next !== this.current) {
      this.current = next;
      this._applyButtonState(next, icon, label);
    }
  }

  _applyButtonState(type, icon, label) {
    this.button.classList.remove('ctx-pickup', 'ctx-sell', 'hidden');
    if (type === CONTEXT_ACTION.NONE) {
      this.button.classList.add('hidden');
      return;
    }
    this.iconEl.textContent = icon;
    this.labelEl.textContent = label;
    if (type === CONTEXT_ACTION.PICKUP) this.button.classList.add('ctx-pickup');
    else if (type === CONTEXT_ACTION.SELL) this.button.classList.add('ctx-sell');
  }

  /** Called when the button is pressed, or when E / click triggers an action. */
  trigger() {
    switch (this.current) {
      case CONTEXT_ACTION.SELL:
        this.sellingSystem.sellAll();
        break;
      case CONTEXT_ACTION.PICKUP:
        this.pickupSystem.pickupNearest();
        break;
      case CONTEXT_ACTION.MINE:
        this.miningSystem.tryMine();
        break;
      default: break;
    }
  }
}

/* ============================================================
   PHASE 4 — TOAST
   ============================================================ */
class Toast {
  constructor(containerEl) { this.container = containerEl; }
  show(text, type = 'info', durationMs = 2000) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = text;
    this.container.appendChild(el);
    setTimeout(() => el.remove(), durationMs);
  }
}

/* ============================================================
   PHASE 4 — SAVE SYSTEM (localStorage)
   ============================================================ */
class SaveSystem {
  constructor({ key, throttleMs, inventory, currency, eventBus }) {
    this.key = key;
    this.throttleMs = throttleMs;
    this.inventory = inventory;
    this.currency = currency;
    this.eventBus = eventBus;
    this._lastSaveTime = 0;
    this._pending = false;

    // Save on events (throttled)
    const schedule = () => this._schedule();
    eventBus.on(EVENTS.INVENTORY_CHANGED, schedule);
    eventBus.on(EVENTS.MONEY_CHANGED, schedule);

    // Save before unload
    window.addEventListener('beforeunload', () => this._saveNow());
    window.addEventListener('pagehide', () => this._saveNow());
  }

  _schedule() {
    const now = performance.now();
    if (now - this._lastSaveTime >= this.throttleMs) {
      this._saveNow();
    } else if (!this._pending) {
      this._pending = true;
      const wait = this.throttleMs - (now - this._lastSaveTime);
      setTimeout(() => { this._pending = false; this._saveNow(); }, wait);
    }
  }

  _saveNow() {
    try {
      const data = {
        version: 1,
        money: this.currency.get(),
        inventory: this.inventory.toJSON(),
        savedAt: Date.now(),
      };
      localStorage.setItem(this.key, JSON.stringify(data));
      this._lastSaveTime = performance.now();
      this.eventBus.emit(EVENTS.SAVE_CHANGED, data);
    } catch (err) {
      console.warn('[SaveSystem] save failed:', err);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return false;
      this.currency.set(data.money || 0);
      this.inventory.fromJSON(data.inventory || {});
      return true;
    } catch (err) {
      console.warn('[SaveSystem] load failed:', err);
      return false;
    }
  }

  reset() {
    try { localStorage.removeItem(this.key); } catch (err) {}
    this.currency.set(0);
    this.inventory.clear();
  }
}

/* ============================================================
   PHASE 4 — INVENTORY UI (subscribes to events)
   ============================================================ */
class InventoryUI {
  constructor(inventory, inputManager, eventBus) {
    this.inventory = inventory;
    this.input = inputManager;
    this.eventBus = eventBus;

    this.panel = document.getElementById('inventory-panel');
    this.listEl = document.getElementById('inventory-list');
    this.weightFill = document.getElementById('inv-weight-fill');
    this.weightText = document.getElementById('inv-weight-text');
    this.closeBtn = document.getElementById('inventory-close');

    this.open = false;

    this.onItemClick = null;   // set by Game → opens detail modal
    this.closeBtn.addEventListener('click', (e) => { e.preventDefault(); this.hide(); });
    this.closeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.hide(); }, { passive: false });

    // Inventory changed → re-render
    eventBus.on(EVENTS.INVENTORY_CHANGED, () => this.render());
    // Money changed — no UI here, but weight HUD updated elsewhere
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.open = true; this.panel.classList.remove('hidden'); this.render(); }
  hide() { this.open = false; this.panel.classList.add('hidden'); }

  render() {
    // Rebuild list
    const entries = this.inventory.getEntries();
    this.listEl.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Empty';
      this.listEl.appendChild(empty);
    } else {
            for (const e of entries) {
        const row = document.createElement('div');
        row.className = 'inv-item';
        const weight = e.qty * e.ore.weight;
        row.innerHTML =
          `<div class="inv-item-icon">${e.ore.icon}</div>` +
          `<div class="inv-item-info">` +
            `<div class="inv-item-name">${e.ore.name.toUpperCase()}</div>` +
            `<div class="inv-item-meta">${weight.toFixed(1)} kg · $${e.ore.baseValue}/ea</div>` +
          `</div>` +
          `<div class="inv-item-qty">×${e.qty}</div>`;
        const id = e.itemId;
        row.addEventListener('click', () => {
          if (this.onItemClick) this.onItemClick(id);
        });
        this.listEl.appendChild(row);
      }
    }
    // Weight
    const w = this.inventory.getTotalWeight();
    const max = this.inventory.maxWeight;
    const pct = Math.min(100, (w / max) * 100);
    this.weightFill.style.width = pct + '%';
    this.weightFill.classList.toggle('full', w >= max - 0.001);
    this.weightText.textContent = `${w.toFixed(1)} / ${max} KG`;
  }
}

/* ============================================================
   PHASE 4 — INVENTORY ITEM DETAIL (view + drop with quantity)
   ============================================================ */
class InventoryDetail {
  constructor({ inventory, pickupSystem, player, eventBus }) {
    this.inventory = inventory;
    this.pickupSystem = pickupSystem;
    this.player = player;
    this.eventBus = eventBus;

    this.panel = document.getElementById('inv-detail-panel');
    this.iconEl = document.getElementById('inv-detail-icon');
    this.nameEl = document.getElementById('inv-detail-name');
    this.qtyEl = document.getElementById('inv-detail-qty');
    this.unitEl = document.getElementById('inv-detail-unit');
    this.totalEl = document.getElementById('inv-detail-total');
    this.weightEl = document.getElementById('inv-detail-weight');
    this.amountEl = document.getElementById('inv-detail-amount');
    this.minusBtn = document.getElementById('inv-detail-minus');
    this.plusBtn = document.getElementById('inv-detail-plus');
    this.dropBtn = document.getElementById('inv-detail-drop');
    this.dropAllBtn = document.getElementById('inv-detail-drop-all');
    this.closeBtn = document.getElementById('inv-detail-close');

    this.itemId = null;

    this.closeBtn.addEventListener('click', (e) => { e.preventDefault(); this.hide(); });
    this.amountEl.addEventListener('input', () => this._clampAmount());
    this.minusBtn.addEventListener('click', (e) => { e.preventDefault(); this._step(-1); });
    this.plusBtn.addEventListener('click', (e) => { e.preventDefault(); this._step(1); });
    this.dropBtn.addEventListener('click', (e) => { e.preventDefault(); this._drop(false); });
    this.dropAllBtn.addEventListener('click', (e) => { e.preventDefault(); this._drop(true); });

    // Backdrop click = close
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.hide();
    });
  }

  isOpen() { return this.itemId !== null; }

  open(itemId) {
    const qty = this.inventory.getQuantity(itemId);
    if (qty <= 0) return;
    this.itemId = itemId;
    this.amountEl.value = 1;
    this._render();
    this.panel.classList.remove('hidden');
  }

  hide() {
    this.panel.classList.add('hidden');
    this.itemId = null;
  }

  _render() {
    if (!this.itemId) return;
    const def = CONFIG.oreTypes[this.itemId];
    const qty = this.inventory.getQuantity(this.itemId);
    if (qty <= 0) { this.hide(); return; }

    this.iconEl.textContent = def.icon;
    this.nameEl.textContent = def.name.toUpperCase();
    this.qtyEl.textContent = qty;
    this.unitEl.textContent = '$' + def.baseValue;
    this.totalEl.textContent = '$' + (def.baseValue * qty);
    this.weightEl.textContent = (def.weight * qty).toFixed(1) + ' kg';

    this.amountEl.max = qty;
    this._clampAmount();
  }

  _clampAmount() {
    if (!this.itemId) return;
    const qty = this.inventory.getQuantity(this.itemId);
    let amt = parseInt(this.amountEl.value, 10);
    if (!Number.isFinite(amt)) amt = 1;
    if (amt > qty) amt = qty;
    if (amt < 1) amt = 1;
    this.amountEl.value = amt;
    this.minusBtn.disabled = amt <= 1;
    this.plusBtn.disabled = amt >= qty;
  }

  _step(delta) {
    if (!this.itemId) return;
    const qty = this.inventory.getQuantity(this.itemId);
    let amt = parseInt(this.amountEl.value, 10) || 1;
    amt = Math.max(1, Math.min(qty, amt + delta));
    this.amountEl.value = amt;
    this._clampAmount();
  }

  _drop(all) {
    if (!this.itemId) return;
    const itemId = this.itemId;
    const qty = this.inventory.getQuantity(itemId);
    if (qty <= 0) { this.hide(); return; }
    const amt = all ? qty : Math.max(1, Math.min(qty, parseInt(this.amountEl.value, 10) || 1));

    const dropped = this.inventory.removeItem(itemId, amt);
    if (dropped > 0) {
      // Spawn at player position, offset a bit so it doesn't spawn under feet
      const p = this.player.group.position;
      const a = Math.random() * Math.PI * 2;
      const r = 1.2;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      this.pickupSystem.spawnOre(itemId, x, z, dropped);

      this.eventBus.emit('toast', {
        text: `DROPPED ${dropped}× ${CONFIG.oreTypes[itemId].name.toUpperCase()}`,
        type: 'info',
      });
    }

    // Close if emptied or "drop all"
    if (all || this.inventory.getQuantity(itemId) <= 0) {
      this.hide();
    } else {
      this._render();
    }
  }
}

/* ============================================================
   PHASE 4 — SELL UI
   ============================================================ */
class SellUI {
  constructor(inventory, sellingSystem, eventBus) {
    this.inventory = inventory;
    this.selling = sellingSystem;
    this.eventBus = eventBus;

    this.panel = document.getElementById('sell-panel');
    this.listEl = document.getElementById('sell-list');
    this.totalEl = document.getElementById('sell-total');
    this.btn = document.getElementById('sell-all-btn');

    this._inZone = false;

    this.btn.addEventListener('click', (e) => { e.preventDefault(); this._doSell(); });
    this.btn.addEventListener('touchstart', (e) => { e.preventDefault(); this._doSell(); }, { passive: false });

    eventBus.on(EVENTS.PLAYER_ENTER_SELL_ZONE, () => { this._inZone = true; this.render(); this._updateVisibility(); });
    eventBus.on(EVENTS.PLAYER_EXIT_SELL_ZONE, () => { this._inZone = false; this._updateVisibility(); });
    eventBus.on(EVENTS.INVENTORY_CHANGED, () => { if (this._inZone) this.render(); });
  }

  _updateVisibility() {
    if (this._inZone) this.panel.classList.remove('hidden');
    else this.panel.classList.add('hidden');
  }

  _doSell() {
    const res = this.selling.sellAll();
    if (!res.success) {
      this.eventBus.emit('toast', { text: 'NOTHING TO SELL', type: 'error' });
      return;
    }
    // Toast handled by toast listener
  }

  render() {
    const entries = this.inventory.getEntries();
    this.listEl.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sell-empty';
      empty.textContent = 'NOTHING TO SELL';
      this.listEl.appendChild(empty);
      this.totalEl.textContent = '$0';
      this.btn.disabled = true;
      return;
    }
    let total = 0;
    for (const e of entries) {
      const value = e.qty * e.ore.baseValue;
      total += value;
      const row = document.createElement('div');
      row.className = 'sell-item';
      row.innerHTML =
        `<span class="sell-item-icon">${e.ore.icon}</span>` +
        `<span class="sell-item-name">${e.ore.name}</span>` +
        `<span class="sell-item-qty">×${e.qty}</span>` +
        `<span class="sell-item-value">$${value}</span>`;
      this.listEl.appendChild(row);
    }
    this.totalEl.textContent = '$' + total;
    this.btn.disabled = false;
  }
}

/* ============================================================
   PHASE 4 — HUD MONEY + WEIGHT
   ============================================================ */
class HUDMoneyWeight {
  constructor(inventory, currency, eventBus) {
    this.inventory = inventory;
    this.currency = currency;
    this.moneyEl = document.getElementById('money-value');
    this.weightFill = document.getElementById('weight-fill');
    this.weightText = document.getElementById('weight-text');

    eventBus.on(EVENTS.MONEY_CHANGED, () => this._updateMoney());
    eventBus.on(EVENTS.INVENTORY_CHANGED, () => this._updateWeight());

    this._updateMoney();
    this._updateWeight();
  }
  _updateMoney() {
    this.moneyEl.textContent = '$' + this.currency.get();
  }
  _updateWeight() {
    const w = this.inventory.getTotalWeight();
    const max = this.inventory.maxWeight;
    const pct = Math.min(100, (w / max) * 100);
    this.weightFill.style.width = pct + '%';
    this.weightFill.classList.toggle('full', w >= max - 0.001);
    this.weightText.textContent = `${w.toFixed(1)}/${max}`;
  }
}

/* ============================================================
   ROCK  (with mineralType — Phase 4 link)
   ============================================================ */
class Rock {
  constructor(id, typeKey, position, quality, mineralType) {
    const def = CONFIG.rocks.types[typeKey];
    this.id = id;
    this.data = {
      type: typeKey, label: def.label,
      maxHealth: def.maxHealth, health: def.maxHealth,
      hardness: def.hardness, requiredToolLevel: def.requiredToolLevel,
      destroyed: false, respawnTimer: 0,
      dropRange: def.dropRange,
      mineralType: mineralType || 'coal',
    };
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this._baseScale = def.scale;
    this._baseColor = def.color;
    this._quality = quality;

    this.geometry = new THREE.IcosahedronGeometry(def.scale, 0);
    coherentJitter(this.geometry, def.scale * 0.15);

    this.material = new THREE.MeshStandardMaterial({
      color: def.color, flatShading: true, roughness: 0.95, metalness: 0,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = quality.preset.shadows;
    this.mesh.receiveShadow = quality.preset.shadows;
    this.mesh.position.y = def.scale * 0.85;
    this.group.add(this.mesh);

    this.group.rotation.y = Math.random() * Math.PI * 2;
    this.mesh.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);

    // Tint rock slightly toward mineral color for feedback
    const mineralColor = new THREE.Color(CONFIG.oreTypes[this.data.mineralType].color);
    const baseColor = new THREE.Color(def.color);
    baseColor.lerp(mineralColor, 0.25);
    this._baseColor = baseColor.getHex();
    this.material.color.setHex(this._baseColor);

    this._punchTimer = 0; this._punchDuration = 0.18;
    this._shakeTimer = 0; this._flashTimer = 0;
    this._breakTimer = 0; this._isBreaking = false;
    this._spawnGrow = 0;
    this.collisionRadius = def.scale * 0.9;
  }
  get position() { return this.group.position; }
  get healthPercent() { return Math.max(0, this.data.health / this.data.maxHealth); }
  applyDamage(rawDamage) {
    if (this.data.destroyed || this._isBreaking) return 0;
    const applied = Math.max(1, Math.round(rawDamage));
    this.data.health = Math.max(0, this.data.health - applied);
    this._punchTimer = this._punchDuration;
    this._shakeTimer = 0.20;
    this._flashTimer = 0.14;
    if (this.data.health <= 0) { this._isBreaking = true; this._breakTimer = 0.35; }
    return applied;
  }
  update(dt) {
    if (this._punchTimer > 0) {
      this._punchTimer -= dt;
      const t = Math.max(0, this._punchTimer / this._punchDuration);
      if (!this._isBreaking) this.group.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.14);
    } else if (!this._isBreaking) { this.group.scale.setScalar(1); }

    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const a = (Math.random() - 0.5) * 0.06;
      this.mesh.position.x = a; this.mesh.position.z = a;
    } else { this.mesh.position.x = 0; this.mesh.position.z = 0; }

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const t = this._flashTimer / 0.14;
      this.material.color.copy(new THREE.Color(this._baseColor).lerp(new THREE.Color(0xffffff), t * 0.85));
    } else { this.material.color.setHex(this._baseColor); }

    if (this._isBreaking) {
      this._breakTimer -= dt;
      const t = Math.max(0, this._breakTimer / 0.35);
      this.group.scale.setScalar(Math.max(0.001, t));
      this.group.rotation.y += dt * 6;
      if (this._breakTimer <= 0) {
        this.group.visible = false;
        this.data.destroyed = true;
        this._isBreaking = false;
        return { broken: true };
      }
      return null;
    }
    if (this.data.destroyed && CONFIG.rocks.respawnEnabled) {
      this.data.respawnTimer -= dt * 1000;
      if (this.data.respawnTimer <= 0) this._respawn();
    }
    return null;
  }
  _respawn() {
    this.data.health = this.data.maxHealth;
    this.data.destroyed = false;
    this._isBreaking = false;
    this._breakTimer = 0;
    this._punchTimer = 0; this._shakeTimer = 0; this._flashTimer = 0;
    this.material.color.setHex(this._baseColor);
    this.group.visible = true;
    this.group.scale.setScalar(0.01);
    this._spawnGrow = 0.35;
  }
  updateSpawnGrow(dt) {
    if (this._spawnGrow > 0) {
      this._spawnGrow -= dt;
      const t = 1 - Math.max(0, this._spawnGrow / 0.35);
      this.group.scale.setScalar(0.01 + t * 0.99);
    }
  }
  markForRespawn() { this.data.respawnTimer = CONFIG.rocks.respawnTime; }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}

/* ============================================================
   ROCK SYSTEM (spawns rocks around mineral nodes — Phase 4 link)
   ============================================================ */
class RockSystem {
  constructor(scene, quality, eventBus) {
    this.scene = scene;
    this.quality = quality;
    this.eventBus = eventBus;
    this.rocks = [];
    this._nextId = 1;
  }

  /**
   * Spawn rocks: clusters around mineral nodes (so detector ↔ mining link is coherent),
   * plus scattered rocks not tied to any node (they default to coal).
   */
  spawnInitial(mineralNodes, minePosition) {
    const total = this.quality.preset.rockCount;
    const perNode = 3;
    let spawned = 0;

    // 1. Rock clusters near mineral nodes
    for (const node of mineralNodes) {
      const n = 2 + Math.floor(Math.random() * perNode); // 2-4 per node
      for (let i = 0; i < n && spawned < total; i++) {
        const pos = this._ringSpot(node.x, node.z, 3, 7);
        if (!pos) continue;
        const typeKey = Math.random() < 0.55 ? 'small' : (Math.random() < 0.8 ? 'medium' : 'large');
        this._spawn(typeKey, pos, node.typeKey);
        spawned++;
      }
    }

    // 2. Scattered fallback rocks (default coal)
    while (spawned < total) {
      const pos = this._scatterSpot(minePosition);
      if (!pos) break;
      const r = Math.random();
      const typeKey = r < 0.5 ? 'small' : (r < 0.85 ? 'medium' : 'large');
      this._spawn(typeKey, pos, 'coal');
      spawned++;
    }
  }

  _ringSpot(cx, cz, rMin, rMax) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = rMin + Math.random() * (rMax - rMin);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) > CONFIG.world.playableRadius - 2) continue;
      if (Math.hypot(x, z) < 4) continue;
      let ok = true;
      for (const rock of this.rocks) {
        if (Math.hypot(x - rock.position.x, z - rock.position.z) < 2.5) { ok = false; break; }
      }
      if (ok) return { x, z };
    }
    return null;
  }

  _scatterSpot(minePosition) {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 5 + Math.random() * 45;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.hypot(x, z) < 4) continue;
      if (Math.hypot(x - minePosition.x, z - minePosition.z) < 14) continue;
      let ok = true;
      for (const rock of this.rocks) {
        if (Math.hypot(x - rock.position.x, z - rock.position.z) < 3.0) { ok = false; break; }
      }
      if (ok) return { x, z };
    }
    return null;
  }

  _spawn(typeKey, position, mineralType) {
    const rock = new Rock(
      this._nextId++, typeKey,
      new THREE.Vector3(position.x, 0, position.z),
      this.quality, mineralType
    );
    this.rocks.push(rock);
    this.scene.add(rock.group);
    return rock;
  }

  update(dt) {
    for (const rock of this.rocks) {
      const result = rock.update(dt);
      rock.updateSpawnGrow(dt);
      if (result && result.broken) {
        this.eventBus.emit(EVENTS.ROCK_DESTROYED, { rock });
        rock.markForRespawn();
      }
    }
  }
}

/* ============================================================
   PICKAXE
   ============================================================ */
class Pickaxe {
  constructor(parentGroup, quality) {
    this.group = new THREE.Group();
    this.group.position.set(0.42, 1.05, 0.15);
    this.inner = new THREE.Group();
    this.group.add(this.inner);

    const shadows = quality.preset.shadows;
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, flatShading: true, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a97a6, flatShading: true, roughness: 0.55, metalness: 0.35 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 6), handleMat);
    handle.position.y = 0.025; handle.castShadow = shadows;
    this.inner.add(handle);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.5), metalMat);
    head.position.y = 0.40; head.castShadow = shadows;
    this.inner.add(head);

    const pick = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 5), metalMat);
    pick.position.set(0, 0.40, 0.38);
    pick.rotation.x = Math.PI / 2;
    pick.castShadow = shadows;
    this.inner.add(pick);

    const adze = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 0.10), metalMat);
    adze.position.set(0, 0.40, -0.30);
    adze.castShadow = shadows;
    this.inner.add(adze);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), metalMat);
    collar.position.y = 0.33; collar.castShadow = shadows;
    this.inner.add(collar);

    this._restRot = 0.15;
    this._windupRot = -0.65;
    this._strikeRot = 1.65;
    this.group.rotation.x = this._restRot;

    parentGroup.add(this.group);
    this._t = 0; this._attacking = false;
    this._attackDuration = CONFIG.mining.attackDuration;
    this._onHit = null; this._hitCalled = false;
  }
  swing(onHit) {
    if (this._attacking) return false;
    this._attacking = true; this._t = 0;
    this._hitCalled = false; this._onHit = onHit;
    return true;
  }
  get isSwinging() { return this._attacking; }
  update(dt) {
    if (this._attacking) {
      this._t += dt;
      const t = this._t / this._attackDuration;
      const clamped = Math.min(1, t);
      if (clamped < 0.30) {
        const k = clamped / 0.30;
        this.group.rotation.x = THREE.MathUtils.lerp(this._restRot, this._windupRot, k * k);
      } else {
        const k = (clamped - 0.30) / 0.70;
        const e = 1 - Math.pow(1 - k, 3);
        this.group.rotation.x = THREE.MathUtils.lerp(this._windupRot, this._strikeRot, e);
      }
      if (!this._hitCalled && this._t >= CONFIG.mining.hitTime) {
        this._hitCalled = true;
        if (this._onHit) { try { this._onHit(); } catch (err) { console.error('[Pickaxe] onHit error:', err); } }
      }
      if (clamped >= 1) {
        this._attacking = false;
        this._onHit = null; this._hitCalled = false;
        this.group.rotation.x = this._restRot;
      }
    } else {
      const s = Math.sin(performance.now() * 0.0015) * 0.03;
      this.group.rotation.x = this._restRot + s;
    }
  }
}

/* ============================================================
   PHASE 3 — MINERAL NODE + SYSTEM
   ============================================================ */
class MineralNode {
  constructor(id, typeKey, x, z) {
    const def = CONFIG.minerals[typeKey];
    this.id = id; this.typeKey = typeKey; this.def = def;
    this.x = x; this.z = z;
    this.depth = def.depth;
    this.worldPosition = new THREE.Vector3(x, -def.depth, z);
    const [rmin, rmax] = CONFIG.mineralNodes.radiusRange;
    this.radius = rmin + Math.random() * (rmax - rmin);
    this.detected = false;
  }
}

class MineralSystem {
  constructor() {
    this.nodes = []; this._nextId = 1;
    this._buildRandom();
  }
  _buildRandom() {
    const total = CONFIG.mineralNodes.count;
    const distribution = [
      { type: 'coal', weight: 30 }, { type: 'iron', weight: 28 },
      { type: 'copper', weight: 20 }, { type: 'gold', weight: 14 },
      { type: 'diamond', weight: 8 },
    ];
    const totalWeight = distribution.reduce((s, d) => s + d.weight, 0);
    const pick = () => {
      let r = Math.random() * totalWeight;
      for (const d of distribution) { r -= d.weight; if (r <= 0) return d.type; }
      return 'coal';
    };
    for (let i = 0; i < total; i++) {
      const spot = this._findSpot();
      if (!spot) continue;
      this._spawn(pick(), spot.x, spot.z);
    }
  }
  _findSpot() {
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 8 + Math.random() * 45;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.hypot(x, z) < CONFIG.mineralNodes.minDistanceFromSpawn) continue;
      let ok = true;
      for (const n of this.nodes) {
        if (Math.hypot(x - n.x, z - n.z) < CONFIG.mineralNodes.minDistanceBetween) { ok = false; break; }
      }
      if (ok) return { x, z };
    }
    return null;
  }
  _spawn(typeKey, x, z) {
    const node = new MineralNode(this._nextId++, typeKey, x, z);
    this.nodes.push(node);
    return node;
  }
  getAll() { return this.nodes; }
}

/* ============================================================
   PHASE 3 — DETECTOR AUDIO
   ============================================================ */
class DetectorAudio {
  constructor() {
    this.ctx = null; this.enabled = false;
    this._osc = null; this._gain = null;
    this._nextBeepTime = 0; this._currentSignal = 0;
    window.addEventListener('prewarm-audio', () => this._ensureCtx());
  }
  _ensureCtx() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._gain = this.ctx.createGain();
      this._gain.gain.value = 0;
      this._gain.connect(this.ctx.destination);
      this._osc = this.ctx.createOscillator();
      this._osc.type = 'square';
      this._osc.frequency.value = 880;
      this._osc.connect(this._gain);
      this._osc.start();
    } catch (err) { console.warn('[DetectorAudio] init failed:', err); }
  }
  start() {
    this.enabled = true;
    this._ensureCtx();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  stop() { this.enabled = false; this._currentSignal = 0; if (this._gain) this._gain.gain.value = 0; }
  update(dt, signal) {
    if (!this.enabled || !this.ctx) return;
    if (signal <= 0.02) { if (this._gain) this._gain.gain.value = 0; return; }
    this._currentSignal = signal;
    this._nextBeepTime -= dt;
    if (this._nextBeepTime <= 0) {
      const interval = THREE.MathUtils.lerp(CONFIG.detector.beepMinInterval, CONFIG.detector.beepMaxInterval, signal);
      const freq = THREE.MathUtils.lerp(500, 1200, signal);
      this._osc.frequency.value = freq;
      const now = this.ctx.currentTime;
      this._gain.gain.cancelScheduledValues(now);
      this._gain.gain.setValueAtTime(0, now);
      this._gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
      this._gain.gain.linearRampToValueAtTime(0, now + 0.06);
      this._nextBeepTime = interval;
    }
  }
}

/* ============================================================
   PHASE 3 — DETECTOR ITEM
   ============================================================ */
class DetectorItem {
  constructor(parentGroup, quality) {
    this.group = new THREE.Group();
    this.group.position.set(-0.42, 1.05, 0.28);
    this.group.rotation.set(0.25, 0, 0.15);

    const shadows = quality.preset.shadows;
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, flatShading: true, roughness: 0.8, metalness: 0.2 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.4, 6), handleMat);
    handle.position.y = -0.05; handle.castShadow = shadows;
    this.group.add(handle);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, flatShading: true, roughness: 0.6, metalness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.12), bodyMat);
    body.position.y = 0.2; body.castShadow = shadows;
    this.group.add(body);

    this.displayMat = new THREE.MeshStandardMaterial({ color: 0x4aa3ff, emissive: 0x1a4a80, emissiveIntensity: 0.8, flatShading: true, roughness: 0.3 });
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), this.displayMat);
    display.position.set(0, 0.22, 0.061);
    this.group.add(display);

    const sensorMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, flatShading: true, roughness: 0.4, metalness: 0.6 });
    const sensor = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), sensorMat);
    sensor.position.y = 0.34; sensor.rotation.x = Math.PI / 2; sensor.castShadow = shadows;
    this.group.add(sensor);
    this.sensor = sensor;

    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x223344 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), this.ledMat);
    led.position.set(0.08, 0.14, 0.061);
    this.group.add(led);

    parentGroup.add(this.group);
    this._time = 0; this._active = false;
    this._updateAccum = 0; this._updateInterval = 0.05;
  }
  setActive(a) { this._active = a; this.ledMat.color.setHex(a ? 0x4aa3ff : 0x223344); }
  update(dt, signal) {
    this._time += dt;
    if (this._active) this.sensor.rotation.z += dt * (2 + signal * 6);
    this._updateAccum += dt;
    if (this._updateAccum < this._updateInterval) return;
    this._updateAccum = 0;
    if (this._active) {
      const base = 0.3;
      const pulse = Math.sin(this._time * (4 + signal * 8)) * 0.25 + 0.25;
      this.displayMat.emissiveIntensity = base + signal * 0.6 + pulse * (0.3 + signal * 0.5);
      const h = signal > 0.75 ? 0xfbbf24 : 0x4aa3ff;
      if (this.displayMat.color.getHex() !== h) this.displayMat.color.setHex(h);
    } else {
      this.displayMat.emissiveIntensity = 0.15;
      if (this.displayMat.color.getHex() !== 0x1a3050) this.displayMat.color.setHex(0x1a3050);
    }
  }
}

/* ============================================================
   PHASE 3 — GROUND MARKER
   ============================================================ */
class GroundMarker {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;

    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.05;
    this.group.add(this.ring);

    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5, depthWrite: false }));
    this.dot.rotation.x = -Math.PI / 2; this.dot.position.y = 0.04;
    this.group.add(this.dot);

    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35, depthWrite: false }));
    this.beam.position.y = 1.25;
    this.group.add(this.beam);

    scene.add(this.group);
    this._time = 0;
  }
  show(x, z) { this.group.position.set(x, 0, z); this.group.visible = true; }
  hide() { this.group.visible = false; }
  update(dt) {
    if (!this.group.visible) return;
    this._time += dt;
    const pulse = Math.sin(this._time * 3) * 0.15 + 1;
    this.ring.scale.setScalar(pulse);
    this.ring.material.opacity = 0.5 + Math.sin(this._time * 3) * 0.2;
    this.beam.material.opacity = 0.25 + Math.sin(this._time * 2.5) * 0.15;
  }
}

/* ============================================================
   PHASE 3 — DETECTOR SYSTEM
   ============================================================ */
class DetectorSystem {
  constructor({ player, mineralSystem, inputState, marker }) {
    this.player = player; this.minerals = mineralSystem;
    this.inputState = inputState; this.marker = marker;
    this.state = DETECTOR_STATE.OFF;
    this.result = this._emptyResult();
    this._scanTimer = 0;
    this._rawSignal = 0; this._displaySignal = 0;
    this._noiseTarget = 0; this._noiseTimer = 0;
    this._tempDir = new THREE.Vector3();
    this.audio = new DetectorAudio();
  }
  _emptyResult() {
    return { detected: false, mineralType: null, mineralName: null, rarity: null, rarityLabel: null, color: null,
             distance: Infinity, signal: 0, direction: '—', targetX: 0, targetZ: 0, isTargetNearby: false };
  }
  toggle() { if (this.state === DETECTOR_STATE.OFF) this._turnOn(); else this._turnOff(); }
  _turnOn() {
    this.state = DETECTOR_STATE.SCANNING;
    this.audio.start();
    if (this.player.detectorItem) this.player.detectorItem.setActive(true);
  }
  _turnOff() {
    this.state = DETECTOR_STATE.OFF;
    this.result = this._emptyResult();
    this._rawSignal = 0; this._displaySignal = 0;
    this.audio.stop();
    if (this.player.detectorItem) this.player.detectorItem.setActive(false);
    if (this.marker) this.marker.hide();
  }
  isOn() { return this.state !== DETECTOR_STATE.OFF; }

  update(dt) {
    if (this.inputState.consumeDetectorToggled()) this.toggle();
    if (this.player.detectorItem) this.player.detectorItem.update(dt, this._displaySignal);
    if (this.state === DETECTOR_STATE.OFF) {
      this.audio.stop();
      if (this.marker) this.marker.hide();
      return;
    }
    this._scanTimer -= dt;
    if (this._scanTimer <= 0) { this._scanTimer = CONFIG.detector.scanInterval; this._performScan(); }
    this._noiseTimer -= dt;
    if (this._noiseTimer <= 0) {
      this._noiseTimer = 0.12;
      const base = this._rawSignal;
      this._noiseTarget = base > 0 ? THREE.MathUtils.clamp(base + (Math.random() - 0.5) * 2 * CONFIG.detector.signalNoise, 0, 1) : 0;
    }
    const k = 1 - Math.exp(-CONFIG.detector.noiseSmoothSpeed * dt);
    this._displaySignal += (this._noiseTarget - this._displaySignal) * k;
    this.result.signal = this._displaySignal;
    if (this.marker) {
      if (this.result.detected && this.result.distance < CONFIG.detector.markerDistance) {
        this.marker.show(this.result.targetX, this.result.targetZ);
      } else this.marker.hide();
      this.marker.update(dt);
    }
    this.audio.update(dt, this._displaySignal);
  }

  _performScan() {
    const pPos = this.player.group.position;
    const nodes = this.minerals.getAll();
    let best = null, bestScore = -Infinity;
    for (const node of nodes) {
      const dx = node.x - pPos.x, dz = node.z - pPos.z;
      const distXZ = Math.hypot(dx, dz);
      const range = Math.min(node.def.detectionRange, CONFIG.detector.range);
      if (distXZ > range) continue;
      const signal = 1 - THREE.MathUtils.clamp(distXZ / range, 0, 1);
      const rarityBias = node.def.rarityWeight;
      const score = signal * (1 + CONFIG.detector.rarityWeight * (rarityBias - 1));
      if (score > bestScore) { bestScore = score; best = { node, signal, distXZ }; }
    }
    if (!best) {
      this.state = DETECTOR_STATE.SCANNING;
      this.result = this._emptyResult();
      this._rawSignal = 0;
      return;
    }
    this.state = DETECTOR_STATE.TARGET_FOUND;
    this._rawSignal = best.signal;
    const dir = this._computeDirection(best.node, pPos);
    this.result = {
      detected: true,
      mineralType: best.node.typeKey,
      mineralName: best.node.def.name,
      rarity: best.node.def.rarity,
      rarityLabel: RARITY_LABEL[best.node.def.rarity] || best.node.def.rarity.toUpperCase(),
      color: best.node.def.color,
      distance: best.distXZ,
      signal: best.signal,
      direction: dir,
      targetX: best.node.x,
      targetZ: best.node.z,
      isTargetNearby: best.distXZ < CONFIG.detector.targetLockDistance,
    };
  }

  _computeDirection(node, pPos) {
    this._tempDir.set(node.x - pPos.x, 0, node.z - pPos.z);
    if (this._tempDir.lengthSq() < 0.0001) return '•';
    this._tempDir.normalize();
    const yaw = this.player.group.rotation.y;
    const targetAngle = Math.atan2(this._tempDir.x, this._tempDir.z);
    let rel = targetAngle - yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const deg = rel * 180 / Math.PI;
    if (deg >= -22.5 && deg < 22.5) return '↑';
    if (deg >= 22.5 && deg < 67.5) return '↗';
    if (deg >= 67.5 && deg < 112.5) return '→';
    if (deg >= 112.5 && deg < 157.5) return '↘';
    if (deg >= 157.5 || deg < -157.5) return '↓';
    if (deg >= -157.5 && deg < -112.5) return '↙';
    if (deg >= -112.5 && deg < -67.5) return '←';
    return '↖';
  }
}

/* ============================================================
   PHASE 3 — DETECTOR UI
   ============================================================ */
class DetectorUI {
  constructor(inputManager) {
    this.input = inputManager;
    this.panel = document.getElementById('detector-ui');
    this.stateEl = document.getElementById('dt-state');
    this.barEl = document.getElementById('dt-bar');
    this.segments = Array.from(this.barEl.children);
    this.distanceEl = document.getElementById('dt-distance');
    this.directionEl = document.getElementById('dt-direction');
    this.targetEl = document.getElementById('dt-target');
    this.rarityRowEl = document.getElementById('dt-rarity-row');
    this.rarityEl = document.getElementById('dt-rarity');

    this.button = document.getElementById('detector-button');
    const toggle = (e) => { e.preventDefault(); this.input.toggleDetector(); };
    this.button.addEventListener('click', toggle);
    this.button.addEventListener('touchstart', toggle, { passive: false });

    this._lastOn = false;
    this._lastStateText = '';
    this._lastSegsOn = -1;
    this._lastDistText = '';
    this._lastDirText = '';
    this._lastTargetText = '';
    this._lastRarityText = '';
    this._lastRarityClass = '';
    this._lastPanelClass = '';
  }

  update(detectorSystem) {
    try { this._updateInner(detectorSystem); }
    catch (err) { console.error('[DetectorUI] update error:', err); }
  }

  _updateInner(detectorSystem) {
    const on = detectorSystem.isOn();
    if (on !== this._lastOn) {
      this._lastOn = on;
      if (on) { this.panel.classList.remove('hidden'); this.button.classList.add('active'); }
      else { this.panel.classList.add('hidden'); this.button.classList.remove('active'); }
    }
    if (!on) return;
    const r = detectorSystem.result;
    let stateText, panelClass;
    if (!r.detected) { stateText = 'NO SIGNAL'; panelClass = 'scanning'; }
    else if (r.isTargetNearby) { stateText = 'TARGET'; panelClass = 'target-locked'; }
    else { stateText = 'SCANNING'; panelClass = 'scanning'; }

    if (stateText !== this._lastStateText) { this._lastStateText = stateText; this.stateEl.textContent = stateText; }
    if (panelClass !== this._lastPanelClass) {
      this._lastPanelClass = panelClass;
      this.panel.classList.remove('scanning', 'target-locked');
      this.panel.classList.add(panelClass);
    }
    const segsOn = Math.round(r.signal * 10);
    if (segsOn !== this._lastSegsOn) {
      this._lastSegsOn = segsOn;
      for (let i = 0; i < this.segments.length; i++) this.segments[i].classList.toggle('on', i < segsOn);
    }
    const distText = r.detected ? `${r.distance.toFixed(1)} m` : '--';
    if (distText !== this._lastDistText) { this._lastDistText = distText; this.distanceEl.textContent = distText; }
    const dirText = r.direction || '—';
    if (dirText !== this._lastDirText) { this._lastDirText = dirText; this.directionEl.textContent = dirText; }
    const targetText = r.detected ? r.mineralName : 'NO SIGNAL';
    if (targetText !== this._lastTargetText) { this._lastTargetText = targetText; this.targetEl.textContent = targetText; }
    if (r.detected && r.rarityLabel) {
      if (r.rarityLabel !== this._lastRarityText) { this._lastRarityText = r.rarityLabel; this.rarityEl.textContent = r.rarityLabel; }
      const rarClass = 'dt-value rarity-' + r.rarity;
      if (rarClass !== this._lastRarityClass) { this._lastRarityClass = rarClass; this.rarityEl.className = rarClass; }
      if (this.rarityRowEl.classList.contains('hidden')) this.rarityRowEl.classList.remove('hidden');
    } else {
      if (!this.rarityRowEl.classList.contains('hidden')) this.rarityRowEl.classList.add('hidden');
    }
  }
}

/* ============================================================
   PLAYER
   ============================================================ */
class Player {
  constructor(scene, quality) {
    this.scene = scene; this.quality = quality;
    this.group = new THREE.Group();
    this.velocity = new THREE.Vector3();
    this.targetRotation = 0;
    this.state = PLAYER_STATE.IDLE;
    this.walkCycle = 0;
    this.faceTarget = null;

    this._build();
    scene.add(this.group);

    this.pickaxe = new Pickaxe(this.group, quality);
    this.detectorItem = new DetectorItem(this.group, quality);
  }
  _build() {
    const shadows = this.quality.preset.shadows;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5c, flatShading: true, roughness: 0.9 });

    this.legLPivot = new THREE.Group();
    this.legLPivot.position.set(-0.16, 0.55, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), legMat);
    legL.position.y = -0.275; legL.castShadow = shadows;
    this.legLPivot.add(legL); this.group.add(this.legLPivot);

    this.legRPivot = new THREE.Group();
    this.legRPivot.position.set(0.16, 0.55, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), legMat);
    legR.position.y = -0.275; legR.castShadow = shadows;
    this.legRPivot.add(legR); this.group.add(this.legRPivot);

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f6ec4, flatShading: true, roughness: 0.7 }));
    this.body.position.y = 1.05; this.body.castShadow = shadows;
    this.group.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0c9a0, flatShading: true, roughness: 0.8 }));
    this.head.position.y = 1.75; this.head.castShadow = shadows;
    this.group.add(this.head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, flatShading: true, emissive: 0x3a2500, emissiveIntensity: 0.6 }));
    visor.position.set(0, 1.78, 0.24); visor.castShadow = shadows;
    this.group.add(visor);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, flatShading: true, roughness: 0.95 }));
    pack.position.set(0, 1.15, -0.34); pack.castShadow = shadows;
    this.group.add(pack);
  }

  update(dt, input, cameraYaw) {
    const isMining = this.state === PLAYER_STATE.MINING;
    if (!isMining) {
      const cos = Math.cos(cameraYaw), sin = Math.sin(cameraYaw);
      const forwardX = -sin, forwardZ = -cos;
      const rightX = cos, rightZ = -sin;
      const dx = rightX * input.moveX + forwardX * input.moveZ;
      const dz = rightZ * input.moveX + forwardZ * input.moveZ;
      const targetVX = dx * CONFIG.player.maxSpeed;
      const targetVZ = dz * CONFIG.player.maxSpeed;
      const mag = Math.hypot(input.moveX, input.moveZ);
      const accel = mag > 0.05 ? CONFIG.player.acceleration : CONFIG.player.deceleration;
      const k = Math.min((accel * dt) / CONFIG.player.maxSpeed, 1);
      this.velocity.x += (targetVX - this.velocity.x) * k;
      this.velocity.z += (targetVZ - this.velocity.z) * k;
    } else {
      const k = Math.min(CONFIG.player.deceleration * 1.5 * dt, 1);
      this.velocity.x += (0 - this.velocity.x) * k;
      this.velocity.z += (0 - this.velocity.z) * k;
    }
    this.group.position.x += this.velocity.x * dt;
    this.group.position.z += this.velocity.z * dt;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (isMining && this.faceTarget) {
      const dxr = this.faceTarget.x - this.group.position.x;
      const dzr = this.faceTarget.z - this.group.position.z;
      this.targetRotation = Math.atan2(dxr, dzr);
    } else if (speed > 0.2) {
      this.targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
    }
    let diff = this.targetRotation - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const rotSpeed = isMining ? CONFIG.mining.faceSpeed : CONFIG.player.turnSpeed;
    this.group.rotation.y += diff * Math.min(rotSpeed * dt, 1);

    if (!isMining && speed > 0.35) {
      this.state = PLAYER_STATE.WALK;
      this.walkCycle += dt * (2.0 + speed * 1.7);
      const swing = Math.sin(this.walkCycle) * 0.5;
      this.legLPivot.rotation.x = swing;
      this.legRPivot.rotation.x = -swing;
      const bob = Math.abs(Math.sin(this.walkCycle * 2)) * 0.045;
      this.body.position.y = 1.05 + bob;
      this.head.position.y = 1.75 + bob;
    } else if (!isMining) {
      this.state = PLAYER_STATE.IDLE;
      const damp = Math.exp(-12 * dt);
      this.legLPivot.rotation.x *= damp;
      this.legRPivot.rotation.x *= damp;
      this.walkCycle += dt;
      const idleBob = Math.sin(this.walkCycle * 1.5) * 0.018;
      this.body.position.y += (1.05 + idleBob - this.body.position.y) * Math.min(8 * dt, 1);
      this.head.position.y += (1.75 + idleBob - this.head.position.y) * Math.min(8 * dt, 1);
    } else {
      const damp = Math.exp(-10 * dt);
      this.legLPivot.rotation.x *= damp;
      this.legRPivot.rotation.x *= damp;
    }
  }
}

/* ============================================================
   MINING SYSTEM (Phase 4: emits ROCK_DESTROYED, no longer picks drops itself)
   ============================================================ */
class MiningSystem {
  constructor({ scene, camera, player, rockSystem, inputState, quality, ui }) {
    this.scene = scene; this.camera = camera; this.player = player;
    this.rocks = rockSystem; this.inputState = inputState;
    this.quality = quality; this.ui = ui;

    this.targetRock = null;
    this.cooldownTimer = 0;
    this._wasSwinging = false;
    this.damageNumbers = new DamageNumberPool(document.getElementById('damage-layer'));
    this.debris = new DebrisSystem(scene);

    this._tempVec = new THREE.Vector3();
    this._tempVec2 = new THREE.Vector3();
  }

  update(dt) {
    const swinging = this.player.pickaxe.isSwinging;
    if (this._wasSwinging && !swinging) {
      if (this.player.state === PLAYER_STATE.MINING) {
        this.player.state = PLAYER_STATE.IDLE;
        this.player.faceTarget = null;
      }
    }
    this._wasSwinging = swinging;

    if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
    this._updateTarget();
    // NOTE: Input is now consumed by ContextActionSystem; MiningSystem
    // exposes tryMine() which is called by ContextAction.trigger().
    this.player.pickaxe.update(dt);
    this.damageNumbers.update(dt);
    this.debris.update(dt);
  }

  _updateTarget() {
    const pPos = this.player.group.position;
    let best = null, bestScore = -Infinity;
    const faceDir = this._tempVec.set(0, 0, 1).applyQuaternion(this.player.group.quaternion);
    const range = CONFIG.mining.range, minR = CONFIG.mining.minRange;
    for (const rock of this.rocks.rocks) {
      if (rock.data.destroyed || rock._isBreaking) continue;
      const d = Math.hypot(rock.position.x - pPos.x, rock.position.z - pPos.z);
      if (d > range || d < minR) continue;
      const toRock = this._tempVec2.set(rock.position.x - pPos.x, 0, rock.position.z - pPos.z).normalize();
      const dirDot = toRock.dot(faceDir);
      const distScore = 1 - (d / range);
      const dirScore = (dirDot + 1) * 0.5;
      const score = distScore * CONFIG.mining.distanceWeight + dirScore * CONFIG.mining.directionWeight;
      if (score > bestScore) { bestScore = score; best = rock; }
    }
    if (best !== this.targetRock) { this.targetRock = best; this.ui.setTarget(best); }
    else if (best) this.ui.setTarget(best);
  }

  tryMine() {
    if (this.cooldownTimer > 0) return;
    if (!this.targetRock) return;
    if (this.targetRock.data.destroyed) return;
    if (this.player.pickaxe.isSwinging) return;
    this.player.state = PLAYER_STATE.MINING;
    this.player.faceTarget = this.targetRock.position.clone();
    const rockAtStart = this.targetRock;
    const started = this.player.pickaxe.swing(() => this._onHit(rockAtStart));
    if (!started) {
      this.player.state = PLAYER_STATE.IDLE;
      this.player.faceTarget = null;
      return;
    }
    this.cooldownTimer = CONFIG.mining.cooldown;
  }

  _onHit(rock) {
    if (!rock || rock.data.destroyed || rock._isBreaking) return;
    const pPos = this.player.group.position;
    const d = Math.hypot(rock.position.x - pPos.x, rock.position.z - pPos.z);
    if (d > CONFIG.mining.range + 0.4) return;
    const applied = rock.applyDamage(CONFIG.mining.baseDamage);
    if (applied > 0) {
      this._spawnDamageNumber(rock, applied);
      this.ui.flashHit();
    }
  }

  _spawnDamageNumber(rock, amount) {
    const pos = this._tempVec.copy(rock.position);
    pos.y += rock._baseScale * 1.6 + 0.4;
    this.damageNumbers.spawn(pos, this.camera, `-${amount}`, amount >= 20);
  }

  /** Called by Game on ROCK_DESTROYED — spawn debris. Ore drop handled separately. */
  onRockBroken(rock) {
    const pos = this._tempVec.copy(rock.position);
    pos.y += rock._baseScale * 0.7;
    this.debris.spawn(pos, rock._baseColor, CONFIG.effects.debrisPerBreak, this.quality);
    if (this.targetRock === rock) {
      this.targetRock = null;
      this.ui.setTarget(null);
    }
  }
}

/* ============================================================
   MINING UI (rock HP)
   ============================================================ */
class MiningUI {
  constructor() {
    this.targetEl = document.getElementById('target-ui');
    this.nameEl = document.getElementById('target-name');
    this.hpFillEl = document.getElementById('target-hp-fill');
    this.hpTextEl = document.getElementById('target-hp-text');
    this.hitFlash = document.getElementById('hit-flash');
    this._flashTimer = null;
  }
  setTarget(rock) {
    if (!rock) {
      this.targetEl.classList.add('hidden');
      return;
    }
    const d = rock.data;
    this.nameEl.textContent = d.label;
    const pct = Math.max(0, d.health / d.maxHealth);
    this.hpFillEl.style.width = `${(pct * 100).toFixed(1)}%`;
    this.hpTextEl.textContent = `HP ${d.health} / ${d.maxHealth}`;
    this.targetEl.classList.remove('hidden');
  }
  flashHit() {
    this.hitFlash.classList.add('active');
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.hitFlash.classList.remove('active'), 60);
  }
}

/* ============================================================
   WORLD
   ============================================================ */
class World {
  constructor(scene, quality, rockSystem, mineralSystem) {
    this.scene = scene; this.quality = quality;
    this.rockSystem = rockSystem;
    this.mineralSystem = mineralSystem;
    this.obstacles = [];
    this.cameraColliders = [];
    this.minePosition = new THREE.Vector3(22, 0, -22);
  }
  build() {
    this._buildLights();
    this._buildGround();
    this.rockSystem.spawnInitial(this.mineralSystem.getAll(), this.minePosition);
    this._buildTrees();
    this._buildMine();
    for (const rock of this.rockSystem.rocks) {
      const obstacle = { x: rock.position.x, z: rock.position.z, radius: rock.collisionRadius, rock };
      this.obstacles.push(obstacle);
      if (rock._baseScale >= 1.0) this.cameraColliders.push(rock.mesh);
    }
  }
  _buildLights() {
    const q = this.quality.preset;
    this.scene.add(new THREE.HemisphereLight(0xc6daf2, 0x4a5a3a, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.55);
    sun.position.set(45, 60, 28);
    sun.castShadow = q.shadows;
    if (q.shadows) {
      sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
      sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    }
    this.scene.add(sun); this.scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0x8fa8d8, 0.28);
    fill.position.set(-35, 28, -25);
    this.scene.add(fill);
  }
  _buildGround() {
    const shadows = this.quality.preset.shadows;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.world.groundSize, CONFIG.world.groundSize),
      new THREE.MeshStandardMaterial({ color: 0x6d8b4a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = shadows;
    this.scene.add(ground);
    this.cameraColliders.push(ground);

    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(16, 24),
      new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: 1 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(this.minePosition.x, 0.01, this.minePosition.z);
    dirt.receiveShadow = shadows;
    this.scene.add(dirt);
  }
  _buildTrees() {
    const count = this.quality.preset.treeCount;
    for (let i = 0; i < count; i++) {
      const tree = this._createTree();
      const spot = this._findEmptySpot(8, 48);
      if (!spot) continue;
      const s = 0.85 + Math.random() * 0.5;
      tree.position.set(spot.x, 0, spot.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      tree.scale.setScalar(s);
      this.scene.add(tree);
      this.obstacles.push({ x: spot.x, z: spot.z, radius: 0.55 * s });
      this.cameraColliders.push(tree);
    }
  }
  _createTree() {
    const g = new THREE.Group();
    const shadows = this.quality.preset.shadows;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a22, flatShading: true, roughness: 1 }));
    trunk.position.y = 0.8; trunk.castShadow = shadows; g.add(trunk);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3a6b3f, flatShading: true, roughness: 0.9 });
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.9, 6), foliageMat);
    f1.position.y = 2.15; f1.castShadow = shadows; g.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.5, 6), foliageMat);
    f2.position.y = 3.05; f2.castShadow = shadows; g.add(f2);
    const f3 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.2, 6), foliageMat);
    f3.position.y = 3.85; f3.castShadow = shadows; g.add(f3);
    return g;
  }
  _buildMine() {
    const g = new THREE.Group();
    g.position.copy(this.minePosition);
    const shadows = this.quality.preset.shadows;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x585866, flatShading: true, roughness: 1 });
    const wallGeo = new THREE.BoxGeometry(18, 8, 5);
    coherentJitter(wallGeo, 0.15);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 4, -9);
    wall.castShadow = shadows; wall.receiveShadow = shadows;
    g.add(wall);
    this.cameraColliders.push(wall);
    this.obstacles.push({ x: this.minePosition.x, z: this.minePosition.z - 9, radius: 9.5 });

    for (let i = -1; i <= 1; i += 2) {
      const side = this._createStaticRock(3.2 + Math.random() * 0.6, 0x6b6b76);
      side.position.set(i * 9.5, 1.6, -5);
      side.scale.set(1, 1.3, 1);
      g.add(side);
    }
    const hole = new THREE.Mesh(new THREE.BoxGeometry(5.6, 5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 1 }));
    hole.position.set(0, 2.5, -6.4);
    g.add(hole);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, flatShading: true, roughness: 0.9 });
    const beamL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 0.4), woodMat);
    beamL.position.set(-3.0, 2.6, -6.3); beamL.castShadow = shadows; g.add(beamL);
    const beamR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 0.4), woodMat);
    beamR.position.set(3.0, 2.6, -6.3); beamR.castShadow = shadows; g.add(beamR);
    const beamTop = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.4, 0.4), woodMat);
    beamTop.position.set(0, 5.1, -6.3); beamTop.castShadow = shadows; g.add(beamTop);
    const oreMat = new THREE.MeshStandardMaterial({
      color: 0x4aa3ff, emissive: 0x1a4a80, emissiveIntensity: 0.55, flatShading: true, roughness: 0.3, metalness: 0.4,
    });
    for (let i = 0; i < 9; i++) {
      const s = 0.2 + Math.random() * 0.35;
      const ore = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), oreMat);
      const a = Math.random() * Math.PI * 2;
      const r = 3.5 + Math.random() * 7;
      ore.position.set(Math.cos(a) * r, s * 0.85, Math.sin(a) * r * 0.55 + Math.random() * 3);
      ore.rotation.set(Math.random(), Math.random(), Math.random());
      ore.castShadow = shadows;
      g.add(ore);
    }
    this.scene.add(g);
  }
  _createStaticRock(size, color) {
    const geo = new THREE.DodecahedronGeometry(size, 0);
    coherentJitter(geo, size * 0.15);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0 }));
    mesh.castShadow = this.quality.preset.shadows;
    mesh.receiveShadow = this.quality.preset.shadows;
    return mesh;
  }
  _findEmptySpot(minRadius, maxRadius) {
    const { x: mx, z: mz } = this.minePosition;
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = minRadius + Math.random() * (maxRadius - minRadius);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.hypot(x, z) < 4) continue;
      if (Math.hypot(x - mx, z - mz) < 14) continue;
      let ok = true;
      for (const o of this.obstacles) {
        if (Math.hypot(x - o.x, z - o.z) < o.radius + 1.6) { ok = false; break; }
      }
      if (!ok) continue;
      return { x, z };
    }
    return null;
  }
  resolveCollisions(player) {
    const pos = player.group.position;
    const pr = CONFIG.player.radius;
    for (const o of this.obstacles) {
      if (o.rock && (o.rock.data.destroyed || o.rock._isBreaking)) continue;
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const distSq = dx * dx + dz * dz;
      const minDist = o.radius + pr;
      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = minDist - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
  }
  clampToBoundary(player) {
    const pos = player.group.position;
    const r = CONFIG.world.playableRadius;
    const d = Math.hypot(pos.x, pos.z);
    if (d > r) { pos.x = (pos.x / d) * r; pos.z = (pos.z / d) * r; }
  }
}

/* ============================================================
   THIRD-PERSON CAMERA
   ============================================================ */
class ThirdPersonCamera {
  constructor(camera, colliders) {
    this.camera = camera; this.colliders = colliders;
    this.yaw = 0; this.pitch = 0.4;
    this.targetYaw = 0; this.targetPitch = 0.4;
    this._raycaster = new THREE.Raycaster();
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._initialized = false;
  }
  update(dt, playerPos, inputState) {
    const { dx, dy } = inputState.consumeCameraDelta();
    this.targetYaw -= dx; this.targetPitch += dy;
    this.targetPitch = Math.max(CONFIG.camera.minPitch, Math.min(CONFIG.camera.maxPitch, this.targetPitch));
    const kYaw = 1 - Math.exp(-CONFIG.camera.smoothYaw * dt);
    const kPitch = 1 - Math.exp(-CONFIG.camera.smoothPitch * dt);
    this.yaw += (this.targetYaw - this.yaw) * kYaw;
    this.pitch += (this.targetPitch - this.pitch) * kPitch;
    this._target.set(playerPos.x, playerPos.y + CONFIG.camera.lookHeight, playerPos.z);
    const dist = CONFIG.camera.distance, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this._desired.set(
      this._target.x + Math.sin(this.yaw) * cp * dist,
      this._target.y + sp * dist + CONFIG.camera.extraHeight,
      this._target.z + Math.cos(this.yaw) * cp * dist
    );
    this._dir.copy(this._desired).sub(this._target);
    const d = this._dir.length();
    if (d > 0.001) {
      this._dir.divideScalar(d);
      this._raycaster.set(this._target, this._dir);
      this._raycaster.far = d;
      const hits = this._raycaster.intersectObjects(this.colliders, false);
      if (hits.length > 0) {
        const safeDist = Math.max(hits[0].distance - CONFIG.camera.collisionPadding, CONFIG.camera.minDist);
        this._desired.copy(this._target).addScaledVector(this._dir, safeDist);
      }
    }
    if (this._desired.y < CONFIG.camera.minY) this._desired.y = CONFIG.camera.minY;
    if (!this._initialized) { this.camera.position.copy(this._desired); this._initialized = true; }
    else {
      const kPos = 1 - Math.exp(-CONFIG.camera.smoothPos * dt);
      this.camera.position.lerp(this._desired, kPos);
    }
    this.camera.lookAt(this._target);
  }
}

/* ============================================================
   GAME
   ============================================================ */
class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.inputState = new InputState();
    this.fpsTimer = 0; this.fpsFrames = 0;
  }
  init() {
    // ---- EventBus first (everything subscribes to it)
    this.eventBus = new EventBus();

    this.quality = new GraphicsQuality();
    document.getElementById('quality-label').textContent = this.quality.level;

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: this.quality.preset.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.quality.getPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.quality.preset.shadows;
    this.renderer.shadowMap.type = this.quality.preset.shadowType;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9bb8d4);
    this.scene.fog = new THREE.Fog(0x9bb8d4, this.quality.preset.fogNear, this.quality.preset.fogFar);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);

    this.input = new InputManager(this.inputState);
    this.input.attach();

    // ---- Phase 4 systems (data layer first)
    this.inventory = new InventorySystem(this.eventBus, CONFIG.inventory.maxWeight);
    this.currency = new CurrencySystem(this.eventBus);
    this.sellingSystem = new SellingSystem(this.inventory, this.currency, this.eventBus);
    this.toast = new Toast(document.getElementById('toast-container'));
    this.saveSystem = new SaveSystem({
      key: CONFIG.save.key, throttleMs: CONFIG.save.throttleMs,
      inventory: this.inventory, currency: this.currency, eventBus: this.eventBus,
    });

    // ---- World systems
    this.rockSystem = new RockSystem(this.scene, this.quality, this.eventBus);
    this.mineralSystem = new MineralSystem();
    this.world = new World(this.scene, this.quality, this.rockSystem, this.mineralSystem);
    this.world.build();

    this.player = new Player(this.scene, this.quality);
    this.player.group.position.set(0, 0, 6);

    this.cameraController = new ThirdPersonCamera(this.camera, this.world.cameraColliders);
    this.cameraController.yaw = -0.65; this.cameraController.targetYaw = -0.65;
    this.cameraController.pitch = 0.42; this.cameraController.targetPitch = 0.42;

    // ---- Mining
    this.miningUI = new MiningUI();
    this.miningSystem = new MiningSystem({
      scene: this.scene, camera: this.camera, player: this.player,
      rockSystem: this.rockSystem, inputState: this.inputState,
      quality: this.quality, ui: this.miningUI,
    });

    // ---- Pickup
    this.pickupSystem = new PickupSystem(this.scene, this.inventory, this.eventBus, this.camera);

    // ---- Sell zone
    this.sellZone = new SellZone(this.scene, this.eventBus, CONFIG.sellZone.position, CONFIG.sellZone.radius);

    // ---- Detector (Phase 3)
    this.groundMarker = new GroundMarker(this.scene);
    this.detectorSystem = new DetectorSystem({
      player: this.player, mineralSystem: this.mineralSystem,
      inputState: this.inputState, marker: this.groundMarker,
    });
    this.detectorUI = new DetectorUI(this.input);

    // ---- UI (Phase 4)
    this.inventoryUI = new InventoryUI(this.inventory, this.input, this.eventBus);
    this.sellUI = new SellUI(this.inventory, this.sellingSystem, this.eventBus);
    this.hudMoneyWeight = new HUDMoneyWeight(this.inventory, this.currency, this.eventBus);
        // Item detail modal (view + drop with qty)
    this.inventoryDetail = new InventoryDetail({
      inventory: this.inventory,
      pickupSystem: this.pickupSystem,
      player: this.player,
      eventBus: this.eventBus,
    });
    // Wire: click item in bag → open detail
    this.inventoryUI.onItemClick = (itemId) => this.inventoryDetail.open(itemId);

    // Inventory toggle button
    const invBtn = document.getElementById('inventory-button');
    const invToggle = (e) => { e.preventDefault(); this.inventoryUI.toggle(); };
    invBtn.addEventListener('click', invToggle);
    invBtn.addEventListener('touchstart', invToggle, { passive: false });
    // Input toggles
    this.eventBus.on('inventory-toggle', () => this.inventoryUI.toggle());

    // ---- Context action
    this.contextSystem = new ContextActionSystem({
      player: this.player, miningSystem: this.miningSystem,
      pickupSystem: this.pickupSystem, sellZone: this.sellZone,
      inventory: this.inventory, sellingSystem: this.sellingSystem,
      eventBus: this.eventBus,
    });

    // ---- Wire ROCK_DESTROYED → debris + ore drop
    this.eventBus.on(EVENTS.ROCK_DESTROYED, ({ rock }) => {
      this.miningSystem.onRockBroken(rock);
      this._spawnOreFromRock(rock);
    });

    // ---- Toast on inventory full
    this.eventBus.on(EVENTS.INVENTORY_FULL, () => {
      this.toast.show('INVENTORY FULL', 'error');
    });

    // ---- Toast on sold
    this.eventBus.on(EVENTS.ORE_SOLD, ({ total }) => {
      this.toast.show(`SOLD! +$${total}`, 'success');
    });

    // ---- Simple toast bridge
    this.eventBus.on('toast', ({ text, type }) => this.toast.show(text, type || 'info'));

    // ---- Load save (AFTER all listeners set up so UI updates)
    this.saveSystem.load();

    // Touch controls
    new VirtualJoystick(
      document.getElementById('joystick-zone'),
      document.getElementById('joystick-base'),
      document.getElementById('joystick-knob'),
      this.input
    );
    new CameraTouch(document.getElementById('camera-zone'), this.input);

    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._onResize(), 250));
    window.addEventListener('quality', e => this._setQuality(e.detail));

    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
      }, 250);
    });

    this.renderer.setAnimationLoop(() => this._loop());
  }

  _spawnOreFromRock(rock) {
    const mineralType = rock.data.mineralType || 'coal';
    const [lo, hi] = rock.data.dropRange;
    const qty = lo + Math.floor(Math.random() * (hi - lo + 1));
    // Spawn slightly offset so ore doesn't perfectly overlap rock position
    const a = Math.random() * Math.PI * 2;
    const r = 0.6;
    const x = rock.position.x + Math.cos(a) * r;
    const z = rock.position.z + Math.sin(a) * r;
    this.pickupSystem.spawnOre(mineralType, x, z, qty);
  }

  _loop() {
    try { this._loopInner(); }
    catch (err) { console.error('[Game] loop error:', err); }
  }

  _loopInner() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.input.update();

    // Player
    this.player.update(dt, this.inputState, this.cameraController.yaw);
    this.world.resolveCollisions(this.player);
    this.world.clampToBoundary(this.player);

    // Inventory toggle via key I
    if (this.inputState.consumeInventoryToggled()) this.inventoryUI.toggle();
    
    if (this.inputState.consumeInventoryToggled()) {
      if (this.inventoryDetail.isOpen()) this.inventoryDetail.hide();
      else this.inventoryUI.toggle();
    }

    // Systems that read player position
    this.sellZone.update(dt, this.player.group.position);
    this.pickupSystem.update(dt, this.player.group.position);
    this.rockSystem.update(dt);
    this.miningSystem.update(dt);
    this.detectorSystem.update(dt);
    this.detectorUI.update(this.detectorSystem);

    // Context action reads everything
    this.contextSystem.update();

    // Action input (E key / click / context button) — routes to current context
    if (this.inputState.consumeMinePressed()) {
      this.contextSystem.trigger();
    }

    // Sell UI needs to know about content changes — handled via events

    // Camera
    this.cameraController.update(dt, this.player.group.position, this.inputState);

    // Render
    this.renderer.render(this.scene, this.camera);

    // FPS
    this.fpsTimer += dt; this.fpsFrames++;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsTimer);
      document.getElementById('debug').textContent = `FPS: ${fps}`;
      this.fpsTimer = 0; this.fpsFrames = 0;
    }
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.quality.getPixelRatio());
    this.renderer.setSize(w, h);
  }

  _setQuality(level) {
    this.quality.setLevel(level);
    const p = this.quality.preset;
    this.renderer.setPixelRatio(this.quality.getPixelRatio());
    this.renderer.shadowMap.enabled = p.shadows;
    this.renderer.shadowMap.type = p.shadowType;
    this.renderer.shadowMap.needsUpdate = true;
    this.scene.fog.near = p.fogNear;
    this.scene.fog.far = p.fogFar;
    document.getElementById('quality-label').textContent = level;
  }
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('error', e => {
  console.error('[Game] Uncaught error:', e.error || e.message);
});

const game = new Game();
game.init();

// Debug helpers (open devtools console)
window.game = game;
window.resetSave = () => { game.saveSystem.reset(); location.reload(); };