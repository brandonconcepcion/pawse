import {
  loadDogs, saveDog, deleteDog,
  loadSessions, saveSession, deleteSession,
  loadWeights, saveWeight, deleteWeight,
  replaceEverything, legacySessions,
} from './db.js';
import { timer } from './timer.js';
import { unlockAudio, playBlip, playStart, playChime, playCall, isMuted, setMuted } from './sound.js';
import { COATS, SIZES, iconURL, dogTileURL, dogSpriteURL, pixelatePhoto } from './pixel.js';
import { ParkScene } from './scene.js';
import { GymScene } from './gym-scene.js';
import { TOY_COLORS, DEFAULT_COLOR, FRAMES, SPRITE, SHELF_TOP_ROW, toyLook, toySpriteURL, toySpan, toySize, WIDE_PAD_ROWS, shelfFrame, plankURL, wallpaperURL, portraitURL } from './toys.js';
import { weeklySummary, foodVsWeight, recentPace, goalProgress, weekOf, isoDate, toDate } from './gym.js';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const PRESETS = [5, 10, 15, 20, 30, 45];
const BAR_SEGMENTS = 20;
const MIN_LOGGED_SECONDS = 60; // ending early only saves sessions at least this long
const MASCOT = { id: 'pawse-mascot', name: 'Pawse', coat: 'golden', mascot: true };
const DAY = 24 * 60 * 60 * 1000;

const TOY_KINDS = [
  { id: 'ball', label: 'Ball' },
  { id: 'rope', label: 'Rope' },
  { id: 'squeaky', label: 'Squeaky' },
  { id: 'plush', label: 'Plush' },
  { id: 'chew', label: 'Chew' },
  { id: 'frisbee', label: 'Frisbee' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'other', label: 'Other' },
  // Custom models recreated from the owner's photos (js/toys.js). `icon` is the flat 8×8 icon for small spots.
  { id: 'sweater-bear', label: 'Sweater Bear', icon: 'plush' },
  { id: 'nacho-chip', label: 'Nacho Chip', icon: 'plush' },
  { id: 'dogquila', label: 'Dogquila', icon: 'plush' },
  { id: 'lamb-chop', label: 'Lamb Chop', icon: 'plush' },
  { id: 'pup-light', label: 'Pup Light', icon: 'plush' },
  { id: 'blue-rubbin', label: 'Blue Rubbin', icon: 'plush' },
  { id: 'chuckit', label: 'Chuckit!', icon: 'ball' },
  { id: 'giant-ball', label: 'Giant Tennis Ball', icon: 'ball' },
];

function toyIcon(kind) {
  const known = TOY_KINDS.find((k) => k.id === kind);
  return iconURL(known?.icon ?? (known ? kind : 'other'));
}

// What a brand-new visitor starts with: Teddy and Cookie (and, through DEFAULT_TOYS, the toys on the wall). Only names,
// pixel looks and sizes. No photos, birthdays, weights, food, or play sessions are ever pre-filled.
const DEFAULT_DOGS = [
  { id: 'default-cookie', name: 'Cookie', coat: 'cookie', size: 'plump' },
  { id: 'default-teddy', name: 'Teddy', coat: 'teddy', size: 'small' },
];
const DEFAULT_DOGS_KEY = 'pawse.defaultDogsAdded';

// Toys added to a dog automatically, once. The dog remembers it got them (`defaultToys`), so a deleted one stays deleted.
const DEFAULT_TOYS = [
  {
    dog: 'teddy',
    toy: {
      id: 'default-sweater-bear',
      name: 'Sweater Bear',
      kind: 'sweater-bear',
      color: 'red',
      rating: 4,
      notes: 'Brown bear in a red, navy & white sweater, with a fluffy white hat.',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-nacho-chip',
      name: 'Nacho Chip',
      kind: 'nacho-chip',
      color: 'orange',
      rating: 4,
      notes: 'Big plush nacho-cheese tortilla chip (a giant Dorito).',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-dogquila',
      name: 'Dogquila',
      kind: 'dogquila',
      color: 'gray',
      rating: 4,
      notes: 'Fuzzyard Silver Dogquila: a plush tequila bottle. Slobber responsibly.',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-lamb-chop',
      name: 'Lamb Chop',
      kind: 'lamb-chop',
      color: 'white',
      rating: 4,
      notes: 'Big plush lamb with red hooves. Takes two spots on the shelf.',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-pup-light',
      name: 'Pup Light',
      kind: 'pup-light',
      color: 'blue',
      rating: 4,
      notes: 'Plush beer can, a Bud Light parody. Crinkly and squeaky.',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-blue-rubbin',
      name: 'Pups Blue Rubbin',
      kind: 'blue-rubbin',
      color: 'white',
      rating: 4,
      notes: 'Plush beer can, a Pabst Blue Ribbon parody. Pairs with the Pup Light.',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-chuckit',
      name: 'Chuckit!',
      kind: 'chuckit',
      color: 'blue',
      rating: 4,
      notes: 'Ball launcher and its orange ball, side by side. Takes two spots on the shelf.',
    },
  },
  {
    dog: 'teddy',
    toy: {
      id: 'default-giant-ball',
      name: 'Giant Tennis Ball',
      kind: 'giant-ball',
      color: 'lime',
      rating: 4,
      notes: 'A comically huge inflatable tennis ball. Takes two spots on the shelf.',
    },
  },
];

const RATING_CAPTIONS = ['', "Meh, it's fine", 'Plays with it sometimes', 'A solid favorite', 'Loves it!', 'OBSESSED!!'];

const PLAY_MESSAGES = [
  'ZOOMIES IN PROGRESS...',
  'FETCH MODE: ON',
  'TAIL WAGS DETECTED',
  "WHO'S A GOOD PUP?",
  'TUG-OF-WAR CHAMPION',
  'SQUEAK SQUEAK SQUEAK!',
  'QUICK SNIFF BREAK...',
  'BALL IS LIFE',
];

const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const joinNames = (names) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;

function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function ageOf(birthday) {
  if (!birthday) return '';
  const born = new Date(`${birthday}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return years === 1 ? '1 year old' : `${years} years old`;
  }
  if (months >= 1) return months === 1 ? '1 month old' : `${months} months old`;
  return 'Brand new pup';
}

const todayISO = () => isoDate(new Date());

const startOfDay = (ts) => new Date(ts).setHours(0, 0, 0, 0);

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

const sortedToys = (dog) =>
  [...dog.toys].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

const dogDetails = (dog) => [dog.breed, ageOf(dog.birthday)].filter(Boolean).join(' · ');

const pixelImg = (src, size, extra = '', height = size) =>
  `<img class="px-img ${extra}" src="${src}" alt="" width="${size}" height="${height}">`;

/** A toy's sprite at `scale` CSS px per art pixel. Big toys (two shelf slots) are wider and get a `wide` class. */
function toyImg(toy, frame, scale, extra) {
  const { w, h } = toySize(toy);
  return pixelImg(toySpriteURL(toy, frame), w * scale, `${extra}${w > SPRITE ? ' wide' : ''}`, h * scale);
}

function avatar(dog, size) {
  const src = dog?.photoPixel || dogTileURL(dog?.coat ?? 'golden', dog?.size);
  return `<div class="avatar" style="--s:${size}px">${pixelImg(src, size)}</div>`;
}

const bones = (rating) =>
  Array.from({ length: 5 }, (_, i) => pixelImg(iconURL('bone'), 20, i < rating ? '' : 'dim')).join('');

// Shrinks a picked photo so storage stays small and lists stay snappy.
function resizePhoto(file, maxDimension = 700) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo"));
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Play log math
// ---------------------------------------------------------------------------

const totalSeconds = (sessions) => sessions.reduce((sum, s) => sum + s.duration, 0);
const sessionsFor = (dog) => state.sessions.filter((s) => s.dogIds.includes(dog.id));
const since = (sessions, ts) => sessions.filter((s) => s.startedAt >= ts);

/** Days in a row with at least one session, counting back from today (or yesterday). */
function dayStreak(sessions) {
  const days = new Set(sessions.map((s) => startOfDay(s.startedAt)));
  let day = startOfDay(Date.now());
  if (!days.has(day)) day = startOfDay(day - DAY / 2);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = startOfDay(day - DAY / 2);
  }
  return streak;
}

function dayLabel(ts) {
  const day = startOfDay(ts);
  const today = startOfDay(Date.now());
  if (day === today) return 'TODAY';
  if (day === startOfDay(today - DAY / 2)) return 'YESTERDAY';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(day).toUpperCase();
}

// ---------------------------------------------------------------------------
// App state & routing
// ---------------------------------------------------------------------------

const state = {
  dogs: [],
  sessions: [],
  weights: [],
  route: parseRoute(),
  calling: false, // true while the "wanna play?" call is playing
};

const $view = document.getElementById('view');
const $overlay = document.getElementById('overlay');
const scene = new ParkScene(document.getElementById('park'), document.getElementById('dog-labels'), () => ({
  phase: state.calling ? 'calling' : timer.phase,
  progress: timer.progress(),
}));
const gymScene = new GymScene(document.getElementById('park'), document.getElementById('dog-labels'), () => ({
  phase: 'gym',
  progress: 0,
}));
const activeScene = () => (state.route.name === 'gym' ? gymScene : scene);

let pendingPhoto; // photo picked in the dog editor but not yet saved (undefined = unchanged)

function parseRoute() {
  // The app opens on the Toy Wall. Unless a play timer is counting down: then it opens in the park, where the timer is.
  if (!location.hash.replace(/^#\/?/, '')) return { name: timer.phase === 'running' || timer.phase === 'paused' ? 'play' : 'toys' };
  const [section, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (section === 'dogs' && id) return { name: 'dog', id: decodeURIComponent(id) };
  if (section === 'dogs') return { name: 'dogs' };
  if (section === 'log') return { name: 'log' };
  if (section === 'toys') return { name: 'toys' };
  if (section === 'gym') return { name: id === 'stats' ? 'gymStats' : 'gym' };
  return { name: 'play' };
}

const findDog = (id) => state.dogs.find((d) => d.id === id);
const getMinutes = () => Number(localStorage.getItem('pawse.minutes')) || 15;
const setMinutes = (m) => localStorage.setItem('pawse.minutes', String(m));

function render() {
  const { route } = state;
  renderTabBar();
  const tab = { dog: 'dogs', gymStats: 'gym' }[route.name] ?? route.name;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  document.body.classList.toggle('immersive', route.name === 'play' || route.name === 'gym');
  document.body.classList.toggle('toy-room', route.name === 'toys');

  if (route.name === 'play') {
    gymScene.stop();
    renderPlay();
    scene.start();
    return;
  }
  if (route.name === 'gym') {
    scene.stop();
    renderGym();
    gymScene.start();
    return;
  }
  scene.stop();
  gymScene.stop();
  if (route.name === 'dogs') renderDogList();
  else if (route.name === 'gymStats') renderGymStats();
  else if (route.name === 'log') renderLog();
  else if (route.name === 'toys') renderToys();
  else renderDogProfile(route.id);
}

window.addEventListener('hashchange', () => {
  state.route = parseRoute();
  render();
  window.scrollTo(0, 0);
});

// ---------------------------------------------------------------------------
// Play screen (floating panels over the full-screen park)
// ---------------------------------------------------------------------------

/** Which dogs are out in the park: everyone while idle, only the players during a session. */
function parkDogs() {
  if (timer.phase === 'idle') return state.dogs.length ? state.dogs : [MASCOT];
  const playing = state.dogs.filter((d) => timer.playing.includes(d.id));
  return playing.length ? playing : [MASCOT];
}

function syncScene() {
  scene.setDogs(parkDogs().map((d) => ({ id: d.id, name: d.name, coat: d.coat ?? 'golden', size: d.size ?? 'regular', mascot: !!d.mascot })));
  requestAnimationFrame(measureInsets);
}

function measureInsets() {
  const top = document.querySelector('.play-top')?.getBoundingClientRect().bottom ?? 0;
  // On phones the panels span the screen, so keep dogs between them. On wide screens the
  // panels sit in a center column, so dogs get the whole lawn (just not under the tab bar).
  const panel = window.innerWidth >= 700 ? document.querySelector('.tabbar') : document.getElementById('play-bottom');
  const bottom = panel ? window.innerHeight - panel.getBoundingClientRect().top : 0;
  activeScene().setInsets(top, bottom);
}

function renderPlay() {
  const { phase } = timer;
  const minutes = getMinutes();

  const who = state.dogs.length
    ? `<h2 class="label">WHO'S PLAYING?</h2>
       <div class="chips">
         ${state.dogs.map((dog) => {
           const on = timer.selected.includes(dog.id);
           return `<button class="chip ${on ? 'on' : ''}" data-action="toggle-dog" data-id="${escapeHTML(dog.id)}">
             ${avatar(dog, 28)}<span>${escapeHTML(dog.name)}</span>
           </button>`;
         }).join('')}
       </div>`
    : `<p class="hint">Add your pups in <a href="#/dogs">MY DOGS</a> to see them in the park!</p>`;

  const setup = phase !== 'idle' ? '' : `
    <section class="setup px-box">
      ${who}
      <div class="stepper">
        <button class="px-btn square" data-action="minutes" data-delta="-1" ${minutes <= 1 ? 'disabled' : ''} aria-label="One minute less">-</button>
        <div class="minutes">${minutes}<small>MIN</small></div>
        <button class="px-btn square" data-action="minutes" data-delta="1" ${minutes >= 120 ? 'disabled' : ''} aria-label="One minute more">+</button>
      </div>
      <div class="presets">
        ${PRESETS.map((p) => `<button class="preset ${p === minutes ? 'on' : ''}" data-action="preset" data-minutes="${p}">${p}</button>`).join('')}
      </div>
    </section>`;

  const controls = {
    idle: state.calling
      ? `<button class="px-btn warn big calling" disabled>${pixelImg(iconURL('call'), 24)} CALLING...</button>`
      : `<button class="px-btn warn call" data-action="call">${pixelImg(iconURL('call'), 24)} WANNA<br>PLAY?</button>
         <button class="px-btn go big" data-action="start">▶ START</button>`,
    running: `<button class="px-btn" data-action="end">■ END</button>
              <button class="px-btn warn" data-action="pause">❚❚ PAUSE</button>`,
    paused: `<button class="px-btn" data-action="end">■ END</button>
             <button class="px-btn go" data-action="resume">▶ RESUME</button>`,
    finished: '',
  }[phase];

  $view.innerHTML = `
    <div class="play-top">
      ${installHint()}
      <header class="page-header">
        <h1 class="logo">PAWSE</h1>
        <div class="header-actions">
          <button class="px-btn tiny" data-action="toggle-sound" aria-label="Sound">${isMuted() ? 'SFX OFF' : 'SFX ON'}</button>
        </div>
      </header>
      <section class="hud px-box">
        <div class="hud-row">
          <span class="time" id="hud-time"></span>
          <span class="status" id="hud-status"></span>
        </div>
        <div class="bar" id="hud-bar">${'<i></i>'.repeat(BAR_SEGMENTS)}</div>
      </section>
    </div>
    <div class="play-bottom" id="play-bottom">
      ${setup}
      <div class="controls">${controls}</div>
    </div>
  `;
  lastHUD = '';
  updateHUD();
  syncScene();
}

function statusMessage(now) {
  switch (timer.phase) {
    case 'idle':
      if (state.calling) return `> HEY ${callName().toUpperCase()}! WANNA PLAY?!`;
      return Math.floor(now / 4000) % 2 ? '> TAP A PUP FOR A TRICK!' : '> READY? PRESS START!';
    case 'paused': return '> PAUSED. WATER BREAK!';
    case 'finished': return '> ALL DONE!';
    default: {
      const elapsed = timer.total - timer.remaining(now);
      return `> ${PLAY_MESSAGES[Math.floor(elapsed / 20) % PLAY_MESSAGES.length]}`;
    }
  }
}

let lastHUD = '';

function updateHUD() {
  const timeEl = document.getElementById('hud-time');
  if (!timeEl) return;
  const now = Date.now();
  const remaining = timer.phase === 'idle' ? getMinutes() * 60 : timer.remaining(now);
  const filled = Math.floor(timer.progress(now) * BAR_SEGMENTS);
  const status = statusMessage(now);
  const key = `${formatClock(remaining)}|${filled}|${status}`;
  if (key === lastHUD) return;
  lastHUD = key;
  timeEl.textContent = formatClock(remaining);
  document.querySelectorAll('#hud-bar i').forEach((seg, i) => seg.classList.toggle('on', i < filled));
  document.getElementById('hud-status').textContent = status;
}

// One steady clock drives the countdown display and notices when time is up.
setInterval(() => {
  if (timer.tick()) onTimerFinished();
  else if (state.route.name === 'play') updateHUD();
  else if (state.route.name === 'gym') updateGymStatus();
}, 250);

function startSession() {
  unlockAudio();
  playStart();
  requestWakeLock();
  const dogs = state.dogs.filter((d) => timer.selected.includes(d.id));
  timer.start(getMinutes(), dogs);
  if (state.route.name === 'play') renderPlay();
}

/** Who the call is for: the picked dog, "pups" for a group, or "pup". */
function callName() {
  const picked = state.dogs.filter((d) => timer.selected.includes(d.id));
  if (picked.length === 1) return picked[0].name;
  return picked.length ? 'pups' : 'pup';
}

async function logSession({ completed, duration }) {
  const session = {
    id: newId(),
    startedAt: timer.startedAt ?? Date.now() - duration * 1000,
    endedAt: Date.now(),
    duration: Math.round(duration),
    planned: timer.total,
    completed,
    dogIds: [...timer.playing],
    dogNames: [...timer.playingNames],
  };
  state.sessions.unshift(session);
  await saveSession(session);
}

function onTimerFinished() {
  logSession({ completed: true, duration: timer.total });
  releaseWakeLock();
  playChime();
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  render();
  showCelebration();
}

// Keep the screen awake while playing so the countdown (and chime) aren't interrupted.
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    // Not allowed right now (e.g. low battery mode). The timer still works.
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (timer.tick()) onTimerFinished();
  else if (timer.phase === 'running') requestWakeLock();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    activeScene().resize();
    if (state.route.name === 'play' || state.route.name === 'gym') measureInsets();
    if (state.route.name === 'toys') renderToys(); // shelves hold more toys on wider screens
  }, 150);
});

// Tap a dog in the park and it does a trick.
document.getElementById('park').addEventListener('pointerdown', (event) => {
  if (state.route.name !== 'play' && state.route.name !== 'gym') return;
  if (activeScene().pokeAt(event.clientX, event.clientY)) {
    unlockAudio();
    playBlip(true);
  }
});

// ---------------------------------------------------------------------------
// Celebration
// ---------------------------------------------------------------------------

function showCelebration() {
  const names = timer.playingNames;
  const time = formatDuration(timer.total);
  const playedDogs = state.dogs.filter((d) => timer.playing.includes(d.id));
  const party = playedDogs.length ? playedDogs : [{ coat: 'golden' }];
  const subtitle = names.length
    ? `${escapeHTML(joinNames(names))} played for ${time}. Good ${names.length === 1 ? 'pup' : 'pups'}!`
    : `Great ${time} session!`;

  const colors = ['#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#FF77A8'];
  const confetti = Array.from({ length: 36 }, (_, i) => {
    const style = [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `background:${colors[i % colors.length]}`,
      `animation-duration:${(2.5 + Math.random() * 2).toFixed(2)}s`,
      `animation-delay:${(Math.random() * 2).toFixed(2)}s`,
    ].join(';');
    return `<i style="${style}"></i>`;
  }).join('');

  $overlay.innerHTML = `
    <div class="celebrate" role="dialog" aria-label="Play time's over">
      <div class="confetti" aria-hidden="true">${confetti}</div>
      <div class="celebrate-body">
        <p class="stage blink">${pixelImg(iconURL('star'), 16)} STAGE CLEAR ${pixelImg(iconURL('star'), 16)}</p>
        <div class="party">
          ${party.slice(0, 4).map((dog, i) => `
            <span class="hopper" style="animation-delay:${i * 0.15}s">${pixelImg(dogSpriteURL(dog.coat ?? 'golden', 'jump', 1, dog.size), 80)}</span>`).join('')}
        </div>
        <h1>PLAY TIME<br>OVER!</h1>
        <p class="sub">${subtitle}</p>
        <div class="px-box water">${pixelImg(iconURL('heart'), 16)} Time for water & a rest</div>
      </div>
      <div class="celebrate-actions">
        <button class="px-btn go big" data-action="celebrate-done">✓ DONE</button>
        <button class="px-btn" data-action="play-again">↻ PLAY AGAIN</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// My Dogs
// ---------------------------------------------------------------------------

function renderDogList() {
  const list = state.dogs.length
    ? `<div class="dog-list">
        ${state.dogs.map((dog) => {
          const top = sortedToys(dog)[0];
          const details = dogDetails(dog);
          return `<a class="dog-row px-box" href="#/dogs/${encodeURIComponent(dog.id)}">
            ${avatar(dog, 56)}
            <div class="dog-row-text">
              <div class="dog-name">${escapeHTML(dog.name)}</div>
              ${details ? `<div class="muted">${escapeHTML(details)}</div>` : ''}
              ${top ? `<div class="loves">${pixelImg(toyIcon(top.kind), 16)} LOVES ${escapeHTML(top.name.toUpperCase())}</div>` : ''}
            </div>
            <span class="chevron">▶</span>
          </a>`;
        }).join('')}
      </div>`
    : `<div class="empty px-box">
        ${pixelImg(dogSpriteURL('golden', 'wag', 0), 120)}
        <h2>NO PUPS YET</h2>
        <p class="muted">Add your dog to keep track of their favorite toys, treats, and play time.</p>
        <button class="px-btn go" data-action="add-dog">+ ADD A DOG</button>
      </div>`;

  $view.innerHTML = `
    <header class="page-header">
      <h1 class="logo">MY DOGS</h1>
      <button class="px-btn go square" data-action="add-dog" aria-label="Add a dog">+</button>
    </header>
    ${list}
    ${backupBox()}`;
}

function renderDogProfile(id) {
  const dog = findDog(id);
  if (!dog) {
    location.hash = '#/dogs';
    return;
  }
  const toys = sortedToys(dog);
  const details = dogDetails(dog);
  const mine = sessionsFor(dog);
  const recent = mine.slice(0, 5);
  const timeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  $view.innerHTML = `
    <header class="page-header nav">
      <a href="#/dogs" class="px-btn tiny">◀ BACK</a>
      <button class="px-btn tiny" data-action="edit-dog" data-id="${escapeHTML(dog.id)}">EDIT</button>
    </header>

    <div class="profile">
      ${avatar(dog, 128)}
      <h1>${escapeHTML(dog.name)}</h1>
      ${details ? `<div class="muted">${escapeHTML(details)}</div>` : ''}
    </div>

    <section class="px-box card">
      <h2 class="label">FAVORITE TOYS</h2>
      ${toys.length ? '' : '<p class="muted">No toys yet. What do they go crazy for?</p>'}
      ${toys.map((toy) => `
        <button class="toy-row" data-action="view-toy" data-id="${escapeHTML(toy.id)}">
          ${toyImg(toy, shelfFrame(toy), 2, 'toy-thumb')}
          <span class="toy-text">
            <span class="toy-name">${escapeHTML(toy.name)}</span>
            ${toy.notes ? `<span class="muted">${escapeHTML(toy.notes)}</span>` : ''}
          </span>
          <span class="mini-bones">${bones(toy.rating)}</span>
        </button>`).join('')}
      <div class="toy-buttons">
        <button class="px-btn small" data-action="add-toy" data-dog="${escapeHTML(dog.id)}">+ ADD TOY</button>
        <a class="px-btn small" href="#/toys">TOY WALL ▶</a>
      </div>
    </section>

    ${dog.treat || dog.notes ? `
      <section class="px-box card">
        <h2 class="label">GOOD TO KNOW</h2>
        ${dog.treat ? `<div class="kv"><span class="muted">Favorite treat</span><span>${escapeHTML(dog.treat)}</span></div>` : ''}
        ${dog.notes ? `<p class="notes">${escapeHTML(dog.notes)}</p>` : ''}
      </section>` : ''}

    <section class="px-box card">
      <h2 class="label">PLAY STATS</h2>
      <div class="kv"><span class="muted">This week</span><span>${formatDuration(totalSeconds(since(mine, startOfWeek())))}</span></div>
      <div class="kv"><span class="muted">All time</span><span>${formatDuration(totalSeconds(mine))}</span></div>
      <div class="kv"><span class="muted">Sessions</span><span>${mine.length}</span></div>
      ${recent.map((s) => `
        <div class="kv session"><span>${pixelImg(iconURL('paw'), 16)} ${timeFormat.format(new Date(s.startedAt))}</span><span class="muted">${formatDuration(s.duration)}</span></div>`).join('')}
      ${mine.length > recent.length ? '<a class="px-btn small" href="#/log">SEE FULL LOG</a>' : ''}
    </section>`;
}

// ---------------------------------------------------------------------------
// Play log
// ---------------------------------------------------------------------------

function renderLog() {
  const { sessions } = state;
  const now = Date.now();
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = startOfDay(today - (6 - i) * DAY + DAY / 2);
    const end = start + DAY;
    const seconds = totalSeconds(sessions.filter((s) => s.startedAt >= start && s.startedAt < end));
    return { start, minutes: Math.round(seconds / 60) };
  });
  const most = Math.max(...days.map((d) => d.minutes), 1);
  const dayLetter = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  const groups = [];
  for (const s of sessions) {
    const label = dayLabel(s.startedAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, sessions: [] });
    groups.at(-1).sessions.push(s);
  }

  const list = sessions.length
    ? groups.map((g) => `
        <h3 class="label day-label">${g.label}</h3>
        <div class="px-box session-list">
          ${g.sessions.map((s) => {
            const dogs = s.dogIds.map(findDog).filter(Boolean);
            const who = s.dogNames.length ? joinNames(s.dogNames) : 'Solo session';
            return `<div class="session-row">
              <div class="session-dogs">${dogs.slice(0, 3).map((d) => avatar(d, 28)).join('') || pixelImg(dogSpriteURL('golden', 'wag', 0), 32)}</div>
              <div class="session-text">
                <div class="session-who">${escapeHTML(who)}</div>
                <div class="muted">${timeFormat.format(new Date(s.startedAt))} · ${formatDuration(s.duration)}</div>
              </div>
              <span class="badge ${s.completed ? 'clear' : 'early'}">${s.completed ? `${pixelImg(iconURL('star'), 8)} CLEAR` : 'ENDED<br>EARLY'}</span>
              <button class="px-btn tiny" data-action="delete-session" data-id="${escapeHTML(s.id)}" aria-label="Delete session">X</button>
            </div>`;
          }).join('')}
        </div>`).join('')
    : `<div class="empty px-box">
        ${pixelImg(dogSpriteURL('golden', 'sleep', 0), 120)}
        <h2>NO PLAY YET</h2>
        <p class="muted">Finished sessions show up here. Head to the park and press START!</p>
        <a class="px-btn go" href="#/play">▶ GO PLAY</a>
      </div>`;

  $view.innerHTML = `
    <header class="page-header">
      <h1 class="logo">PLAY LOG</h1>
    </header>

    <section class="px-box stats">
      <div><span class="label">THIS WEEK</span><b>${formatDuration(totalSeconds(since(sessions, startOfWeek())))}</b></div>
      <div><span class="label">ALL TIME</span><b>${formatDuration(totalSeconds(sessions))}</b></div>
      <div><span class="label">SESSIONS</span><b>${sessions.length}</b></div>
      <div><span class="label">STREAK</span><b>${dayStreak(sessions)} ${dayStreak(sessions) === 1 ? 'day' : 'days'}</b></div>
    </section>

    <section class="px-box chart-box">
      <h2 class="label">LAST 7 DAYS (MIN)</h2>
      <div class="chart">
        ${days.map((d) => `
          <div class="col ${d.start === today ? 'today' : ''}">
            <span class="mins">${d.minutes || ''}</span>
            <i style="height:${d.minutes ? Math.max(4, Math.round((d.minutes / most) * 20) * 4) : 0}px"></i>
            <span class="day">${dayLetter.format(d.start)}</span>
          </div>`).join('')}
      </div>
    </section>

    ${list}
    ${backupBox()}`;
}

function backupBox() {
  return `
    <section class="backup px-box">
      <p>Your dogs and play log are saved on this phone only. Save a backup now and then so you never lose them.</p>
      <div class="backup-buttons">
        <button class="px-btn small" data-action="export">SAVE BACKUP</button>
        <label class="px-btn small">LOAD BACKUP<input type="file" accept="application/json,.json" name="import" hidden></label>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Toy wall
// ---------------------------------------------------------------------------

const MIN_SHELVES = 4;

/** Every toy the pups have, in one list. The wall is shared, so it doesn't matter whose record a toy sits in. */
const allToys = () => [...new Map(state.dogs.flatMap((d) => d.toys).map((toy) => [toy.id, toy])).values()];

const pupNames = () => joinNames(state.dogs.map((d) => d.name));

/** Pixel scale and toys per shelf, so sprites stay crisp and fill the width. */
function shelfLayout() {
  const scale = window.innerWidth >= 700 ? 4 : 3;
  const inner = $view.clientWidth - 32 - 2 * 4 * scale; // page padding + the bookcase sides
  const columns = Math.max(3, Math.min(8, Math.floor(inner / (SPRITE * scale + 6))));
  return { scale, columns };
}

function renderToys() {
  if (!state.dogs.length) {
    $view.innerHTML = `
      <header class="page-header"><h1 class="logo">TOY WALL</h1></header>
      <div class="empty px-box">
        ${pixelImg(toySpriteURL({ kind: 'ball' }), 128)}
        <h2>NO PUPS YET</h2>
        <p class="muted">Add a dog first. Their toys will show up on the shelves.</p>
        <a class="px-btn go" href="#/dogs">+ ADD A DOG</a>
      </div>`;
    return;
  }
  document.body.style.setProperty('--wallpaper', `url(${wallpaperURL()})`); // for the full-screen wall
  document.body.style.setProperty('--portrait', `url(${portraitURL('teddy')})`); // Teddy's and Cookie's pictures on it
  document.body.style.setProperty('--portrait-cookie', `url(${portraitURL('cookie')})`);

  const toys = sortedToys({ toys: allToys() });
  const { scale, columns } = shelfLayout();
  const slots = [
    ...toys.map((toy) => ({
      span: toySpan(toy),
      html: `
      <button class="toy-slot${toySpan(toy) > 1 ? ' wide' : ''}" data-action="view-toy" data-id="${escapeHTML(toy.id)}">
        ${toyImg(toy, shelfFrame(toy), scale, 'toy-sprite')}
        <span class="toy-tag">${toy.rating === 5 ? pixelImg(iconURL('star'), 8) : ''}<span>${escapeHTML(toy.name)}</span></span>
      </button>`,
    })),
  ];
  // Fill shelves left to right. A big toy that doesn't fit at the end of a shelf starts the next one.
  const EMPTY = '<div class="toy-slot"></div>';
  const shelves = [[]];
  let used = 0;
  for (const { span, html } of slots) {
    if (used + span > columns) {
      shelves.at(-1).push(...Array(columns - used).fill(EMPTY));
      shelves.push([]);
      used = 0;
    }
    shelves.at(-1).push(html);
    used += span;
  }
  shelves.at(-1).push(...Array(columns - used).fill(EMPTY));
  while (shelves.length < MIN_SHELVES) shelves.push(Array(columns).fill(EMPTY));

  $view.innerHTML = `
    <header class="page-header">
      <h1 class="logo">TOY WALL</h1>
    </header>
    <p class="plaque">${escapeHTML(pupNames().toUpperCase())}'S TOYS · ${toys.length}</p>
    <section class="bookcase" style="${shelfStyle(scale)} --cols:${columns}">
      ${shelves.map((shelf) => `<div class="shelf">${shelf.join('')}</div>`).join('')}
    </section>`;
}

/** CSS variables the shelf art needs: pixel scale and the plank/wallpaper tiles. */
const shelfStyle = (scale, top = 0) =>
  `--s:${scale}px; --plank:url(${plankURL()}); --wallpaper:url(${wallpaperURL()}); --shelf-top:${SHELF_TOP_ROW + top};`;

let spinTimer;

/** Tap a toy: it spins on a little shelf, with its details underneath. */
function openToyViewer(toy) {
  const { kind, color } = toyLook(toy);
  const wide = toySpan(toy) > 1;
  const scale = wide ? 5 : 6; // a big toy is twice as wide, so a notch smaller to fit a phone
  openSheet(`
    <div class="toy-viewer">
      <div class="sheet-bar">
        <button type="button" class="px-btn tiny" data-action="close-sheet">CLOSE</button>
        <h2>${escapeHTML(pupNames().toUpperCase())}'S TOY</h2>
        <span></span>
      </div>
      <div class="turntable${wide ? ' wide' : ''}" style="${shelfStyle(scale, toySize(toy).top)}">
        ${toyImg(toy, 0, scale, 'toy-spin')}
      </div>
      <h3 class="toy-title">${escapeHTML(toy.name)}</h3>
      <p class="muted">${TOY_COLORS[color].label} ${TOY_KINDS.find((k) => k.id === kind)?.label ?? ''}</p>
      <div class="rating">
        <div class="mini-bones">${bones(toy.rating)}</div>
        <p>${RATING_CAPTIONS[toy.rating] ?? ''}</p>
      </div>
      ${toy.notes ? `<p class="notes px-box">${escapeHTML(toy.notes)}</p>` : ''}
    </div>`);

  clearInterval(spinTimer);
  let frame = 0;
  spinTimer = setInterval(() => {
    const img = $overlay.querySelector('.toy-spin');
    if (!img) {
      clearInterval(spinTimer);
      return;
    }
    frame = (frame + 1) % FRAMES;
    img.src = toySpriteURL(toy, frame);
  }, 1000 / 8);
}

// ---------------------------------------------------------------------------
// Sheets (dog & toy editors)
// ---------------------------------------------------------------------------

function openSheet(html) {
  $overlay.innerHTML = `
    <div class="backdrop" data-action="close-sheet"></div>
    <div class="sheet" role="dialog">${html}</div>`;
  document.body.classList.add('sheet-open');
}

function closeSheet() {
  $overlay.innerHTML = '';
  document.body.classList.remove('sheet-open');
}

function sheetBar(title) {
  return `
    <div class="sheet-bar">
      <button type="button" class="px-btn tiny" data-action="close-sheet">CANCEL</button>
      <h2>${title}</h2>
      <button type="submit" class="px-btn tiny go">SAVE</button>
    </div>`;
}

function openDogEditor(dog) {
  pendingPhoto = undefined;
  const coat = dog?.coat ?? 'golden';
  const size = dog?.size ?? 'regular';
  openSheet(`
    <form data-form="dog" data-id="${escapeHTML(dog?.id ?? '')}" autocomplete="off">
      ${sheetBar(dog ? 'EDIT DOG' : 'NEW DOG')}
      <label class="photo-pick">
        <input type="file" accept="image/*" name="photo" hidden>
        <span id="photo-preview">${avatar(dog, 112)}</span>
        <span class="px-btn tiny">${dog?.photo ? 'CHANGE PHOTO' : 'ADD PHOTO'}</span>
      </label>

      <div class="group px-box">
        <label class="field"><span>Name</span><input name="name" required maxlength="40" value="${escapeHTML(dog?.name)}" placeholder="Biscuit" autocapitalize="words"></label>
        <label class="field"><span>Breed</span><input name="breed" maxlength="60" value="${escapeHTML(dog?.breed)}" placeholder="Golden Retriever" autocapitalize="words"></label>
        <label class="field"><span>Birthday</span><input type="date" name="birthday" max="${todayISO()}" value="${escapeHTML(dog?.birthday)}"></label>
      </div>

      <h3 class="label group-title">PIXEL COAT</h3>
      <div class="group px-box coat-grid">
        ${Object.entries(COATS).map(([id, c]) => `
          <label class="pick">
            <input type="radio" name="coat" value="${id}" ${id === coat ? 'checked' : ''}>
            ${pixelImg(dogSpriteURL(id, 'sit', 0, size), 60)}
            <span>${c.label}</span>
          </label>`).join('')}
      </div>

      <h3 class="label group-title">SIZE</h3>
      <div class="group px-box size-grid">
        ${Object.entries(SIZES).map(([id, s]) => `
          <label class="pick">
            <input type="radio" name="size" value="${id}" ${id === size ? 'checked' : ''}>
            ${pixelImg(dogSpriteURL(coat, 'walk', 0, id), 60)}
            <span>${s.label}</span>
          </label>`).join('')}
      </div>

      <div class="group px-box">
        <label class="field"><span>Fave treat</span><input name="treat" maxlength="60" value="${escapeHTML(dog?.treat)}" placeholder="Peanut butter"></label>
      </div>

      <div class="group px-box">
        <label class="field stacked"><span>Notes</span><textarea name="notes" rows="3" maxlength="1000" placeholder="Quirks, allergies, vet info...">${escapeHTML(dog?.notes)}</textarea></label>
      </div>

      ${dog ? `<button type="button" class="px-btn danger" data-action="delete-dog" data-id="${escapeHTML(dog.id)}">DELETE ${escapeHTML(dog.name.toUpperCase())}</button>` : ''}
    </form>`);
}

function openToyEditor(dog, toy) {
  const rating = toy?.rating ?? 4;
  const { kind, color } = toyLook(toy ?? { kind: 'ball' });
  openSheet(`
    <form data-form="toy" data-dog="${escapeHTML(dog.id)}" data-id="${escapeHTML(toy?.id ?? '')}" ${toy?.color ? 'data-color-picked' : ''} autocomplete="off">
      ${sheetBar(toy ? 'EDIT TOY' : 'NEW TOY')}

      <div class="turntable${toySpan({ kind }) > 1 ? ' wide' : ''}" style="${shelfStyle(4, toySize({ kind }).top)}">${toyImg({ kind, color }, 0, 4, 'toy-preview-img')}</div>

      <div class="group px-box">
        <label class="field"><span>Name</span><input name="name" required maxlength="50" value="${escapeHTML(toy?.name)}" placeholder="Squeaky Duck" autocapitalize="words"></label>
      </div>

      <h3 class="label group-title">TYPE</h3>
      <div class="group px-box kind-grid">
        ${TOY_KINDS.map((k) => `
          <label class="pick${toySpan({ kind: k.id }) > 1 ? ' wide' : ''}">
            <input type="radio" name="kind" value="${k.id}" ${k.id === kind ? 'checked' : ''}>
            ${toyImg({ kind: k.id }, 0, 2, 'toy-pick')}
            <span>${k.label}</span>
          </label>`).join('')}
      </div>

      <h3 class="label group-title">COLOR</h3>
      <div class="group px-box color-grid">
        ${Object.entries(TOY_COLORS).map(([id, c]) => `
          <label class="swatch" title="${c.label}">
            <input type="radio" name="color" value="${id}" ${id === color ? 'checked' : ''}>
            <i style="--a:${c.ramp[2]}; --b:${c.ramp[1]}"></i>
          </label>`).join('')}
      </div>

      <h3 class="label group-title">LOVE METER</h3>
      <div class="group px-box rating">
        <div class="bones">
          ${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="bone ${v <= rating ? 'on' : ''}" data-action="rate" data-value="${v}" aria-label="${v} bones">${pixelImg(iconURL('bone'), 40)}</button>`).join('')}
        </div>
        <p id="rating-caption">${RATING_CAPTIONS[rating]}</p>
        <input type="hidden" name="rating" value="${rating}">
      </div>

      <div class="group px-box">
        <label class="field stacked"><span>Notes</span><textarea name="notes" rows="2" maxlength="500" placeholder="Where it's hidden, how long it survives...">${escapeHTML(toy?.notes)}</textarea></label>
      </div>

      ${toy ? `<button type="button" class="px-btn danger" data-action="delete-toy" data-dog="${escapeHTML(dog.id)}" data-id="${escapeHTML(toy.id)}">DELETE TOY</button>` : ''}
    </form>`);
}

/** Keeps the editor's sprite previews in sync with the chosen coat and size. */
function refreshDogPreviews(form) {
  const coat = form.elements.coat.value;
  const size = form.elements.size.value;
  form.querySelectorAll('.coat-grid img').forEach((img, i) => {
    img.src = dogSpriteURL(Object.keys(COATS)[i], 'sit', 0, size);
  });
  form.querySelectorAll('.size-grid img').forEach((img, i) => {
    img.src = dogSpriteURL(coat, 'walk', 0, Object.keys(SIZES)[i]);
  });
  const dog = findDog(form.dataset.id);
  if (!pendingPhoto && !dog?.photoPixel) {
    document.getElementById('photo-preview').innerHTML = avatar({ coat, size }, 112);
  }
}

async function submitDog(form) {
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  if (!name) return;
  const existing = findDog(form.dataset.id);
  const dog = existing ?? { id: newId(), createdAt: Date.now(), photo: '', photoPixel: '', toys: [] };
  dog.name = name;
  dog.breed = String(data.get('breed')).trim();
  dog.birthday = String(data.get('birthday'));
  dog.coat = String(data.get('coat') || 'golden');
  dog.size = SIZES[data.get('size')] ? String(data.get('size')) : 'regular';
  dog.treat = String(data.get('treat')).trim();
  dog.notes = String(data.get('notes')).trim();
  if (pendingPhoto !== undefined) {
    dog.photo = pendingPhoto;
    dog.photoPixel = await pixelatePhoto(pendingPhoto);
  }

  await saveDog(dog);
  if (!existing) state.dogs.push(dog);
  state.dogs.sort((a, b) => a.name.localeCompare(b.name));
  closeSheet();
  render();
}

/** Shows the picked type in the picked color. Until a color is chosen, it follows the type's usual color. */
function refreshToyPreview(form, changed) {
  if (changed === 'color') form.dataset.colorPicked = '';
  else if (form.dataset.colorPicked === undefined) form.elements.color.value = DEFAULT_COLOR[form.elements.kind.value];
  const look = { kind: form.elements.kind.value, color: form.elements.color.value };
  const img = form.querySelector('.toy-preview-img');
  const wide = toySpan(look) > 1;
  img.src = toySpriteURL(look);
  img.classList.toggle('wide', wide); // the CSS sizes it
  const turntable = img.closest('.turntable');
  turntable.classList.toggle('wide', wide);
  turntable.style.setProperty('--shelf-top', SHELF_TOP_ROW + toySize(look).top); // keep the plank under the toy
}

async function submitToy(form) {
  const dog = findDog(form.dataset.dog);
  if (!dog) return;
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  if (!name) return;
  const fields = {
    name,
    kind: String(data.get('kind') || 'other'),
    color: TOY_COLORS[data.get('color')] ? String(data.get('color')) : undefined,
    rating: Number(data.get('rating')) || 3,
    notes: String(data.get('notes')).trim(),
  };
  const toy = dog.toys.find((t) => t.id === form.dataset.id);
  if (toy) Object.assign(toy, fields);
  else dog.toys.push({ id: newId(), createdAt: Date.now(), ...fields });

  await saveDog(dog);
  closeSheet();
  render();
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

async function exportBackup() {
  const dogs = state.dogs.map(({ photoPixel, ...dog }) => dog); // pixel portraits are rebuilt on load
  const json = JSON.stringify(
    { app: 'pawse', version: 4, exportedAt: new Date().toISOString(), dogs, sessions: state.sessions, weights: state.weights },
    null,
    2
  );
  const file = new File([json], `pawse-backup-${todayISO()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Pawse backup' });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const strings = (list) => (Array.isArray(list) ? list.map(String) : []);

async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const rawDogs = Array.isArray(parsed) ? parsed : parsed.dogs;
    if (!Array.isArray(rawDogs) || rawDogs.some((d) => typeof d?.name !== 'string')) throw new Error('bad file');
    const dogs = rawDogs.map((d) => ({
      id: String(d.id ?? newId()),
      name: d.name,
      breed: String(d.breed ?? ''),
      birthday: String(d.birthday ?? ''),
      coat: COATS[d.coat] ? d.coat : 'golden',
      size: SIZES[d.size] ? d.size : 'regular',
      ...(Number.isFinite(Number(d.goalWeight)) && Number(d.goalWeight) > 0 ? { goalWeight: Number(d.goalWeight) } : {}),
      treat: String(d.treat ?? ''),
      notes: String(d.notes ?? ''),
      photo: typeof d.photo === 'string' && d.photo.startsWith('data:image/') ? d.photo : '',
      photoPixel: '',
      createdAt: Number(d.createdAt) || Date.now(),
      toys: Array.isArray(d.toys) ? d.toys : [],
      defaultToys: strings(d.defaultToys),
    }));
    // Older backups kept sessions inside each dog.
    const rawSessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
      : legacySessions(rawDogs.map((d, i) => ({ ...d, id: dogs[i].id })));
    const sessions = rawSessions
      .map((s) => {
        const startedAt = Number(s.startedAt);
        const duration = Number(s.duration);
        return {
          id: String(s.id ?? newId()),
          startedAt,
          endedAt: Number(s.endedAt) || startedAt + duration * 1000,
          duration,
          planned: Number(s.planned) || duration,
          completed: s.completed !== false,
          dogIds: strings(s.dogIds),
          dogNames: strings(s.dogNames),
        };
      })
      .filter((s) => s.startedAt && s.duration);

    const weights = (Array.isArray(parsed.weights) ? parsed.weights : [])
      .filter((e) => typeof e?.dogId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e?.date))
      .map((e) => {
        const entry = { id: `${e.dogId}:${e.date}`, dogId: e.dogId, date: e.date };
        if (Number(e.weight) > 0) entry.weight = Number(e.weight);
        if (Number(e.food) > 0) entry.food = Number(e.food);
        return entry;
      });

    if (!confirm(`Replace everything with this backup? (${dogs.length} dogs, ${sessions.length} play sessions, ${weights.length} weigh-in days)`)) return;
    await replaceEverything(dogs, sessions, weights);
    await loadAll();
    render();
  } catch {
    alert("That doesn't look like a Pawse backup file.");
  }
}

/** Fills in fields added after a dog was first saved (pixel coat & portrait). */
async function upgradeDogs() {
  for (const dog of state.dogs) {
    let changed = false;
    if (!dog.coat) {
      dog.coat = 'golden';
      changed = true;
    }
    if (dog.photo && !dog.photoPixel) {
      try {
        dog.photoPixel = await pixelatePhoto(dog.photo);
        changed = true;
      } catch {
        // Leave the sprite tile in place if the photo can't be read.
      }
    }
    if (changed) await saveDog(dog);
  }
}

async function loadAll() {
  state.dogs = await loadDogs();
  state.sessions = await loadSessions();
  state.weights = await loadWeights();
  await upgradeDogs();
  await addDefaultDogs();
  await addDefaultToys();
}

/** First visit on a device with no dogs: add Teddy and Cookie. Only ever once, so deleting them sticks. */
async function addDefaultDogs() {
  const firstTime = !localStorage.getItem(DEFAULT_DOGS_KEY) && !state.dogs.length;
  localStorage.setItem(DEFAULT_DOGS_KEY, '1');
  if (!firstTime) return;
  for (const { id, name, coat, size } of DEFAULT_DOGS) {
    const dog = { id, name, breed: '', birthday: '', coat, size, treat: '', notes: '', photo: '', photoPixel: '', createdAt: Date.now(), toys: [], defaultToys: [] };
    await saveDog(dog);
    state.dogs.push(dog);
  }
}

// Default toys that were taken back out. A dog that already got one loses it on the next load.
const RETIRED_DEFAULT_TOYS = ['default-pochita'];

async function addDefaultToys() {
  for (const dog of state.dogs) {
    const kept = dog.toys.filter((t) => !RETIRED_DEFAULT_TOYS.includes(t.id));
    if (kept.length === dog.toys.length) continue;
    dog.toys = kept;
    await saveDog(dog);
  }
  for (const { dog: name, toy } of DEFAULT_TOYS) {
    const dog = state.dogs.find((d) => d.name.trim().toLowerCase() === name);
    if (!dog || dog.defaultToys?.includes(toy.id)) continue;
    dog.defaultToys = [...(dog.defaultToys ?? []), toy.id];
    if (!dog.toys.some((t) => t.id === toy.id)) dog.toys.push({ ...toy, createdAt: Date.now() });
    await saveDog(dog);
  }
}

// ---------------------------------------------------------------------------
// Gym: daily weight & food tracking for a dog who's getting in shape
// ---------------------------------------------------------------------------

const GYM_MASCOT = { id: 'gym-mascot', name: 'Pawse', coat: 'cookie', size: 'plump', mascot: true };
const GYM_MESSAGES = [
  'FEEL THE BURN!',
  'ONE MORE LAP!',
  'STRONG PUP ENERGY',
  'HYDRATE!',
  'NO SNACKS BETWEEN SETS',
  'LEG DAY!',
  'GOOD FORM, CHAMP',
];

const avgOf = (list) => (list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null);
const lb = (value) => `${value.toFixed(1)} lb`;
const signedLb = (value) => `${value > 0 ? '+' : value < 0 ? '-' : '±'}${Math.abs(value).toFixed(1)} lb`;
const shortDate = (iso) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(toDate(iso));

/** Which dog is training: the one you picked, else Cookie, else a plump pup, else the first dog. */
function gymDog() {
  return (
    findDog(localStorage.getItem('pawse.gymDog')) ??
    state.dogs.find((d) => d.name.trim().toLowerCase() === 'cookie') ??
    state.dogs.find((d) => d.size === 'plump') ??
    state.dogs[0] ??
    null
  );
}

function entriesFor(dog) {
  return state.weights.filter((e) => e.dogId === dog?.id).sort((a, b) => a.date.localeCompare(b.date));
}

function gymStats(dog) {
  const entries = entriesFor(dog);
  const weighIns = entries.filter((e) => Number.isFinite(e.weight));
  const weeks = weeklySummary(entries);
  const weekAgo = isoDate(new Date(Date.now() - 6 * DAY));
  const recent = entries.filter((e) => e.date >= weekAgo);
  const latest = weighIns.at(-1) ?? null;
  const start = weighIns[0] ?? null;
  const goal = Number.isFinite(dog?.goalWeight) ? dog.goalWeight : null;
  const thisWeek = weeks.at(-1)?.week === weekOf(todayISO()) ? weeks.at(-1) : null;
  return {
    entries,
    weeks,
    latest,
    start,
    goal,
    todayEntry: entries.find((e) => e.date === todayISO()) ?? null,
    avgWeight7: avgOf(recent.filter((e) => Number.isFinite(e.weight)).map((e) => e.weight)),
    avgFood7: avgOf(recent.filter((e) => Number.isFinite(e.food)).map((e) => e.food)),
    weekChange: thisWeek?.change ?? null,
    progress: goalProgress(start?.weight, latest?.weight, goal),
    pace: recentPace(weeks),
    link: foodVsWeight(weeks),
  };
}

/** A dog marked Plump slims down on screen as she gets closer to her goal. */
function gymBuild(dog) {
  if (dog.size !== 'plump') return dog.size ?? 'regular';
  const { progress } = gymStats(dog);
  if (progress === null || progress < 0.5) return 'plump';
  return progress < 1 ? 'chubby' : 'small';
}

/** Everyone works out together. Dogs set to Plump slim down on screen as they near their goal. */
function syncGym() {
  const sprites = state.dogs.map((dog) => ({
    id: dog.id,
    name: dog.name,
    coat: dog.coat ?? 'golden',
    size: gymBuild(dog),
  }));
  gymScene.setDogs(sprites.length ? sprites : [GYM_MASCOT]);
  requestAnimationFrame(measureInsets);
}

function goalBar(stats) {
  if (stats.goal === null) {
    return `<p class="gym-goal-hint">Set a goal weight in <a href="#/gym/stats">STATS</a> to track progress.</p>`;
  }
  const filled = Math.round((stats.progress ?? 0) * BAR_SEGMENTS);
  const toGo = stats.latest ? stats.latest.weight - stats.goal : null;
  return `
    <div class="bar">${Array.from({ length: BAR_SEGMENTS }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</div>
    <div class="gym-goal-row">
      <span>GOAL ${stats.goal.toFixed(1)} LB</span>
      <span>${toGo === null ? '' : toGo <= 0 ? 'GOAL REACHED!' : `${toGo.toFixed(1)} LB TO GO`}</span>
    </div>`;
}

function renderGym() {
  const dog = gymDog();
  const stats = gymStats(dog);
  const today = stats.todayEntry;
  const loggedToday = today && Number.isFinite(today.weight) && Number.isFinite(today.food);
  const change = stats.weekChange;

  const body = dog
    ? `
      <div class="gym-stats">
        <div>
          <span class="label">WEIGHT</span>
          <b>${stats.latest ? lb(stats.latest.weight) : '--'}</b>
          <small>${change === null ? (stats.latest ? shortDate(stats.latest.date) : 'not logged yet') : `${change <= 0 ? '▼' : '▲'} ${lb(Math.abs(change))} vs last wk`}</small>
        </div>
        <div>
          <span class="label">FOOD TODAY</span>
          <b>${Number.isFinite(today?.food) ? `${today.food} g` : '--'}</b>
          <small>${stats.avgFood7 === null ? '' : `7-day avg ${Math.round(stats.avgFood7)} g`}</small>
        </div>
      </div>
      ${goalBar(stats)}`
    : `<p class="hint">Add your dog in <a href="#/dogs">MY DOGS</a> (try the Cookie coat & Plump size), then come train!</p>`;

  $view.innerHTML = `
    <div class="play-top">
      <header class="page-header">
        <span></span>
        <h1 class="logo gym-logo">GYM</h1>
        <a href="#/gym/stats" class="px-btn tiny">STATS</a>
      </header>
      <section class="hud px-box gym-hud">
        <div class="gym-title">
          <span class="label">${dog ? `${escapeHTML(dog.name.toUpperCase())}'S TRAINING` : 'TRAINING'}</span>
          <span class="status" id="gym-status"></span>
        </div>
        ${body}
      </section>
    </div>
    <div class="play-bottom" id="play-bottom">
      <div class="controls">
        <button class="px-btn go big" data-action="log-weight" ${dog ? '' : 'disabled'}>
          ${pixelImg(iconURL('scale'), 24)} ${loggedToday ? 'EDIT TODAY' : 'LOG TODAY'}
        </button>
      </div>
    </div>`;
  updateGymStatus(true);
  syncGym();
}

let lastGymTick = -1;

/** Rotates the gym's status line every 4 seconds (runs on the shared 250ms clock). */
function updateGymStatus(force = false) {
  const el = document.getElementById('gym-status');
  const tick = Math.floor(Date.now() / 4000);
  if (!el || (tick === lastGymTick && !force)) return;
  lastGymTick = tick;
  const dog = gymDog();
  const today = dog ? state.weights.find((e) => e.id === `${dog.id}:${todayISO()}`) : null;
  const needsLog = dog && !(Number.isFinite(today?.weight) && Number.isFinite(today?.food));
  el.textContent = needsLog && tick % 2 === 0 ? "> TODAY'S WEIGH-IN!" : `> ${GYM_MESSAGES[tick % GYM_MESSAGES.length]}`;
}

// --- Stats page ---------------------------------------------------------------

const CHART = { w: 300, h: 130, left: 30, right: 6, top: 10, bottom: 22 };
const CHART_DAYS = 56;

function chartFrame(minY, maxY, format, extra) {
  const { w, h, left, right, top, bottom } = CHART;
  const plotH = h - top - bottom;
  const ticks = [minY, (minY + maxY) / 2, maxY];
  const today = toDate(todayISO());
  const xLabels = [CHART_DAYS - 1, CHART_DAYS - 15, CHART_DAYS - 29, CHART_DAYS - 43].map((back) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (CHART_DAYS - 1 - back));
    return { x: chartX(back), label: shortDate(isoDate(d)) };
  });
  return `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img">
      ${ticks.map((v) => {
        const y = Math.round(top + plotH - ((v - minY) / (maxY - minY || 1)) * plotH);
        return `<line x1="${left}" x2="${w - right}" y1="${y}" y2="${y}" class="grid"/>
                <text x="${left - 4}" y="${y + 4}" text-anchor="end">${format(v)}</text>`;
      }).join('')}
      ${xLabels.map((l, i) => `<text x="${l.x}" y="${h - 6}" text-anchor="${i === 0 ? 'end' : 'middle'}">${l.label}</text>`).join('')}
      ${extra}
    </svg>`;
}

/** x position for "days since the start of the chart window" (0 … CHART_DAYS-1). */
function chartX(dayIndex) {
  const { w, left, right } = CHART;
  return Math.round(left + 4 + (dayIndex / (CHART_DAYS - 1)) * (w - left - right - 8));
}

function dayIndex(iso) {
  return Math.round((toDate(iso) - toDate(todayISO())) / DAY) + CHART_DAYS - 1;
}

function chartY(value, minY, maxY) {
  const { h, top, bottom } = CHART;
  const plotH = h - top - bottom;
  return Math.round(top + plotH - ((value - minY) / (maxY - minY || 1)) * plotH);
}

function weeklyLine(weeks, key, minY, maxY) {
  const points = weeks
    .filter((w) => w[key] !== null)
    .map((w) => ({ i: dayIndex(w.week) + 3, v: w[key] })) // plot each week at its middle (Thursday)
    .filter((p) => p.i >= 0 && p.i < CHART_DAYS + 3)
    .map((p) => `${chartX(Math.min(p.i, CHART_DAYS - 1))},${chartY(p.v, minY, maxY)}`);
  return points.length > 1 ? `<polyline points="${points.join(' ')}" class="avg-line"/>` : '';
}

function weightChart(stats) {
  const inRange = stats.entries.filter((e) => Number.isFinite(e.weight) && dayIndex(e.date) >= 0);
  if (!inRange.length) return '<p class="muted">No weigh-ins in the last 8 weeks yet.</p>';
  const values = inRange.map((e) => e.weight).concat(stats.goal ?? []);
  const minY = Math.floor(Math.min(...values) - 0.5);
  const maxY = Math.ceil(Math.max(...values) + 0.5);
  const goalLine = stats.goal === null ? '' : `
    <line x1="${CHART.left}" x2="${CHART.w - CHART.right}" y1="${chartY(stats.goal, minY, maxY)}" y2="${chartY(stats.goal, minY, maxY)}" class="goal-line"/>
    <text x="${CHART.w - CHART.right}" y="${chartY(stats.goal, minY, maxY) - 3}" text-anchor="end" class="goal-text">GOAL</text>`;
  const dots = inRange
    .map((e) => `<rect x="${chartX(dayIndex(e.date)) - 2}" y="${chartY(e.weight, minY, maxY) - 2}" width="4" height="4" class="dot"/>`)
    .join('');
  return chartFrame(minY, maxY, (v) => v.toFixed(0), goalLine + weeklyLine(stats.weeks, 'avgWeight', minY, maxY) + dots);
}

function foodChart(stats) {
  const inRange = stats.entries.filter((e) => Number.isFinite(e.food) && dayIndex(e.date) >= 0);
  if (!inRange.length) return '<p class="muted">No food logged in the last 8 weeks yet.</p>';
  const maxY = Math.ceil((Math.max(...inRange.map((e) => e.food)) * 1.1) / 50) * 50;
  const barW = Math.max(2, Math.floor((CHART.w - CHART.left - CHART.right - 8) / CHART_DAYS) - 1);
  const bars = inRange
    .map((e) => {
      const y = chartY(e.food, 0, maxY);
      return `<rect x="${chartX(dayIndex(e.date)) - Math.floor(barW / 2)}" y="${y}" width="${barW}" height="${chartY(0, 0, maxY) - y}" class="bar-rect"/>`;
    })
    .join('');
  return chartFrame(0, maxY, (v) => Math.round(v), bars + weeklyLine(stats.weeks, 'avgFood', 0, maxY));
}

function insightHTML(stats) {
  const { link, pace } = stats;
  const paceText = pace
    ? pace.perWeek < -0.05
      ? `Losing <b>${Math.abs(pace.perWeek).toFixed(2)} lb/week</b>${pace.percent === null ? '' : ` (${Math.abs(pace.percent).toFixed(1)}% of body weight)`} over the last ${pace.weeks} week${pace.weeks === 1 ? '' : 's'}.`
      : pace.perWeek > 0.05
        ? `Gaining <b>${pace.perWeek.toFixed(2)} lb/week</b> over the last ${pace.weeks} week${pace.weeks === 1 ? '' : 's'}.`
        : `Holding steady over the last ${pace.weeks} week${pace.weeks === 1 ? '' : 's'}.`
    : 'Log a couple of weeks of weigh-ins to see her pace.';

  let linkText;
  if (!link.ready) {
    linkText = `To see how food and weight are linked, keep logging both: ${link.weeksNeeded} more week${link.weeksNeeded === 1 ? '' : 's'} needed (3 weeks with food and weight change).`;
  } else {
    const r = link.r.toFixed(2);
    linkText = {
      strong: `<b>Strong link</b> (r = ${r}): weeks she eats more, she gains more. Food is the lever.`,
      some: `<b>Some link</b> (r = ${r}): food explains part of her weight change. Treats, exercise and water weight matter too.`,
      none: `<b>No clear link yet</b> (r = ${r}). A few more weeks of logs will sharpen this.`,
      opposite: `<b>Unexpected</b> (r = ${r}): weeks she ate more, she gained less. Usually something else is going on (treats, activity, weigh-in timing). Keep logging.`,
    }[link.verdict];
    if (link.verdict === 'strong' || link.verdict === 'some') {
      linkText += `<br>Each extra 10 g/day ≈ <b>${signedLb(link.slopePer10g).replace(' lb', '')} lb/week</b>.`;
      if (link.steadyFood !== null) {
        linkText += `<br>About <b>${Math.round(link.steadyFood)} g/day</b> keeps her weight steady, so aim a little below that to lose.`;
      }
    }
    linkText += `<br><span class="muted">Based on ${link.n} weeks. Estimates firm up with more data.</span>`;
  }

  return `
    <p>${paceText} <span class="muted">Vets usually aim for about 1–2% of body weight per week. Check her goal with your vet.</span></p>
    <p>${linkText}</p>`;
}

function renderGymStats() {
  const dog = gymDog();
  const header = `
    <header class="page-header nav">
      <a href="#/gym" class="px-btn tiny">◀ GYM</a>
      <h1 class="logo small-logo">STATS</h1>
      <span></span>
    </header>`;
  if (!dog) {
    $view.innerHTML = `${header}<div class="empty px-box"><h2>NO DOGS YET</h2><p class="muted">Add your dog in MY DOGS first.</p><a class="px-btn go" href="#/dogs">+ ADD A DOG</a></div>`;
    return;
  }
  const stats = gymStats(dog);
  const weeksDesc = [...stats.weeks].reverse().slice(0, 8);
  const recent = [...stats.entries].reverse().slice(0, 14);
  const lost = stats.start && stats.latest ? stats.start.weight - stats.latest.weight : null;

  $view.innerHTML = `
    ${header}
    <section class="px-box card gym-settings">
      <div class="gym-who">${avatar(dog, 48)}<b>${escapeHTML(dog.name)}</b></div>
      ${state.dogs.length > 1 ? `
        <label class="field"><span>Gym buddy</span>
          <select name="gym-dog">${state.dogs.map((d) => `<option value="${escapeHTML(d.id)}" ${d.id === dog.id ? 'selected' : ''}>${escapeHTML(d.name)}</option>`).join('')}</select>
        </label>` : ''}
      <label class="field"><span>Goal (lb)</span>
        <input id="goal-weight" inputmode="decimal" placeholder="e.g. 18" value="${stats.goal ?? ''}">
        <button class="px-btn tiny go" data-action="save-goal" data-id="${escapeHTML(dog.id)}">SET</button>
      </label>
    </section>

    <section class="px-box stats">
      <div><span class="label">LATEST</span><b>${stats.latest ? lb(stats.latest.weight) : '--'}</b></div>
      <div><span class="label">7-DAY AVG</span><b>${stats.avgWeight7 === null ? '--' : lb(stats.avgWeight7)}</b></div>
      <div><span class="label">START</span><b>${stats.start ? lb(stats.start.weight) : '--'}</b></div>
      <div><span class="label">${lost !== null && lost < 0 ? 'GAINED' : 'LOST'}</span><b>${lost === null ? '--' : lb(Math.abs(lost))}</b></div>
      <div><span class="label">FOOD 7-DAY AVG</span><b>${stats.avgFood7 === null ? '--' : `${Math.round(stats.avgFood7)} g`}</b></div>
      <div><span class="label">GOAL</span><b>${stats.goal === null ? '--' : `${lb(stats.goal)}${stats.progress === null ? '' : ` · ${Math.round(stats.progress * 100)}%`}`}</b></div>
    </section>

    <section class="px-box card">
      <h2 class="label">WEIGHT · LAST 8 WEEKS</h2>
      ${weightChart(stats)}
      <p class="legend"><i class="sw dot"></i>daily weigh-in <i class="sw line"></i>weekly average ${stats.goal === null ? '' : '<i class="sw goal"></i>goal'}</p>
    </section>

    <section class="px-box card">
      <h2 class="label">FOOD (G) · LAST 8 WEEKS</h2>
      ${foodChart(stats)}
      <p class="legend"><i class="sw bar"></i>daily food <i class="sw line"></i>weekly average</p>
    </section>

    <section class="px-box card insight">
      <h2 class="label">FOOD VS. WEIGHT</h2>
      ${insightHTML(stats)}
    </section>

    <section class="px-box card">
      <h2 class="label">WEEK BY WEEK</h2>
      ${weeksDesc.length ? `
        <table class="week-table">
          <thead><tr><th>WEEK OF</th><th>AVG FOOD</th><th>AVG WT</th><th>CHANGE</th></tr></thead>
          <tbody>
            ${weeksDesc.map((w) => `
              <tr>
                <td>${shortDate(w.week)}</td>
                <td>${w.avgFood === null ? '--' : `${Math.round(w.avgFood)} g`}</td>
                <td>${w.avgWeight === null ? '--' : w.avgWeight.toFixed(1)}</td>
                <td class="${w.change === null || Math.abs(w.change) < 0.05 ? '' : w.change < 0 ? 'down' : 'up'}">${w.change === null ? '--' : Math.abs(w.change) < 0.05 ? '±0.0' : `${w.change < 0 ? '▼' : '▲'}${Math.abs(w.change).toFixed(1)}`}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : '<p class="muted">Weeks show up here once you start logging.</p>'}
    </section>

    <section class="px-box card">
      <h2 class="label">DAILY LOG</h2>
      ${recent.length ? recent.map((e) => `
        <button class="entry-row" data-action="log-weight" data-date="${e.date}">
          <span>${shortDate(e.date)}</span>
          <span>${Number.isFinite(e.weight) ? lb(e.weight) : '--'}</span>
          <span>${Number.isFinite(e.food) ? `${e.food} g` : '--'}</span>
          <span class="muted">EDIT ▶</span>
        </button>`).join('') : '<p class="muted">Nothing logged yet.</p>'}
      <button class="px-btn go small" data-action="log-weight">+ LOG A DAY</button>
    </section>`;
}

function openWeightLog(dog, date = todayISO()) {
  const entry = state.weights.find((e) => e.id === `${dog.id}:${date}`);
  openSheet(`
    <form data-form="weight" data-dog="${escapeHTML(dog.id)}" autocomplete="off">
      ${sheetBar('WEIGH-IN')}
      <p class="sheet-dog">${avatar(dog, 40)}<span>${escapeHTML(dog.name)}</span></p>
      <div class="group px-box">
        <label class="field"><span>Date</span><input type="date" name="date" max="${todayISO()}" value="${date}" required></label>
        <label class="field"><span>Weight (lb)</span><input name="weight" inputmode="decimal" placeholder="22.4" value="${entry?.weight ?? ''}"></label>
        <label class="field"><span>Food (g)</span><input name="food" inputmode="numeric" placeholder="180" value="${entry?.food ?? ''}"></label>
      </div>
      <p class="tip">Weigh her at the same time each day (like before breakfast), and count all of the day's food, treats included. You can log just one of the two.</p>
      ${entry ? `<button type="button" class="px-btn danger" data-action="delete-weight" data-id="${escapeHTML(entry.id)}">DELETE THIS DAY</button>` : ''}
    </form>`);
}

/** When you pick another date in the log sheet, show what's already saved for it. */
function prefillWeightLog(form) {
  const entry = state.weights.find((e) => e.id === `${form.dataset.dog}:${form.elements.date.value}`);
  form.elements.weight.value = entry?.weight ?? '';
  form.elements.food.value = entry?.food ?? '';
}

async function submitWeight(form) {
  const data = new FormData(form);
  const dogId = form.dataset.dog;
  const date = String(data.get('date'));
  const parse = (value) => {
    const n = parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const weight = parse(data.get('weight'));
  const food = parse(data.get('food'));
  if (!date) return;
  if (weight === null && food === null) {
    alert('Enter her weight, her food, or both.');
    return;
  }
  if ((weight !== null && weight > 300) || (food !== null && food > 5000)) {
    alert('That number looks off. Weight is in pounds and food is in grams.');
    return;
  }
  const id = `${dogId}:${date}`;
  const entry = { id, dogId, date };
  if (weight !== null) entry.weight = Math.round(weight * 10) / 10;
  if (food !== null) entry.food = Math.round(food);
  await saveWeight(entry);
  state.weights = state.weights.filter((e) => e.id !== id).concat(entry);
  closeSheet();
  playBlip(true);
  render();
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

const actions = {
  'toggle-dog': (el) => {
    playBlip(!timer.selected.includes(el.dataset.id));
    timer.toggleSelected(el.dataset.id);
    renderPlay();
  },
  minutes: (el) => {
    playBlip(Number(el.dataset.delta) > 0);
    setMinutes(Math.min(120, Math.max(1, getMinutes() + Number(el.dataset.delta))));
    renderPlay();
  },
  preset: (el) => {
    playBlip();
    setMinutes(Number(el.dataset.minutes));
    renderPlay();
  },
  start: () => startSession(),
  // Plays your "wanna play?" call, the dogs come running, then the session starts.
  call: async () => {
    if (state.calling) return;
    unlockAudio();
    state.calling = true;
    renderPlay();
    await playCall();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // a beat for the zoomies to arrive
    state.calling = false;
    startSession();
  },
  pause: () => {
    playBlip();
    timer.pause();
    releaseWakeLock();
    renderPlay();
  },
  resume: () => {
    unlockAudio();
    playStart();
    requestWakeLock();
    timer.resume();
    renderPlay();
  },
  end: async () => {
    const played = timer.total - timer.remaining();
    const keep = played >= MIN_LOGGED_SECONDS;
    const message = keep
      ? `End now? ${formatDuration(played)} of play will be saved to your log.`
      : 'End now? Sessions under a minute aren’t saved.';
    if (!confirm(message)) return;
    if (keep) await logSession({ completed: false, duration: played });
    timer.reset();
    releaseWakeLock();
    renderPlay();
  },
  'toggle-sound': () => {
    unlockAudio();
    setMuted(!isMuted());
    playBlip(true);
    renderPlay();
  },
  'celebrate-done': () => {
    timer.reset();
    closeSheet();
    render();
  },
  'play-again': () => {
    unlockAudio();
    playStart();
    requestWakeLock();
    timer.playAgain();
    closeSheet();
    location.hash = '#/play';
    render();
  },
  'add-dog': () => openDogEditor(null),
  'edit-dog': (el) => openDogEditor(findDog(el.dataset.id)),
  'delete-dog': async (el) => {
    const dog = findDog(el.dataset.id);
    if (!dog || !confirm(`Delete ${dog.name} and their toys? Their play history stays in your log.`)) return;
    await deleteDog(dog.id);
    state.dogs = state.dogs.filter((d) => d.id !== dog.id);
    timer.forgetDog(dog.id);
    closeSheet();
    location.hash = '#/dogs';
    render();
  },
  'add-toy': (el) => openToyEditor(findDog(el.dataset.dog), null),
  'view-toy': (el) => {
    const toy = allToys().find((t) => t.id === el.dataset.id);
    if (!toy) return;
    playBlip(true);
    openToyViewer(toy);
  },
  'edit-toy': (el) => {
    const dog = findDog(el.dataset.dog);
    openToyEditor(dog, dog?.toys.find((t) => t.id === el.dataset.id));
  },
  'delete-toy': async (el) => {
    const dog = findDog(el.dataset.dog);
    if (!dog || !confirm('Delete this toy?')) return;
    dog.toys = dog.toys.filter((t) => t.id !== el.dataset.id);
    await saveDog(dog);
    closeSheet();
    render();
  },
  'delete-session': async (el) => {
    if (!confirm('Delete this play session from your log?')) return;
    await deleteSession(el.dataset.id);
    state.sessions = state.sessions.filter((s) => s.id !== el.dataset.id);
    render();
  },
  rate: (el) => {
    const value = Number(el.dataset.value);
    const form = el.closest('form');
    playBlip(value >= 4);
    form.elements.rating.value = String(value);
    form.querySelectorAll('.bone').forEach((b) => b.classList.toggle('on', Number(b.dataset.value) <= value));
    form.querySelector('#rating-caption').textContent = RATING_CAPTIONS[value];
  },
  'close-sheet': () => closeSheet(),
  'log-weight': (el) => {
    const dog = gymDog();
    if (dog) openWeightLog(dog, el.dataset.date || todayISO());
  },
  'delete-weight': async (el) => {
    if (!confirm('Delete this day from the log?')) return;
    await deleteWeight(el.dataset.id);
    state.weights = state.weights.filter((e) => e.id !== el.dataset.id);
    closeSheet();
    render();
  },
  'save-goal': async (el) => {
    const dog = findDog(el.dataset.id);
    if (!dog) return;
    const value = parseFloat(String(document.getElementById('goal-weight').value).replace(',', '.'));
    if (Number.isFinite(value) && value > 0) dog.goalWeight = Math.round(value * 10) / 10;
    else delete dog.goalWeight;
    await saveDog(dog);
    playBlip(true);
    render();
  },
  export: () => exportBackup(),
  'dismiss-install': () => {
    localStorage.setItem('pawse.installHintDismissed', '1');
    renderPlay();
  },
};

for (const root of [$view, $overlay]) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    actions[el.dataset.action]?.(el);
  });

  root.addEventListener('change', async (event) => {
    const input = event.target;
    if (input.name === 'photo' && input.files?.[0]) {
      try {
        pendingPhoto = await resizePhoto(input.files[0]);
        const preview = await pixelatePhoto(pendingPhoto);
        document.getElementById('photo-preview').innerHTML = avatar({ photoPixel: preview }, 112);
      } catch (error) {
        alert(error.message);
      }
    } else if (input.name === 'import' && input.files?.[0]) {
      await importBackup(input.files[0]);
      input.value = '';
    } else if (input.name === 'coat' || input.name === 'size') {
      refreshDogPreviews(input.form);
    } else if ((input.name === 'kind' || input.name === 'color') && input.form?.dataset.form === 'toy') {
      refreshToyPreview(input.form, input.name);
    } else if (input.name === 'date' && input.form?.dataset.form === 'weight') {
      prefillWeightLog(input.form);
    } else if (input.name === 'gym-dog') {
      localStorage.setItem('pawse.gymDog', input.value);
      render();
    }
  });
}

$overlay.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'dog') submitDog(form);
  if (form.dataset.form === 'toy') submitToy(form);
  if (form.dataset.form === 'weight') submitWeight(form);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $overlay.querySelector('.sheet')) closeSheet();
});

// ---------------------------------------------------------------------------
// Install hint (Safari only, until the app is on the home screen)
// ---------------------------------------------------------------------------

function installHint() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (standalone || !isIOS || localStorage.getItem('pawse.installHintDismissed')) return '';
  return `
    <div class="install-hint px-box">
      <span>INSTALL PAWSE: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.</span>
      <button class="px-btn tiny" data-action="dismiss-install" aria-label="Dismiss">X</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Start up
// ---------------------------------------------------------------------------

let tabBarDrawn = false;

function renderTabBar() {
  if (tabBarDrawn) return;
  tabBarDrawn = true;
  document.querySelector('.tabbar').innerHTML = `
    <a href="#/play" data-tab="play">${pixelImg(iconURL('paw'), 24)}<span>PLAY</span></a>
    <a href="#/gym" data-tab="gym">${pixelImg(iconURL('gym'), 24)}<span>GYM</span></a>
    <a href="#/dogs" data-tab="dogs">${pixelImg(dogTileURL('golden'), 24)}<span>MY DOGS</span></a>
    <a href="#/toys" data-tab="toys">${pixelImg(iconURL('ball'), 24)}<span>TOYS</span></a>
    <a href="#/log" data-tab="log">${pixelImg(iconURL('log'), 24)}<span>LOG</span></a>`;
}

async function init() {
  try {
    await loadAll();
  } catch {
    state.dogs = [];
    state.sessions = [];
    state.weights = [];
  }
  navigator.storage?.persist?.();

  renderTabBar();
  render();
  if (timer.tick()) onTimerFinished();
  else if (timer.phase === 'finished') showCelebration();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
