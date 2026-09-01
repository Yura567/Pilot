/**
 * Crash game engine — multiplier curve, crash point generation, round lifecycle.
 */

const HOUSE_EDGE = 0.03;
const TICK_MS = 16;
const GROWTH_RATE = 0.00006;

export const GameState = {
  WAITING: 'waiting',
  FLYING: 'flying',
  CRASHED: 'crashed',
  CASHED_OUT: 'cashed_out',
};

export function generateCrashPoint() {
  const r = Math.random();
  if (r < HOUSE_EDGE) return 1.0;
  const crash = (1 - HOUSE_EDGE) / (1 - r);
  return Math.max(1.0, Math.min(crash, 1000));
}

export function multiplierAt(elapsedMs) {
  return Math.exp(GROWTH_RATE * elapsedMs);
}

export function elapsedForMultiplier(target) {
  if (target <= 1) return 0;
  return Math.log(target) / GROWTH_RATE;
}

export class CrashGame {
  constructor() {
    this.reset();
    this.listeners = new Set();
  }

  reset() {
    this.state = GameState.WAITING;
    this.crashPoint = null;
    this.multiplier = 1.0;
    this.elapsed = 0;
    this.startTime = null;
    this.waitEndTime = null;
    this.history = [];
    this._raf = null;
    this._waitTimer = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners) fn(event, data);
  }

  startWaiting(durationMs = 5000) {
    this.state = GameState.WAITING;
    this.multiplier = 1.0;
    this.elapsed = 0;
    this.waitEndTime = Date.now() + durationMs;
    this.emit('waiting', { endsAt: this.waitEndTime, durationMs });
    clearTimeout(this._waitTimer);
    this._waitTimer = setTimeout(() => this.startRound(), durationMs);
  }

  startRound() {
    this.crashPoint = generateCrashPoint();
    this.state = GameState.FLYING;
    this.multiplier = 1.0;
    this.elapsed = 0;
    this.startTime = performance.now();
    this.emit('fly', { crashPoint: this.crashPoint });
    this._tick();
  }

  _tick() {
    if (this.state !== GameState.FLYING) return;

    const now = performance.now();
    this.elapsed = now - this.startTime;
    this.multiplier = multiplierAt(this.elapsed);

    if (this.multiplier >= this.crashPoint) {
      this.multiplier = this.crashPoint;
      this.crash();
      return;
    }

    this.emit('tick', {
      multiplier: this.multiplier,
      elapsed: this.elapsed,
      progress: Math.min(this.multiplier / this.crashPoint, 1),
    });

    this._raf = requestAnimationFrame(() => this._tick());
  }

  crash() {
    cancelAnimationFrame(this._raf);
    this.state = GameState.CRASHED;
    this.history.unshift({
      crashPoint: this.crashPoint,
      time: Date.now(),
    });
    if (this.history.length > 20) this.history.pop();
    this.emit('crash', { crashPoint: this.crashPoint });
    setTimeout(() => this.startWaiting(), 3000);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._waitTimer);
    this.listeners.clear();
  }
}

export class BetManager {
  constructor(initialBalance = 1000) {
    this.balance = initialBalance;
    this.activeBet = null;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.getState());
  }

  getState() {
    return {
      balance: this.balance,
      activeBet: this.activeBet ? { ...this.activeBet } : null,
    };
  }

  canBet(amount) {
    return (
      !this.activeBet &&
      amount >= 10 &&
      amount <= this.balance &&
      Number.isFinite(amount)
    );
  }

  placeBet(amount, autoCashout = null) {
    if (!this.canBet(amount)) return false;
    this.balance -= amount;
    this.activeBet = {
      amount,
      autoCashout: autoCashout && autoCashout >= 1.01 ? autoCashout : null,
      cashedOut: false,
      payout: 0,
    };
    this.emit();
    return true;
  }

  tryAutoCashout(multiplier) {
    if (
      this.activeBet &&
      !this.activeBet.cashedOut &&
      this.activeBet.autoCashout &&
      multiplier >= this.activeBet.autoCashout
    ) {
      return this.cashOut(multiplier);
    }
    return false;
  }

  cashOut(multiplier) {
    if (!this.activeBet || this.activeBet.cashedOut) return false;
    const payout = Math.floor(this.activeBet.amount * multiplier * 100) / 100;
    this.activeBet.cashedOut = true;
    this.activeBet.payout = payout;
    this.activeBet.cashoutAt = multiplier;
    this.balance += payout;
    this.emit();
    return true;
  }

  loseBet() {
    if (!this.activeBet || this.activeBet.cashedOut) return;
    this.activeBet = null;
    this.emit();
  }

  clearCashedBet() {
    if (this.activeBet?.cashedOut) {
      this.activeBet = null;
      this.emit();
    }
  }
}
