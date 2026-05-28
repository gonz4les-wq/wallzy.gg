// Per-player countdown. Each player owns a separate pool that only drains
// during that player's turn. Reaching zero triggers onTimeout(who).

export class Timer {
  constructor(startMs) {
    this.startMs = startMs;
    this.times = { human: startMs, bot: startMs };
    this.active = null;
    this.lastTick = null;
    this.raf = null;
    this.onTick = null; // (times) => void
    this.onTimeout = null; // (who) => void
  }

  reset() {
    this.stop();
    this.times = { human: this.startMs, bot: this.startMs };
  }

  start(who) {
    this.stop();
    this.active = who;
    this.lastTick = performance.now();
    this.loop();
  }

  // Drain elapsed time into the active player's pool.
  drain() {
    if (this.active == null || this.lastTick == null) return;
    const now = performance.now();
    this.times[this.active] -= now - this.lastTick;
    this.lastTick = now;
  }

  stop() {
    this.drain();
    this.active = null;
    this.lastTick = null;
    if (this.raf != null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  loop() {
    this.raf = requestAnimationFrame(() => {
      const who = this.active;
      if (who == null) return;
      this.drain();

      if (this.times[who] <= 0) {
        this.times[who] = 0;
        this.stop();
        if (this.onTick) this.onTick(this.times);
        if (this.onTimeout) this.onTimeout(who);
        return;
      }
      if (this.onTick) this.onTick(this.times);
      this.loop();
    });
  }
}
