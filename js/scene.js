// The full-screen 8-bit dog park behind the Play screen.
// Drawn at low resolution and scaled up 3–4× with crisp pixels. Each dog has a little
// "brain" that picks what to do next (zoomies, fetch, tricks, naps...) based on the timer.

import { C, drawDog, drawEmote } from './pixel.js';

const FPS = 12; // low frame rate on purpose: it's what makes motion feel 8-bit
const DOG_W = 18;
const DOG_H = 14;
const SPEED = { walk: 12, sniff: 6, run: 34, dash: 60 }; // pixels per second

export const rand = (min, max) => min + Math.random() * (max - min);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

/** Picks from [[weight, makeSteps], ...] and returns the chosen steps. */
export function pickWeighted(options) {
  const live = options.filter(([weight]) => weight > 0);
  let roll = Math.random() * live.reduce((sum, [weight]) => sum + weight, 0);
  for (const [weight, make] of live) {
    roll -= weight;
    if (roll <= 0) return make();
  }
  return live.at(-1)[1]();
}

// Small deterministic random so the park looks the same every time it's drawn.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A filled pixel circle. */
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

export class ParkScene {
  constructor(canvas, labelLayer, getState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.labelLayer = labelLayer;
    this.getState = getState;
    this.agents = new Map();
    this.ball = { x: 0, y: 0, heldBy: null, placed: false };
    this.insets = { top: 0, bottom: 0 };
    this.phase = 'idle';
    this.progress = 0;
    this.frameId = null;
    this.lastDraw = 0;
    this.lastUpdate = 0;
    this.resize();
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.scale = vw < 700 ? 3 : 4;
    this.W = Math.ceil(vw / this.scale);
    this.H = Math.ceil(vh / this.scale);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.canvas.style.width = `${this.W * this.scale}px`;
    this.canvas.style.height = `${this.H * this.scale}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.viewport = `${vw}x${vh}`;

    this.layout();
    this.buildLandscape();
    this.updateYard();
    if (!this.ball.placed) {
      Object.assign(this.ball, this.randomSpot(), { placed: true });
      this.ball.y += 10;
    }
    this.draw(performance.now());
  }

  /** Where the horizon and props sit. The gym overrides this. */
  layout() {
    this.skyBottom = Math.round(this.H * 0.36);
    this.groundTop = this.skyBottom + 4; // where the fence meets the grass
    this.bowl = { x: Math.round(this.W * 0.1) + 4, y: this.groundTop + 8 };
    this.hydrant = { x: Math.round(this.W * 0.64), y: this.groundTop + 3 };
  }

  /** Space covered by the on-screen panels (CSS pixels), so dogs stay visible. */
  setInsets(top, bottom) {
    this.insets = { top, bottom };
    this.updateYard();
  }

  updateYard() {
    const s = this.scale;
    const top = Math.max(this.groundTop + 2, Math.ceil(this.insets.top / s) - 6);
    let bottom = Math.min(
      Math.floor((window.innerHeight - this.insets.bottom) / s) - DOG_H - 8, // room for the name tag
      this.H - DOG_H - 2
    );
    if (bottom < top + 12) bottom = top + 12; // tiny screens: let dogs wander behind panels
    this.yard = { left: 2, right: this.W - DOG_W - 2, top, bottom };
    for (const a of this.agents.values()) Object.assign(a, this.clamp(a));
    Object.assign(this.ball, this.clamp(this.ball, 6));
  }

  clamp(point, pad = 0) {
    const { left, right, top, bottom } = this.yard;
    return {
      x: Math.min(right + pad, Math.max(left, point.x)),
      y: Math.min(bottom + pad, Math.max(top, point.y)),
    };
  }

  randomSpot() {
    const { left, right, top, bottom } = this.yard;
    return { x: rand(left, right), y: rand(top, bottom) };
  }

  // ---------------------------------------------------------------------------
  // Dogs
  // ---------------------------------------------------------------------------

  /** dogs: [{ id, name, coat, size, mascot? }] — keeps existing dogs where they are. */
  setDogs(dogs) {
    const ids = new Set(dogs.map((d) => d.id));
    for (const [id, agent] of this.agents) {
      if (ids.has(id)) continue;
      if (agent.hasBall) this.dropBall(agent);
      this.agents.delete(id);
    }
    for (const dog of dogs) {
      const existing = this.agents.get(dog.id);
      if (existing) {
        Object.assign(existing, { name: dog.name, coat: dog.coat, size: dog.size, mascot: dog.mascot });
        continue;
      }
      this.agents.set(dog.id, {
        ...dog,
        ...this.randomSpot(),
        dir: Math.random() < 0.5 ? 1 : -1,
        queue: [],
        step: null,
        emote: null,
        emoteUntil: 0,
        hasBall: false,
        phaseSeen: this.phase,
        seed: Math.floor(Math.random() * 8),
      });
    }
    this.labelLayer.replaceChildren(
      ...[...this.agents.values()]
        .filter((a) => !a.mascot)
        .map((a) => {
          const tag = document.createElement('span');
          tag.dataset.id = a.id;
          tag.textContent = a.name;
          return tag;
        })
    );
  }

  /** What a dog does right when the timer changes state. */
  reaction(agent) {
    if (agent.hasBall) this.dropBall(agent);
    switch (this.phase) {
      case 'running': return [{ pose: 'jump', t: 0.7, emote: 'bang' }];
      case 'paused': return [{ pose: 'sit', t: 0.6, emote: 'drop' }];
      case 'finished': return [{ pose: 'jump', t: 1.2, emote: 'heart' }];
      // You called them: ears up, then everyone dashes over to the front of the yard.
      case 'calling': return [
        { pose: 'sit', t: 0.25, emote: 'bang' },
        { to: this.callSpot(agent), speed: 'dash', limit: 2.5 },
        { pose: 'wag', t: 0.6, emote: 'heart' },
      ];
      default: return [];
    }
  }

  /** Where each dog lines up when you call: front and center, side by side. */
  callSpot(agent) {
    const ids = [...this.agents.keys()];
    const i = ids.indexOf(agent.id);
    const spread = 22;
    const x = this.W / 2 - DOG_W / 2 + (i - (ids.length - 1) / 2) * spread;
    return { x, y: this.yard.bottom - (i % 2) * 4 };
  }

  /** What a dog decides to do next. */
  plan(agent) {
    const others = [...this.agents.values()].filter((o) => o !== agent);
    const spot = () => this.randomSpot();

    if (this.phase === 'running') {
      return pickWeighted([
        [26, () => [{ to: spot(), speed: 'run' }, { to: spot(), speed: 'run' }, { pose: 'wag', t: 0.8 }]],
        [this.ball.heldBy ? 0 : 18, () => this.fetchPlan()],
        [others.length ? 10 : 0, () => [
          { to: { dog: pickOne(others).id }, speed: 'run', limit: 3, emote: 'bang' },
          { pose: 'bow', t: 1 },
        ]],
        [8, () => [{ pose: 'lie', t: 0.5 }, { pose: 'roll', t: 2, emote: 'star' }, { pose: 'sit', t: 0.6 }]],
        [8, () => [{ pose: 'run', t: 1.6, spin: true }, { pose: 'wag', t: 0.6, emote: 'note' }]],
        [6, () => [{ pose: 'beg', t: 2, emote: 'heart' }]],
        [7, () => [{ pose: 'bow', t: 1.2 }, { to: spot(), speed: 'run' }]],
        [6, () => [{ pose: 'jump', t: 1.5, emote: 'heart' }]],
        [8, () => [{ to: spot(), speed: 'sniff' }, { pose: 'sniff', t: 1 }]],
        [5, () => [{ pose: 'wag', t: 1.5 }]],
      ]);
    }
    if (this.phase === 'paused') {
      return pickWeighted([
        [5, () => [{ to: 'bowl', speed: 'walk' }, { pose: 'sniff', t: 3, emote: 'drop' }, { pose: 'lie', t: 4 }]],
        [4, () => [{ pose: 'lie', t: 4 }]],
        [3, () => [{ pose: 'sit', t: 3 }]],
      ]);
    }
    if (this.phase === 'calling') {
      return pickWeighted([
        [3, () => [{ pose: 'jump', t: 0.8, emote: 'heart' }]],
        [2, () => [{ pose: 'wag', t: 0.8 }]],
        [1, () => [{ pose: 'run', t: 0.8, spin: true, emote: 'note' }]],
      ]);
    }
    if (this.phase === 'finished') {
      return pickWeighted([
        [5, () => [{ pose: 'jump', t: 1.2, emote: 'heart' }]],
        [2, () => [{ pose: 'run', t: 1.2, spin: true, emote: 'star' }]],
        [2, () => [{ pose: 'beg', t: 1.5, emote: 'heart' }]],
      ]);
    }
    return pickWeighted([
      [28, () => [{ pose: 'wag', t: rand(2, 4) }]],
      [18, () => [{ pose: 'lie', t: rand(3, 6) }]],
      [8, () => [{ pose: 'sleep', t: rand(5, 8), emote: 'zzz' }]],
      [20, () => [{ to: spot(), speed: 'walk' }, { pose: 'sit', t: rand(1, 2) }]],
      [14, () => [{ to: spot(), speed: 'sniff' }, { pose: 'sniff', t: 1.2 }]],
      [5, () => [{ pose: 'bow', t: 1.2, emote: 'note' }]],
      [5, () => [{ to: 'bowl', speed: 'walk' }, { pose: 'sniff', t: 2.5, emote: 'drop' }]],
      [3, () => [{ pose: 'lie', t: 0.4 }, { pose: 'roll', t: 2 }]],
    ]);
  }

  fetchPlan() {
    return [
      { to: 'ball', speed: 'run', emote: 'bang', onArrive: (a) => this.grabBall(a) },
      { to: this.randomSpot(), speed: 'run', onArrive: (a) => this.dropBall(a) },
      { pose: 'wag', t: 0.8, emote: 'star' },
    ];
  }

  /** A trick for when you tap a dog. */
  trick() {
    return pickOne([
      [{ pose: 'jump', t: 1.4, emote: 'heart' }],
      [{ pose: 'lie', t: 0.4 }, { pose: 'roll', t: 1.8, emote: 'star' }, { pose: 'sit', t: 0.6 }],
      [{ pose: 'beg', t: 1.8, emote: 'heart' }],
      [{ pose: 'run', t: 1.4, spin: true, emote: 'note' }],
      [{ pose: 'bow', t: 1.2, emote: 'note' }],
    ]);
  }

  /** Returns the tapped dog (if any) after making it do a trick. */
  pokeAt(clientX, clientY) {
    const x = clientX / this.scale;
    const y = clientY / this.scale;
    let hit = null;
    for (const a of this.agents.values()) {
      const inside = x >= a.x - 4 && x <= a.x + DOG_W + 4 && y >= a.y - 6 && y <= a.y + DOG_H + 4;
      if (inside && (!hit || a.y > hit.y)) hit = a;
    }
    if (!hit) return null;
    if (hit.hasBall) this.dropBall(hit);
    hit.queue = this.trick();
    hit.step = null;
    return hit;
  }

  mouth(a) {
    return { x: a.dir > 0 ? a.x + 15 : a.x, y: a.y + 5 };
  }

  grabBall(a) {
    if (this.ball.heldBy) return;
    this.ball.heldBy = a.id;
    a.hasBall = true;
  }

  dropBall(a) {
    if (this.ball.heldBy !== a.id) return;
    const m = this.mouth(a);
    Object.assign(this.ball, { heldBy: null }, this.clamp({ x: m.x, y: a.y + 10 }, 6));
    a.hasBall = false;
  }

  resolveTarget(a, to) {
    if (to === 'ball') {
      if (this.ball.heldBy && this.ball.heldBy !== a.id) return null;
      const fromLeft = a.x + 8 < this.ball.x;
      return { x: this.ball.x - (fromLeft ? 15 : 0), y: this.ball.y - 5 };
    }
    if (to === 'bowl') return { x: this.bowl.x - 17, y: this.bowl.y - 10 };
    if (to.dog) {
      const other = this.agents.get(to.dog);
      return other ? { x: other.x - other.dir * 12, y: other.y } : null;
    }
    return this.clamp(to);
  }

  update(dt, now) {
    for (const a of this.agents.values()) {
      if (a.phaseSeen !== this.phase) {
        a.phaseSeen = this.phase;
        a.queue = this.reaction(a);
        a.step = null;
      }
      if (!a.step) a.step = a.queue.shift() ?? null;
      if (!a.step) {
        a.queue = this.plan(a);
        a.step = a.queue.shift();
      }
      this.runStep(a, dt, now);
    }
  }

  runStep(a, dt, now) {
    const step = a.step;
    if (step.emote && !step.emoted) {
      a.emote = step.emote;
      a.emoteUntil = now + 1800;
      step.emoted = true;
    }

    if (step.to) {
      const target = this.resolveTarget(a, step.to);
      step.elapsed = (step.elapsed ?? 0) + dt;
      if (!target) {
        a.step = null;
        return;
      }
      const dx = target.x - a.x;
      const dy = target.y - a.y;
      const dist = Math.hypot(dx, dy);
      const move = SPEED[step.speed] * dt;
      if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
      if (dist <= move || step.elapsed > (step.limit ?? 8)) {
        if (dist <= move) Object.assign(a, target);
        if (step.to === 'bowl') a.dir = 1;
        step.onArrive?.(a);
        a.step = null;
        return;
      }
      a.x += (dx / dist) * move;
      a.y += (dy / dist) * move;
      return;
    }

    step.t -= dt;
    if (step.spin) a.dir = Math.floor(now / 160) % 2 ? 1 : -1;
    if (step.t <= 0) a.step = null;
  }

  poseOf(a, now) {
    const step = a.step ?? { pose: 'sit' };
    const sec = now / 1000;
    if (step.to) {
      const fast = step.speed === 'run' || step.speed === 'dash';
      const pose = fast ? 'run' : step.speed;
      const fps = fast ? 12 : 6;
      return { pose, frame: Math.floor(sec * fps) + a.seed };
    }
    const fps = step.pose === 'run' ? 12 : step.pose === 'jump' ? 4 : 3;
    return { pose: step.pose, frame: Math.floor(sec * fps) + a.seed };
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  start() {
    // The park and gym share one canvas; redo layout if the window changed while we were away.
    if (this.viewport !== `${window.innerWidth}x${window.innerHeight}`) this.resize();
    this.canvas.hidden = false;
    this.labelLayer.hidden = false;
    this.lastUpdate = performance.now();
    const loop = (now) => {
      this.frameId = requestAnimationFrame(loop);
      if (now - this.lastDraw < 1000 / FPS) return;
      this.lastDraw = now;
      const state = this.getState();
      this.phase = state.phase;
      this.progress = state.progress;
      this.update(Math.min(0.25, (now - this.lastUpdate) / 1000), now);
      this.lastUpdate = now;
      this.draw(now);
    };
    if (this.frameId === null) this.frameId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.canvas.hidden = true;
    this.labelLayer.hidden = true;
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  // Everything that never moves: hills, trees, fence, grass, doghouse. Drawn once per resize.
  buildLandscape() {
    const { W, H, skyBottom, groundTop } = this;
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const ctx = layer.getContext('2d');
    const rand01 = seeded(7);

    // Far hills
    ctx.fillStyle = C.leaf;
    for (let x = 0; x < W; x++) {
      const top = Math.round(skyBottom - 8 - 5 * Math.sin(x / 13) - 3 * Math.sin(x / 5.3 + 1));
      ctx.fillRect(x, top, 1, H - top);
    }

    // Trees behind the fence
    const treeCount = Math.max(3, Math.round(W / 48));
    for (let i = 0; i < treeCount; i++) {
      const tx = Math.round(((i + 0.5) / treeCount) * W + (rand01() - 0.5) * 16);
      const cy = skyBottom - 10 - Math.floor(rand01() * 4);
      const r = 9 + Math.floor(rand01() * 3);
      ctx.fillStyle = C.navy;
      ctx.fillRect(tx - 2, cy, 5, groundTop - cy);
      ctx.fillStyle = C.brown;
      ctx.fillRect(tx - 1, cy + 1, 3, groundTop - cy - 1);
      disc(ctx, tx, cy, r + 1, C.navy);
      disc(ctx, tx, cy, r, C.forest);
      disc(ctx, tx - 2, cy - 3, Math.round(r * 0.55), C.leaf);
      ctx.fillStyle = C.green;
      for (let j = 0; j < 6; j++) ctx.fillRect(tx - 6 + Math.floor(rand01() * 9), cy - 7 + Math.floor(rand01() * 7), 1, 1);
    }

    // Grass with soft mowing stripes
    ctx.fillStyle = C.green;
    ctx.fillRect(0, groundTop - 8, W, H - groundTop + 8);
    ctx.fillStyle = C.lawn;
    for (let y = groundTop + 14; y < H; y += 28) ctx.fillRect(0, y, W, 14);
    ctx.fillStyle = C.leaf;
    for (let i = 0; i < (W * H) / 160; i++) {
      const x = Math.floor(rand01() * W);
      const y = groundTop + 2 + Math.floor(rand01() * (H - groundTop));
      ctx.fillRect(x, y, 1, 2);
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }

    // Picket fence
    const fenceTop = groundTop - 12;
    for (let x = 1; x < W; x += 5) {
      ctx.fillStyle = C.navy;
      ctx.fillRect(x - 1, fenceTop, 5, 13);
      ctx.fillStyle = C.cream;
      ctx.fillRect(x, fenceTop + 2, 3, 10);
      ctx.fillRect(x + 1, fenceTop + 1, 1, 1);
      ctx.fillStyle = C.silver;
      ctx.fillRect(x + 2, fenceTop + 3, 1, 9);
    }
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, fenceTop + 4, W, 1);
    ctx.fillRect(0, fenceTop + 8, W, 1);
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, fenceTop + 5, W, 2);
    ctx.fillRect(0, fenceTop + 9, W, 1);

    // Doghouse
    const hx = W - 30;
    const base = groundTop + 6;
    ctx.fillStyle = C.navy;
    ctx.fillRect(hx - 1, base - 12, 20, 13);
    ctx.fillStyle = C.peach;
    ctx.fillRect(hx, base - 11, 18, 11);
    ctx.fillStyle = C.orange;
    ctx.fillRect(hx + 16, base - 11, 2, 11);
    ctx.fillStyle = C.navy;
    ctx.fillRect(hx + 6, base - 8, 6, 8);
    ctx.fillRect(hx + 7, base - 9, 4, 1);
    for (let i = 0; i < 10; i++) {
      const half = i + 1;
      const y = base - 22 + i;
      ctx.fillStyle = C.navy;
      ctx.fillRect(hx + 9 - half - 1, y, half * 2 + 2, 1);
      ctx.fillStyle = i % 3 === 2 ? C.plum : C.red;
      if (i < 9) ctx.fillRect(hx + 9 - half, y, half * 2, 1);
    }
    ctx.fillStyle = C.yellow;
    ctx.fillRect(hx + 7, base - 15, 4, 2);

    this.landscape = layer;

    // Flowers are drawn every frame so they can sway; remember where they go.
    this.flowers = Array.from({ length: Math.round((W * (H - groundTop)) / 260) }, () => ({
      x: Math.floor(rand01() * (W - 4)) + 2,
      y: groundTop + 4 + Math.floor(rand01() * (H - groundTop - 6)),
      color: [C.pink, C.yellow, C.cream, C.red, C.pink][Math.floor(rand01() * 5)],
      phase: rand01() * 6,
    }));
  }

  draw(now) {
    const { ctx } = this;
    const t = now / 1000;
    const tick = Math.floor(t * FPS);

    this.drawSky();
    this.drawSun(tick);
    this.drawClouds(t);
    this.drawBirds(t, tick);
    ctx.drawImage(this.landscape, 0, 0);
    this.drawFlowers(t);

    // Everything on the grass, back to front
    const things = [
      { y: this.bowl.y + 4, draw: () => this.drawBowl() },
      { y: this.hydrant.y + 11, draw: () => this.drawHydrant() },
      ...[...this.agents.values()].map((a) => ({ y: a.y + DOG_H, draw: () => this.drawAgent(a, now) })),
    ];
    if (!this.ball.heldBy) things.push({ y: this.ball.y + 3, draw: () => this.drawBall(this.ball.x, this.ball.y) });
    things.sort((p, q) => p.y - q.y).forEach((thing) => thing.draw());

    for (const a of this.agents.values()) {
      if (a.emote && now < a.emoteUntil) drawEmote(ctx, a.emote, Math.round(a.dir > 0 ? a.x + 11 : a.x), Math.round(a.y - 12));
    }
    this.drawButterflies(t, tick);
    this.placeLabels();
  }

  drawSky() {
    const { ctx, W, skyBottom } = this;
    const bands = [
      [0, C.blue],
      [Math.round(skyBottom * 0.3), C.sky2],
      [Math.round(skyBottom * 0.55), C.sky3],
      [Math.round(skyBottom * 0.78), C.sky4],
    ];
    bands.forEach(([y, color], i) => {
      const next = bands[i + 1]?.[0] ?? skyBottom;
      ctx.fillStyle = color;
      ctx.fillRect(0, y, W, next - y);
      if (i > 0) {
        ctx.fillStyle = bands[i - 1][1];
        for (let x = y % 2; x < W; x += 2) ctx.fillRect(x, y, 1, 1);
      }
    });
  }

  // The sun travels across the sky as play time passes.
  drawSun(tick) {
    const { ctx, W, skyBottom } = this;
    const p = this.progress;
    // Arc between just above the treetops and just below the on-screen timer panel.
    const low = skyBottom - 24;
    const high = Math.min(low, Math.max(12, Math.ceil(this.insets.top / this.scale) + 12));
    const cx = Math.round(W * (0.14 + 0.72 * p));
    const cy = Math.round(low - Math.sin(Math.PI * p) * (low - high));
    const long = tick % 8 < 4;
    ctx.fillStyle = C.yellow;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 0; i < (long ? 4 : 2); i++) ctx.fillRect(cx + dx * (10 + i), cy + dy * (10 + i), 1, 1);
    }
    ctx.fillStyle = C.orange;
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      for (let i = 0; i < (long ? 2 : 3); i++) ctx.fillRect(cx + dx * (8 + i), cy + dy * (8 + i), 1, 1);
    }
    disc(ctx, cx, cy, 7, C.orange);
    disc(ctx, cx, cy, 6, C.yellow);
    ctx.fillStyle = C.cream;
    ctx.fillRect(cx - 3, cy - 3, 2, 2);
  }

  drawClouds(t) {
    const { ctx, W, skyBottom } = this;
    const count = Math.max(3, Math.round(W / 50));
    for (let i = 0; i < count; i++) {
      const w = 16 + ((i * 7) % 14);
      const y = Math.round(skyBottom * (0.08 + ((i * 0.37) % 0.5)));
      const speed = 1.2 + ((i * 1.3) % 2.6);
      const span = W + w * 2;
      const x = Math.round(span - ((t * speed + (i / count) * span) % span) - w);
      const h = Math.round(w / 4);
      ctx.fillStyle = C.cream;
      ctx.fillRect(x, y + 2, w, h);
      ctx.fillRect(x + 3, y, Math.round(w * 0.4), h);
      ctx.fillRect(x + Math.round(w * 0.45), y - 2, Math.round(w * 0.35), h + 1);
      ctx.fillStyle = C.sky4;
      ctx.fillRect(x + 1, y + 1 + h, w - 2, 1);
    }
  }

  drawBirds(t, tick) {
    const { ctx, W, skyBottom } = this;
    ctx.fillStyle = C.navy;
    [0, 1].forEach((i) => {
      const span = W + 60;
      const x = Math.round(((t * 9 + i * 14) % span) - 30);
      const y = Math.round(skyBottom * 0.35) + i * 5 + Math.round(Math.sin(t * 2 + i) * 2);
      const lift = (tick + i * 3) % 6 < 3 ? 1 : 0;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x - 1, y - lift, 1, 1);
      ctx.fillRect(x + 1, y - lift, 1, 1);
      ctx.fillRect(x - 2, y - lift * 2, 1, 1);
      ctx.fillRect(x + 2, y - lift * 2, 1, 1);
    });
  }

  drawFlowers(t) {
    const { ctx } = this;
    for (const f of this.flowers) {
      const sway = Math.sin(t * 2 + f.phase) > 0.6 ? 1 : 0;
      ctx.fillStyle = C.forest;
      ctx.fillRect(f.x, f.y + 1, 1, 2);
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - 1 + sway, f.y, 3, 1);
      ctx.fillRect(f.x + sway, f.y - 1, 1, 3);
      ctx.fillStyle = f.color === C.yellow ? C.orange : C.yellow;
      ctx.fillRect(f.x + sway, f.y, 1, 1);
    }
  }

  drawButterflies(t, tick) {
    const { ctx, W, groundTop } = this;
    [0, 1, 2].forEach((i) => {
      const x = Math.round(W * (0.2 + i * 0.3) + Math.sin(t * 0.6 + i * 2) * W * 0.15);
      const y = Math.round(groundTop + 10 + i * 14 + Math.sin(t * 1.4 + i * 3) * 6);
      const open = (tick + i) % 4 < 2;
      ctx.fillStyle = [C.pink, C.yellow, C.cream][i];
      if (open) {
        ctx.fillRect(x - 2, y - 1, 2, 2);
        ctx.fillRect(x + 1, y - 1, 2, 2);
      } else {
        ctx.fillRect(x - 1, y - 2, 1, 2);
        ctx.fillRect(x + 1, y - 2, 1, 2);
      }
      ctx.fillStyle = C.navy;
      ctx.fillRect(x, y - 1, 1, 2);
    });
  }

  drawBowl() {
    const { ctx } = this;
    const { x, y } = this.bowl;
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 1, y - 1, 10, 6);
    ctx.fillStyle = C.blue;
    ctx.fillRect(x, y, 8, 2);
    ctx.fillStyle = C.cream;
    ctx.fillRect(x + 1, y, 2, 1);
    ctx.fillStyle = C.red;
    ctx.fillRect(x, y + 2, 8, 2);
    ctx.fillStyle = C.plum;
    ctx.fillRect(x + 6, y + 2, 2, 2);
  }

  drawHydrant() {
    const { ctx } = this;
    const { x, y } = this.hydrant;
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 1, y - 1, 7, 12);
    ctx.fillRect(x - 2, y + 3, 9, 3);
    ctx.fillStyle = C.red;
    ctx.fillRect(x, y, 5, 10);
    ctx.fillRect(x - 1, y + 4, 7, 1);
    ctx.fillStyle = C.pink;
    ctx.fillRect(x + 1, y + 1, 1, 6);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x + 1, y - 1, 3, 1);
  }

  drawBall(x, y) {
    const { ctx } = this;
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 1, y - 1, 5, 5);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x, y, 3, 3);
    ctx.fillStyle = C.green;
    ctx.fillRect(x + 2, y, 1, 1);
  }

  drawAgent(a, now) {
    const { ctx } = this;
    const { pose, frame } = this.poseOf(a, now);
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    // soft shadow
    ctx.fillStyle = 'rgba(29, 43, 83, 0.18)';
    ctx.fillRect(x + 3, y + DOG_H - 1, a.size === 'small' ? 10 : 12, 2);
    drawDog(ctx, x, y, a.coat, pose, frame, a.dir < 0, a.size);
    if (a.hasBall) {
      const m = this.mouth(a);
      this.drawBall(m.x - 1, m.y);
    }
  }

  placeLabels() {
    const s = this.scale;
    for (const span of this.labelLayer.children) {
      const a = this.agents.get(span.dataset.id);
      if (!a) continue;
      span.style.transform = `translate(${Math.round((a.x + DOG_W / 2) * s)}px, ${Math.round((a.y + DOG_H + 2) * s)}px) translateX(-50%)`;
    }
  }
}
