/**
 * PixiJS game scene — rotating sunburst, scrolling axes, red curve and the propeller plane.
 */
import { Application, Container, Graphics, Text } from 'pixi.js';

const RED = 0xe50539;
const RED_DARK = 0xa1001f;
const RED_MID = 0xc8002c;
const BLUE = 0x34b4ff;
const CLIMB_MS = 6500;
const FLY_AWAY_MS = 900;
const PAD_L = 34;
const PAD_B = 34;

function buildPlane() {
  const plane = new Container();
  const g = new Graphics();

  // landing gear (behind the wing)
  g.moveTo(6, 6).lineTo(3, 18).stroke({ width: 2.5, color: 0x262626, cap: 'round' });
  g.circle(3, 20, 5).fill(0x151515);
  g.circle(3, 20, 1.8).fill(0x6b6b6b);

  // tail fin
  g.moveTo(-34, -10)
    .lineTo(-50, -29)
    .quadraticCurveTo(-55, -33, -59, -29)
    .lineTo(-60, -4)
    .closePath()
    .fill(RED);

  // fuselage
  g.moveTo(50, -5)
    .bezierCurveTo(50, -13, 42, -16, 30, -16)
    .lineTo(-30, -10)
    .bezierCurveTo(-44, -9, -56, -7, -60, -4)
    .lineTo(-60, 0)
    .bezierCurveTo(-50, 3, -30, 6, 0, 7)
    .lineTo(30, 7)
    .bezierCurveTo(42, 7, 50, 3, 50, -5)
    .fill(RED);

  // lower half in a darker tone
  g.moveTo(-60, -1)
    .bezierCurveTo(-50, 3, -30, 6, 0, 7)
    .lineTo(30, 7)
    .bezierCurveTo(42, 7, 50, 3, 50, -2)
    .closePath()
    .fill(RED_MID);

  // canopy: tinted glass with one soft reflection
  g.moveTo(24, -16)
    .bezierCurveTo(20, -27, 4, -28, -6, -14)
    .closePath()
    .fill(0x1c2530);
  g.moveTo(17, -22)
    .quadraticCurveTo(11, -25, 5, -21)
    .stroke({ width: 1.5, color: 0xffffff, alpha: 0.35, cap: 'round' });

  // wing + stabilizer
  g.moveTo(18, -1)
    .lineTo(-12, -1)
    .lineTo(-26, 14)
    .quadraticCurveTo(-26, 17, -22, 17)
    .lineTo(-4, 17)
    .closePath()
    .fill(RED_DARK);
  g.moveTo(-42, -2)
    .lineTo(-58, -2)
    .lineTo(-66, 5)
    .quadraticCurveTo(-66, 7, -63, 7)
    .lineTo(-54, 7)
    .closePath()
    .fill(RED_DARK);

  // spinner
  g.moveTo(50, -12).quadraticCurveTo(60, -5, 50, 2).closePath().fill(0xe4e4e4);

  const prop = new Container();
  prop.position.set(55, -5);
  const disc = new Graphics().ellipse(0, 0, 3, 28).fill({ color: 0xffffff, alpha: 0.08 });
  const blades = new Graphics().roundRect(-2, -28, 4, 56, 2).fill(0x202020);
  prop.addChild(disc, blades);

  plane.addChild(g, prop);
  plane.pivot.set(-60, 2); // the curve attaches to the plane's tail
  plane.blades = blades;
  return plane;
}

function buildLoader() {
  const loader = new Container();
  const prop = new Graphics();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pts = [
      [-7, 0], [-9, -18], [-5, -44], [0, -50], [5, -44], [9, -18], [7, 0],
    ].flatMap(([x, y]) => [x * c - y * s, x * s + y * c]);
    prop.poly(pts).fill(RED);
  }
  prop.circle(0, 0, 11).fill(0xffffff).circle(0, 0, 5).fill(RED);
  const barBg = new Graphics();
  const bar = new Graphics();
  const label = new Text({
    text: 'ОЧІКУВАННЯ НАСТУПНОГО РАУНДУ',
    style: { fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: '800', fill: 0xffffff, letterSpacing: 1.5 },
  });
  label.anchor.set(0.5, 0);
  label.position.set(0, 66);
  label.alpha = 0.9;
  loader.addChild(prop, label, barBg, bar);
  loader.prop = prop;
  loader.bar = bar;
  loader.barBg = barBg;
  return loader;
}

export class GameScene {
  constructor(host) {
    this.host = host;
    this.state = 'waiting';
    this.elapsed = 0;
    this.wait = { endsAt: Date.now(), durationMs: 1 };
    this.size = { w: 0, h: 0 };
    this.app = null;
    this._init();
  }

  async _init() {
    const app = new Application();
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this._destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    app.canvas.classList.add('game-canvas');
    this.host.prepend(app.canvas);

    this.rays = new Graphics();
    this.axes = new Graphics();
    this.curve = new Graphics();
    this.plane = buildPlane();
    this.loader = buildLoader();
    app.stage.addChild(this.rays, this.axes, this.curve, this.plane, this.loader);
    app.ticker.add(() => this._frame());
  }

  setState(state, data = {}) {
    if (state === 'cashed') return; // the round keeps going for everyone else
    this.state = state;
    if (state === 'waiting') {
      this.wait = { endsAt: data.endsAt, durationMs: data.durationMs };
      this.elapsed = 0;
    } else if (state === 'flying') {
      this.elapsed = 0;
    } else if (state === 'crashed') {
      this.crashAt = performance.now();
      this.crashFrom = this.plane ? { x: this.plane.x, y: this.plane.y } : null;
    }
  }

  update(elapsed) {
    this.elapsed = elapsed;
  }

  _rebuildRays(w, h) {
    const r = Math.hypot(w, h) * 1.2;
    const n = 28;
    this.rays.clear();
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.rays
        .poly([0, 0, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r])
        .fill({ color: 0xffffff, alpha: 0.028 });
    }
    this.rays.position.set(PAD_L, h - PAD_B);
  }

  _flightPoint(w, h, now) {
    const ox = PAD_L;
    const oy = h - PAD_B;
    const tx = w * 0.72;
    const ty = h * 0.34;
    const p = Math.min(this.elapsed / CLIMB_MS, 1);
    const ex = 1 - Math.pow(1 - p, 2);
    let x = ox + (tx - ox) * ex;
    let y = oy - (oy - ty) * Math.pow(p, 1.6);
    const cruise = Math.max(0, Math.min((this.elapsed - CLIMB_MS) / 1500, 1));
    x += Math.sin(now / 1300) * w * 0.02 * cruise;
    y += Math.sin(now / 800) * h * 0.05 * cruise;
    return { x, y, p, cruise };
  }

  _drawAxes(w, h, now) {
    const ox = PAD_L;
    const oy = h - PAD_B;
    const moving = this.state === 'flying';
    const shift = moving ? this.elapsed * 0.03 : 0;
    const gap = 48;
    const a = this.axes.clear();
    a.moveTo(ox, 0).lineTo(ox, oy).lineTo(w, oy).stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
    for (let y = oy - gap + (shift % gap); y > 8; y -= gap) {
      a.circle(PAD_L / 2, y, 2.6).fill({ color: BLUE, alpha: 0.9 });
    }
    for (let x = ox + gap - (shift % gap); x < w - 8; x += gap) {
      a.circle(x, oy + PAD_B / 2, 2.6).fill({ color: 0xffffff, alpha: 0.55 });
    }
  }

  _frame() {
    const { app } = this;
    const w = app.screen.width;
    const h = app.screen.height;
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      this._rebuildRays(w, h);
    }
    const now = performance.now();
    const dt = app.ticker.deltaMS;
    const scale = Math.max(0.5, Math.min(w / 900, 1.05));

    this.rays.rotation += dt * (this.state === 'flying' ? 0.00012 : 0.00004);
    this._drawAxes(w, h, now);
    this.plane.blades.scale.y = Math.sin(now * 0.09);
    this.plane.scale.set(scale);

    const curve = this.curve.clear();
    const ox = PAD_L;
    const oy = h - PAD_B;

    if (this.state === 'flying') {
      const pt = this._flightPoint(w, h, now);
      const cx = ox + (pt.x - ox) * 0.6;
      curve
        .moveTo(ox, oy)
        .quadraticCurveTo(cx, oy, pt.x, pt.y)
        .lineTo(pt.x, oy)
        .closePath()
        .fill({ color: RED, alpha: 0.32 });
      curve
        .beginPath()
        .moveTo(ox, oy)
        .quadraticCurveTo(cx, oy, pt.x, pt.y)
        .stroke({ width: 4, color: RED, cap: 'round' });
      this.plane.visible = true;
      this.plane.alpha = 1;
      this.plane.position.set(pt.x, pt.y);
      this.plane.rotation = -0.22 * (1 - pt.cruise) * Math.min(pt.p * 4, 1) - 0.04 + Math.cos(now / 800) * 0.04 * pt.cruise;
      this.loader.visible = false;
    } else if (this.state === 'crashed') {
      const t = Math.min((now - this.crashAt) / FLY_AWAY_MS, 1);
      const from = this.crashFrom || { x: w * 0.72, y: h * 0.34 };
      this.plane.position.set(from.x + t * t * w * 0.9, from.y - t * t * h * 0.5);
      this.plane.rotation = -0.3 * t;
      this.plane.visible = t < 1;
      this.loader.visible = false;
    } else {
      // waiting: plane parked at the origin, loader in the middle
      this.plane.visible = true;
      this.plane.alpha = 1;
      this.plane.rotation = 0;
      this.plane.position.set(ox + 4, oy - 23 * scale); // wheel rests on the x-axis

      const left = Math.max(0, this.wait.endsAt - Date.now());
      const frac = Math.min(left / this.wait.durationMs, 1);
      const L = this.loader;
      L.visible = true;
      L.position.set(w / 2, h * 0.36);
      L.scale.set(Math.max(0.7, scale));
      L.prop.rotation += dt * 0.012;
      const bw = 220;
      L.barBg.clear().roundRect(-bw / 2, 96, bw, 7, 3.5).fill({ color: 0xffffff, alpha: 0.12 });
      L.bar.clear();
      if (frac > 0) L.bar.roundRect(-bw / 2, 96, bw * frac, 7, 3.5).fill(RED);
    }
  }

  destroy() {
    this._destroyed = true;
    if (this.app) this.app.destroy(true, { children: true });
  }
}
