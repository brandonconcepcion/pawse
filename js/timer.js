// The play-time countdown. Time is tracked as an end timestamp rather than a ticking counter,
// so it stays accurate if you switch apps, lock the phone, or close Pawse mid-session.

const STORAGE_KEY = 'pawse.timer';

class PlayTimer {
  phase = 'idle'; // idle | running | paused | finished
  total = 0; // seconds
  endAt = null; // ms timestamp
  pausedRemaining = 0; // seconds
  startedAt = null; // ms timestamp
  selected = []; // dog ids picked before starting
  playing = []; // dog ids in the current (or just-finished) session
  playingNames = [];

  constructor() {
    this.#load();
  }

  remaining(now = Date.now()) {
    if (this.phase === 'running') return Math.max(0, (this.endAt - now) / 1000);
    if (this.phase === 'paused') return this.pausedRemaining;
    return 0;
  }

  progress(now = Date.now()) {
    if (this.phase === 'idle') return 0;
    if (this.phase === 'finished') return 1;
    if (!this.total) return 0;
    return Math.min(1, Math.max(0, 1 - this.remaining(now) / this.total));
  }

  start(minutes, dogs) {
    this.playing = dogs.map((dog) => dog.id);
    this.playingNames = dogs.map((dog) => dog.name);
    this.total = minutes * 60;
    this.startedAt = Date.now();
    this.#run(this.total);
  }

  playAgain() {
    this.total = Math.max(this.total, 60);
    this.startedAt = Date.now();
    this.#run(this.total);
  }

  pause() {
    if (this.phase !== 'running') return;
    this.pausedRemaining = this.remaining();
    this.endAt = null;
    this.phase = 'paused';
    this.#save();
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.#run(this.pausedRemaining);
  }

  reset() {
    this.phase = 'idle';
    this.endAt = null;
    this.pausedRemaining = 0;
    this.startedAt = null;
    this.#save();
  }

  /** Returns true exactly once, at the moment the timer finishes. */
  tick(now = Date.now()) {
    if (this.phase !== 'running' || now < this.endAt) return false;
    this.phase = 'finished';
    this.endAt = null;
    this.#save();
    return true;
  }

  toggleSelected(id) {
    this.selected = this.selected.includes(id)
      ? this.selected.filter((x) => x !== id)
      : [...this.selected, id];
    this.#save();
  }

  forgetDog(id) {
    this.selected = this.selected.filter((x) => x !== id);
    this.#save();
  }

  #run(seconds) {
    this.endAt = Date.now() + seconds * 1000;
    this.phase = 'running';
    this.#save();
  }

  #save() {
    const { phase, total, endAt, pausedRemaining, startedAt, selected, playing, playingNames } = this;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ phase, total, endAt, pausedRemaining, startedAt, selected, playing, playingNames })
    );
  }

  #load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) Object.assign(this, saved);
    } catch {
      // Corrupt or missing state: start fresh.
    }
  }
}

export const timer = new PlayTimer();
