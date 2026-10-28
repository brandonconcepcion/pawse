// The retro 8-bit gym. Extends ParkScene, so it reuses the dog "brain" (queues of steps, movement,
// emotes, labels) but has its own room, equipment, and activities: treadmill, bike, bench press,
// punching bag, agility hurdles & tunnel, yoga mat, scale, water bowl. Every dog in the app works
// out here at once; equipment is "claimed" so two dogs never use the same machine.

import { C, drawIcon, drawEmote } from './pixel.js';
import { ParkScene, disc, pickWeighted, rand } from './scene.js';

const WALL = '#2B3A6B';
const WALL_DARK = '#223058';
const PLANK = '#C98446';
const PLANK_ALT = '#BD7A3E';
const SEAM = '#8E5530';
const BELT = '#24243A';

export class GymScene extends ParkScene {
  layout() {
    const { W, H } = this;
    this.wallBottom = Math.round(H * 0.46); // tall enough that the windows clear the stats panel
    this.groundTop = this.wallBottom + 2;
    const g = this.groundTop;
    this.treadmill = { x: W - 50, y: g + 6 };
    this.mat = { x: Math.round(W * 0.3), y: g + 28, w: 26 };
    this.weighScale = { x: Math.round(W * 0.6), y: g + 18 };
    this.bowl = { x: Math.round(W * 0.08) + 4, y: g + 14 };
    this.kettlebells = { x: Math.round(W * 0.2), y: g + 4 };
    this.exerciseBall = { x: Math.round(W * 0.88), y: g + 94 };
    this.bike = { x: Math.round(W * 0.06), y: g + 44 };
    this.bench = { x: Math.round(W * 0.42), y: g + 52 };
    this.bag = { x: Math.round(W * 0.78), y: g + 64 };
    this.hurdles = [
      { x: Math.round(W * 0.26), y: g + 82 },
      { x: Math.round(W * 0.46), y: g + 82 },
    ];
    this.tunnel = { x: Math.round(W * 0.58), y: g + 100, w: 30 };
  }

  // ---------------------------------------------------------------------------
  // Behavior
  // ---------------------------------------------------------------------------

  reaction() {
    return [];
  }

  /**
   * What a dog does next. With several dogs in the gym, each piece of equipment is "claimed"
   * by whoever is using it, so two dogs never pile onto the same machine.
   */
  plan(agent) {
    this.claims ??= new Map();
    for (const [machine, owner] of this.claims) {
      if (owner === agent.id || !this.agents.has(owner)) this.claims.delete(machine);
    }
    const spot = () => this.randomSpot();
    const others = [...this.agents.values()].filter((o) => o !== agent);
    // [weight, steps, machine?]
    const options = [
      [24, () => [{ to: spot(), speed: 'walk' }, { pose: 'sit', t: rand(1, 2) }]],
      [16, () => [
        { to: 'treadmill', speed: 'walk' },
        { pose: 'run', t: rand(4, 7), onTreadmill: true, emote: 'drop' },
        { pose: 'wag', t: 0.8, emote: 'star' },
      ], 'treadmill'],
      [12, () => [
        { to: 'mat', speed: 'walk' },
        { pose: 'bow', t: 2.5, emote: 'note' }, // downward dog
        { pose: 'lie', t: 1.5 },
      ], 'mat'],
      [9, () => [
        { to: 'bike', speed: 'walk' },
        { pose: 'sit', t: rand(4, 6), onBike: true, emote: 'drop' },
        { pose: 'wag', t: 0.6 },
      ], 'bike'],
      [9, () => [
        { to: 'bench', speed: 'walk' },
        { pose: 'lie', t: rand(4, 6), onBench: true, emote: 'star' }, // bench press!
        { pose: 'sit', t: 0.6 },
      ], 'bench'],
      [8, () => [
        { to: 'bag', speed: 'walk' },
        { pose: 'beg', t: 3, onBag: true, emote: 'bang' }, // jab jab
        { pose: 'wag', t: 0.6 },
      ], 'bag'],
      [8, () => [
        { to: 'hurdleStart', speed: 'walk' },
        { to: 'hurdleEnd', speed: 'run', hurdles: true },
        { pose: 'wag', t: 0.8, emote: 'star' },
      ], 'hurdles'],
      [7, () => [
        { to: 'tunnelStart', speed: 'walk' },
        { to: 'tunnelEnd', speed: 'run' },
        { pose: 'jump', t: 1, emote: 'heart' },
      ], 'tunnel'],
      [10, () => [{ to: 'bowl', speed: 'walk' }, { pose: 'sniff', t: 2.5, emote: 'drop' }], 'bowl'],
      [10, () => [{ to: 'scale', speed: 'walk' }, { pose: 'sit', t: 2.5, emote: 'star' }], 'scale'],
      [9, () => [{ to: spot(), speed: 'sniff' }, { pose: 'sniff', t: 1.2 }]],
      [8, () => [{ pose: 'lie', t: rand(2, 4), emote: 'zzz' }]], // phew, tired
      [6, () => [{ pose: 'jump', t: 1.2, emote: 'heart' }]],
      [4, () => [{ pose: 'beg', t: 1.5, emote: 'heart' }]], // ...treat?
      // gym buddies: go hang out next to another dog for a bit
      [others.length ? 7 : 0, () => [
        { to: { dog: others[Math.floor(Math.random() * others.length)].id }, speed: 'walk', limit: 4 },
        { pose: 'sit', t: 1.8, emote: 'heart' },
      ]],
    ];
    const available = options
      .filter(([weight, , machine]) => weight > 0 && (!machine || !this.claims.has(machine)))
      .map(([weight, make, machine]) => [weight, () => {
        if (machine) this.claims.set(machine, agent.id);
        return make();
      }]);
    return pickWeighted(available);
  }

  resolveTarget(agent, to) {
    if (to === 'treadmill') return { x: this.treadmill.x + 4, y: this.treadmill.y - 12 };
    if (to === 'mat') return { x: this.mat.x + 4, y: this.mat.y - 9 };
    if (to === 'scale') return { x: this.weighScale.x - 5, y: this.weighScale.y - 9 };
    if (to === 'bike') return { x: this.bike.x - 3, y: this.bike.y - 22 };
    if (to === 'bench') return { x: this.bench.x - 1, y: this.bench.y - 17 };
    if (to === 'bag') return { x: this.bag.x + 13, y: this.bag.y - 13 };
    const lane = (y) => y - 13;
    if (to === 'hurdleStart') return { x: this.hurdles[0].x - 24, y: lane(this.hurdles[0].y) };
    if (to === 'hurdleEnd') return { x: this.hurdles.at(-1).x + 16, y: lane(this.hurdles[0].y) };
    if (to === 'tunnelStart') return { x: this.tunnel.x - 20, y: lane(this.tunnel.y) };
    if (to === 'tunnelEnd') return { x: this.tunnel.x + this.tunnel.w + 2, y: lane(this.tunnel.y) };
    return super.resolveTarget(agent, to);
  }

  runStep(agent, dt, now) {
    const to = agent.step?.to;
    super.runStep(agent, dt, now);
    // Face the equipment once you get there.
    const facing = { treadmill: 1, mat: 1, scale: 1, bike: 1, bench: 1, bag: -1, hurdleStart: 1, tunnelStart: 1 };
    if (!agent.step && facing[to]) agent.dir = facing[to];
  }

  poseOf(agent, now) {
    // Leap whenever the agility run passes over a hurdle.
    if (agent.step?.hurdles) {
      const center = agent.x + 9;
      if (this.hurdles.some((h) => Math.abs(h.x + 6 - center) < 8)) return { pose: 'jump', frame: 0 };
    }
    return super.poseOf(agent, now);
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  buildLandscape() {
    const { W, H, wallBottom } = this;
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const ctx = layer.getContext('2d');

    // Wall with a darker top band and 80s racing stripes
    ctx.fillStyle = WALL;
    ctx.fillRect(0, 0, W, wallBottom);
    ctx.fillStyle = WALL_DARK;
    ctx.fillRect(0, 0, W, Math.round(wallBottom * 0.35));
    const stripeY = wallBottom - 18;
    [C.red, C.orange, C.yellow].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, stripeY + i * 3, W, 3);
    });

    // Sunny windows
    const windowCount = Math.max(2, Math.floor(W / 64));
    const winY = Math.max(4, wallBottom - 46);
    for (let i = 0; i < windowCount; i++) {
      const wx = Math.round(((i + 0.5) / (windowCount + 0.6)) * W) - 13;
      ctx.fillStyle = C.navy;
      ctx.fillRect(wx - 1, winY - 1, 28, 20);
      ctx.fillStyle = C.cream;
      ctx.fillRect(wx, winY, 26, 18);
      ctx.fillStyle = C.blue;
      ctx.fillRect(wx + 2, winY + 2, 22, 7);
      ctx.fillStyle = C.sky3;
      ctx.fillRect(wx + 2, winY + 9, 22, 7);
      ctx.fillStyle = C.cream;
      ctx.fillRect(wx + 5 + (i * 5) % 9, winY + 4, 7, 2);
      ctx.fillRect(wx + 7 + (i * 5) % 9, winY + 3, 3, 1);
      ctx.fillRect(wx + 12, winY + 2, 2, 14); // window bars
      ctx.fillRect(wx + 2, winY + 8, 22, 1);
    }

    // Dumbbell rack
    const rx = 4;
    const rackTop = wallBottom - 12;
    ctx.fillStyle = C.navy;
    ctx.fillRect(rx - 1, rackTop - 1, 22, 17);
    ctx.fillStyle = C.slate;
    ctx.fillRect(rx, rackTop, 20, 2);
    ctx.fillRect(rx, rackTop + 6, 20, 2);
    ctx.fillRect(rx, rackTop + 12, 20, 3);
    ctx.fillRect(rx, rackTop, 2, 15);
    ctx.fillRect(rx + 18, rackTop, 2, 15);
    for (const [y, color] of [[rackTop + 2, C.red], [rackTop + 8, C.blue]]) {
      for (const x of [rx + 3, rx + 11]) {
        ctx.fillStyle = C.silver;
        ctx.fillRect(x + 1, y + 1, 4, 1);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 4);
        ctx.fillRect(x + 5, y, 1, 4);
      }
    }

    // Wood floor planks
    for (let y = wallBottom, row = 0; y < H; y += 5, row++) {
      ctx.fillStyle = row % 2 ? PLANK_ALT : PLANK;
      ctx.fillRect(0, y, W, 5);
      ctx.fillStyle = SEAM;
      ctx.fillRect(0, y + 4, W, 1);
      for (let x = (row * 11) % 23; x < W; x += 23) ctx.fillRect(x, y, 1, 4);
    }
    // Baseboard
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, wallBottom, W, 2);
    ctx.fillStyle = C.lavender;
    ctx.fillRect(0, wallBottom - 1, W, 1);

    this.landscape = layer;
    this.flowers = [];
  }

  draw(now) {
    const { ctx } = this;
    const t = now / 1000;
    ctx.drawImage(this.landscape, 0, 0);
    this.drawClock();

    // Flat things on the floor go under everyone
    this.drawMat();
    drawIcon(ctx, 'scale', this.weighScale.x, this.weighScale.y);

    const busy = (flag) => [...this.agents.values()].some((a) => a.step?.[flag]);
    const running = busy('onTreadmill');
    const things = [
      { y: this.treadmill.y, draw: () => this.drawTreadmill(t, running) },
      { y: this.bike.y - 10, draw: () => this.drawBike(t, busy('onBike')) },
      { y: this.bench.y - 8, draw: () => this.drawBench() },
      { y: this.bag.y, draw: () => this.drawBag(t, busy('onBag')) },
      ...this.hurdles.map((h) => ({ y: h.y, draw: () => this.drawHurdle(h) })),
      { y: this.tunnel.y + 4, draw: () => this.drawTunnel() },
      { y: this.bowl.y + 4, draw: () => this.drawBowl() },
      { y: this.kettlebells.y + 6, draw: () => this.drawKettlebells() },
      { y: this.exerciseBall.y + 6, draw: () => this.drawExerciseBall(t) },
      ...[...this.agents.values()].map((a) => ({ y: a.y + 14, draw: () => this.drawAgent(a, now) })),
    ];
    things.sort((p, q) => p.y - q.y).forEach((thing) => thing.draw());
    this.drawBarbell(t, busy('onBench'));

    for (const a of this.agents.values()) {
      if (a.emote && now < a.emoteUntil) drawEmote(ctx, a.emote, Math.round(a.dir > 0 ? a.x + 11 : a.x), Math.round(a.y - 12));
    }
    this.placeLabels();
  }

  drawClock() {
    const { ctx, W, wallBottom } = this;
    const cx = W - 16;
    const cy = Math.max(8, wallBottom - 34);
    disc(ctx, cx, cy, 6, C.navy);
    disc(ctx, cx, cy, 5, C.cream);
    const now = new Date();
    const hand = (fraction, length, color) => {
      const angle = fraction * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = color;
      for (let i = 0; i <= length; i++) {
        ctx.fillRect(Math.round(cx + Math.cos(angle) * i), Math.round(cy + Math.sin(angle) * i), 1, 1);
      }
    };
    hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 2, C.navy);
    hand(now.getMinutes() / 60, 4, C.navy);
    hand(now.getSeconds() / 60, 4, C.red);
  }

  drawTreadmill(t, running) {
    const { ctx } = this;
    const { x, y } = this.treadmill;
    // console posts and screen at the front (right) end
    ctx.fillStyle = C.navy;
    ctx.fillRect(x + 27, y - 19, 3, 20);
    ctx.fillRect(x + 23, y - 23, 12, 8);
    ctx.fillStyle = C.slate;
    ctx.fillRect(x + 28, y - 18, 1, 18);
    ctx.fillStyle = C.black;
    ctx.fillRect(x + 24, y - 22, 10, 6);
    ctx.fillStyle = running ? C.red : C.plum;
    ctx.fillRect(x + 25, y - 21, 2, 1);
    ctx.fillRect(x + 28, y - 21, 2, 1);
    ctx.fillRect(x + 31, y - 21, 2, 1);
    ctx.fillStyle = C.green;
    if (running) ctx.fillRect(x + 25, y - 19, Math.floor(t * 4) % 8 + 1, 1);
    // handrail
    ctx.fillStyle = C.navy;
    ctx.fillRect(x + 14, y - 12, 15, 2);
    ctx.fillStyle = C.silver;
    ctx.fillRect(x + 15, y - 12, 13, 1);
    // deck and belt
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 1, y - 1, 36, 7);
    ctx.fillStyle = C.slate;
    ctx.fillRect(x, y + 2, 34, 3);
    ctx.fillStyle = BELT;
    ctx.fillRect(x + 1, y, 32, 2);
    ctx.fillStyle = C.silver;
    const shift = running ? Math.floor(t * 24) % 6 : 0;
    for (let sx = x + 1 + ((6 - shift) % 6); sx < x + 33; sx += 6) ctx.fillRect(sx, y, 2, 1);
  }

  drawBike(t, pedaling) {
    const { ctx } = this;
    const { x, y } = this.bike;
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 1, y - 2, 8, 3); // back foot
    ctx.fillRect(x + 14, y - 2, 11, 3); // front foot
    ctx.fillRect(x + 2, y - 11, 4, 11); // seat post
    ctx.fillRect(x + 2, y - 7, 16, 4); // frame
    ctx.fillRect(x + 15, y - 17, 4, 15); // front post
    ctx.fillRect(x + 13, y - 18, 8, 3); // handlebars
    ctx.fillStyle = C.red;
    ctx.fillRect(x + 3, y - 10, 2, 9);
    ctx.fillRect(x + 3, y - 6, 14, 2);
    ctx.fillRect(x + 16, y - 16, 2, 13);
    ctx.fillStyle = C.silver;
    ctx.fillRect(x + 14, y - 17, 6, 1);
    ctx.fillStyle = C.navy;
    ctx.fillRect(x, y - 13, 8, 3); // seat
    // flywheel
    const cx = x + 21;
    const cy = y - 6;
    disc(ctx, cx, cy, 5, C.navy);
    disc(ctx, cx, cy, 4, C.silver);
    disc(ctx, cx, cy, 1, C.navy);
    const angle = pedaling ? t * 10 : 0.6;
    ctx.fillStyle = C.navy;
    for (let i = 1; i <= 3; i++) ctx.fillRect(Math.round(cx + Math.cos(angle) * i), Math.round(cy + Math.sin(angle) * i), 1, 1);
    // pedal crank
    const pa = pedaling ? t * 8 : 0;
    ctx.fillStyle = C.slate;
    ctx.fillRect(Math.round(x + 9 + Math.cos(pa) * 2), Math.round(y - 5 + Math.sin(pa) * 2), 2, 1);
  }

  drawBench() {
    const { ctx } = this;
    const { x, y } = this.bench;
    ctx.fillStyle = C.navy;
    ctx.fillRect(x + 1, y - 5, 4, 5); // legs
    ctx.fillRect(x + 17, y - 5, 4, 5);
    ctx.fillRect(x + 21, y - 17, 4, 17); // rack upright
    ctx.fillRect(x - 1, y - 8, 24, 4); // pad
    ctx.fillStyle = C.slate;
    ctx.fillRect(x + 2, y - 4, 2, 4);
    ctx.fillRect(x + 18, y - 4, 2, 4);
    ctx.fillRect(x + 22, y - 16, 2, 16);
    ctx.fillStyle = C.red;
    ctx.fillRect(x, y - 7, 22, 2);
    ctx.fillStyle = C.pink;
    ctx.fillRect(x + 1, y - 7, 6, 1);
  }

  /** The barbell rests on the rack, or goes up and down while she's pressing. */
  drawBarbell(t, pressing) {
    const { ctx } = this;
    const { x, y } = this.bench;
    const lift = pressing ? (Math.floor(t * 2) % 2 ? 4 : 0) : 0;
    const bx = pressing ? x + 3 : x + 15;
    const by = pressing ? y - 25 - lift : y - 18;
    ctx.fillStyle = C.silver;
    ctx.fillRect(bx, by + 2, 18, 1);
    ctx.fillStyle = C.navy;
    ctx.fillRect(bx - 1, by - 1, 4, 7);
    ctx.fillRect(bx + 15, by - 1, 4, 7);
    ctx.fillStyle = C.blue;
    ctx.fillRect(bx, by, 2, 5);
    ctx.fillRect(bx + 16, by, 2, 5);
  }

  drawBag(t, punching) {
    const { ctx } = this;
    const { x, y } = this.bag;
    const swing = punching ? (Math.floor(t * 6) % 2 ? 1 : -1) : 0;
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 4, y - 2, 10, 3); // base
    ctx.fillRect(x - 1, y - 33, 4, 32); // pole
    ctx.fillRect(x - 1, y - 33, 13, 3); // arm
    ctx.fillStyle = C.slate;
    ctx.fillRect(x, y - 32, 2, 31);
    ctx.fillRect(x, y - 32, 11, 1);
    ctx.fillStyle = C.silver;
    ctx.fillRect(x + 9 + swing, y - 30, 1, 3); // chain
    ctx.fillStyle = C.navy;
    ctx.fillRect(x + 5 + swing, y - 28, 9, 16);
    ctx.fillStyle = C.red;
    ctx.fillRect(x + 6 + swing, y - 27, 7, 14);
    ctx.fillStyle = C.pink;
    ctx.fillRect(x + 7 + swing, y - 26, 1, 10);
    ctx.fillStyle = C.plum;
    ctx.fillRect(x + 6 + swing, y - 22, 7, 1);
  }

  drawHurdle(h) {
    const { ctx } = this;
    ctx.fillStyle = C.navy;
    ctx.fillRect(h.x - 1, h.y - 8, 3, 9);
    ctx.fillRect(h.x + 11, h.y - 8, 3, 9);
    ctx.fillRect(h.x - 1, h.y - 7, 15, 3);
    ctx.fillStyle = C.cream;
    ctx.fillRect(h.x, h.y - 7, 1, 8);
    ctx.fillRect(h.x + 12, h.y - 7, 1, 8);
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = Math.floor(i / 3) % 2 ? C.cream : C.red;
      ctx.fillRect(h.x + i, h.y - 6, 1, 1);
    }
  }

  drawTunnel() {
    const { ctx } = this;
    const { x, y, w } = this.tunnel;
    ctx.fillStyle = C.navy;
    ctx.fillRect(x - 1, y - 14, w + 2, 15);
    for (let i = 0; i < w; i++) {
      ctx.fillStyle = Math.floor(i / 3) % 2 ? C.yellow : C.blue;
      ctx.fillRect(x + i, y - 13, 1, 13);
    }
    ctx.fillStyle = 'rgba(29, 43, 83, 0.25)';
    ctx.fillRect(x, y - 4, w, 4);
    ctx.fillStyle = C.navy; // dark openings
    ctx.fillRect(x - 1, y - 12, 3, 11);
    ctx.fillRect(x + w - 2, y - 12, 3, 11);
  }

  drawMat() {
    const { ctx } = this;
    const { x, y, w } = this.mat;
    ctx.fillStyle = C.plum;
    ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = C.pink;
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = '#FF9BC0';
    for (let i = 2; i < w; i += 4) ctx.fillRect(x + i, y + 1, 1, 3);
  }

  drawKettlebells() {
    const { ctx } = this;
    const { x, y } = this.kettlebells;
    for (const [dx, color] of [[0, C.slate], [9, C.red]]) {
      ctx.fillStyle = C.navy;
      ctx.fillRect(x + dx, y - 1, 7, 8);
      ctx.fillRect(x + dx + 1, y - 3, 5, 3);
      ctx.fillStyle = color;
      ctx.fillRect(x + dx + 1, y + 1, 5, 5);
      ctx.fillStyle = PLANK; // hole in the handle
      ctx.fillRect(x + dx + 2, y - 2, 3, 1);
    }
  }

  drawExerciseBall(t) {
    const { ctx } = this;
    const { x } = this.exerciseBall;
    const y = this.exerciseBall.y - (Math.sin(t * 1.5) > 0.85 ? 1 : 0);
    ctx.fillStyle = 'rgba(29, 43, 83, 0.25)';
    ctx.fillRect(x - 5, this.exerciseBall.y + 6, 11, 2);
    disc(ctx, x, y, 7, C.navy);
    disc(ctx, x, y, 6, C.blue);
    disc(ctx, x - 2, y - 3, 2, C.sky3);
  }
}
