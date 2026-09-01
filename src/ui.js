import { GameState } from './game.js';

function formatMultiplier(v) {
  return v.toFixed(2) + 'x';
}

function formatMoney(v) {
  return v.toFixed(2) + ' ₴';
}

function getMultiplierColor(m) {
  if (m < 1.5) return 'var(--mult-low)';
  if (m < 3) return 'var(--mult-mid)';
  if (m < 10) return 'var(--mult-high)';
  return 'var(--mult-mega)';
}

export function createUI(root, game, bets) {
  root.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="logo">
          <svg class="logo-icon" viewBox="0 0 32 32" fill="none">
            <path d="M4 20 L16 8 L28 20 L22 20 L22 26 L10 26 L10 20 Z" fill="url(#logoGrad)" />
            <defs>
              <linearGradient id="logoGrad" x1="4" y1="8" x2="28" y2="26">
                <stop stop-color="#ff6b35"/>
                <stop offset="1" stop-color="#f72585"/>
              </linearGradient>
            </defs>
          </svg>
          <span class="logo-text">PILOT</span>
        </div>
        <div class="balance-card">
          <span class="balance-label">Баланс</span>
          <span class="balance-value" id="balance">1 000.00 ₴</span>
        </div>
      </header>

      <main class="main">
        <section class="game-panel">
          <div class="history-bar" id="history"></div>

          <div class="canvas-wrap">
            <canvas id="game-canvas"></canvas>
            <div class="canvas-overlay">
              <div class="multiplier-display" id="multiplier">1.00x</div>
              <div class="status-text" id="status">Наступний політ через...</div>
              <div class="countdown" id="countdown"></div>
            </div>
            <div class="crash-flash" id="crash-flash"></div>
          </div>

          <div class="players-feed">
            <div class="feed-header">
              <span>Гравці онлайн</span>
              <span class="online-dot"></span>
              <span id="online-count">247</span>
            </div>
            <div class="feed-list" id="feed-list"></div>
          </div>
        </section>

        <aside class="bet-panel">
          <div class="bet-tabs">
            <button class="bet-tab active" data-tab="bet">Ставка</button>
            <button class="bet-tab" data-tab="auto">Авто</button>
          </div>

          <div class="bet-content" id="tab-bet">
            <label class="field-label">Сума ставки</label>
            <div class="bet-input-wrap">
              <input type="number" id="bet-amount" value="50" min="10" step="10" />
              <span class="currency">₴</span>
            </div>
            <div class="quick-bets">
              <button class="quick-bet" data-amount="10">10</button>
              <button class="quick-bet" data-amount="50">50</button>
              <button class="quick-bet" data-amount="100">100</button>
              <button class="quick-bet" data-amount="500">500</button>
            </div>

            <label class="field-label">Авто-кешаут</label>
            <div class="bet-input-wrap">
              <input type="number" id="auto-cashout" placeholder="2.00" min="1.01" step="0.1" />
              <span class="currency">x</span>
            </div>
          </div>

          <div class="bet-content hidden" id="tab-auto">
            <label class="field-label">Кількість раундів</label>
            <div class="bet-input-wrap">
              <input type="number" id="auto-rounds" value="10" min="1" max="100" />
            </div>
            <label class="field-label">Авто-кешаут</label>
            <div class="bet-input-wrap">
              <input type="number" id="auto-cashout-tab" value="2.00" min="1.01" step="0.1" />
              <span class="currency">x</span>
            </div>
            <p class="auto-hint">Автоматичні ставки будуть робитись кожен раунд з обраним кешаутом.</p>
          </div>

          <button class="action-btn bet-btn" id="action-btn">
            <span class="btn-label">ЗРОБИТИ СТАВКУ</span>
            <span class="btn-sub" id="btn-sub">50.00 ₴</span>
          </button>

          <div class="bet-info" id="bet-info"></div>
        </aside>
      </main>

      <footer class="footer">
        <span>Демо-режим · Віртуальні кошти</span>
        <span>PILOT v1.0</span>
      </footer>
    </div>
  `;

  const els = {
    balance: root.querySelector('#balance'),
    history: root.querySelector('#history'),
    canvas: root.querySelector('#game-canvas'),
    multiplier: root.querySelector('#multiplier'),
    status: root.querySelector('#status'),
    countdown: root.querySelector('#countdown'),
    crashFlash: root.querySelector('#crash-flash'),
    feedList: root.querySelector('#feed-list'),
    betAmount: root.querySelector('#bet-amount'),
    autoCashout: root.querySelector('#auto-cashout'),
    actionBtn: root.querySelector('#action-btn'),
    btnSub: root.querySelector('#btn-sub'),
    betInfo: root.querySelector('#bet-info'),
    onlineCount: root.querySelector('#online-count'),
  };

  const canvas = new GameCanvas(els.canvas);
  const feed = new PlayersFeed(els.feedList, els.onlineCount);

  let countdownInterval = null;
  let autoBetEnabled = false;
  let autoRoundsLeft = 0;

  function updateBalance() {
    const { balance } = bets.getState();
    els.balance.textContent = formatMoney(balance).replace('.', ',').replace('₴', ' ₴');
  }

  function updateBetUI() {
    const amount = parseFloat(els.betAmount.value) || 0;
    const { activeBet } = bets.getState();
    const btn = els.actionBtn;

    if (game.state === GameState.FLYING && activeBet && !activeBet.cashedOut) {
      const potential = Math.floor(amount * game.multiplier * 100) / 100;
      btn.className = 'action-btn cashout-btn';
      btn.querySelector('.btn-label').textContent = 'ЗАБРАТИ ВИГРАШ';
      els.btnSub.textContent = formatMoney(potential);
      btn.disabled = false;
    } else if (game.state === GameState.WAITING && !activeBet) {
      btn.className = 'action-btn bet-btn';
      btn.querySelector('.btn-label').textContent = 'ЗРОБИТИ СТАВКУ';
      els.btnSub.textContent = formatMoney(amount);
      btn.disabled = !bets.canBet(amount);
    } else if (activeBet?.cashedOut) {
      btn.className = 'action-btn cashed-btn';
      btn.querySelector('.btn-label').textContent = 'ВИГРАШ ЗАБРАНО';
      els.btnSub.textContent = formatMoney(activeBet.payout);
      btn.disabled = true;
    } else if (activeBet && game.state === GameState.WAITING) {
      btn.className = 'action-btn waiting-btn';
      btn.querySelector('.btn-label').textContent = 'СТАВКА ПРИЙНЯТА';
      els.btnSub.textContent = formatMoney(activeBet.amount);
      btn.disabled = true;
    } else if (activeBet && game.state === GameState.CRASHED) {
      btn.className = 'action-btn lost-btn';
      btn.querySelector('.btn-label').textContent = 'ПРОГРАШ';
      els.btnSub.textContent = formatMoney(activeBet.amount);
      btn.disabled = true;
    } else {
      btn.className = 'action-btn bet-btn';
      btn.querySelector('.btn-label').textContent = 'ЗРОБИТИ СТАВКУ';
      els.btnSub.textContent = formatMoney(amount);
      btn.disabled = true;
    }

    if (activeBet && !activeBet.cashedOut && game.state === GameState.FLYING) {
      els.betInfo.innerHTML = `
        <div class="info-row"><span>Ставка</span><span>${formatMoney(activeBet.amount)}</span></div>
        <div class="info-row win"><span>Потенційний виграш</span><span>${formatMoney(activeBet.amount * game.multiplier)}</span></div>
      `;
    } else if (activeBet?.cashedOut) {
      els.betInfo.innerHTML = `
        <div class="info-row win"><span>Виграш</span><span>+${formatMoney(activeBet.payout)}</span></div>
        <div class="info-row"><span>Кешаут</span><span>${formatMultiplier(activeBet.cashoutAt)}</span></div>
      `;
    } else {
      els.betInfo.innerHTML = '';
    }
  }

  function renderHistory() {
    els.history.innerHTML = game.history
      .map((h) => {
        const cls = h.crashPoint >= 10 ? 'mega' : h.crashPoint >= 3 ? 'high' : h.crashPoint >= 2 ? 'mid' : 'low';
        return `<span class="history-chip ${cls}">${formatMultiplier(h.crashPoint)}</span>`;
      })
      .join('');
  }

  function startCountdown(endsAt) {
    clearInterval(countdownInterval);
    els.countdown.style.display = 'block';
    countdownInterval = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      els.countdown.textContent = (left / 1000).toFixed(1) + 's';
      if (left <= 0) {
        clearInterval(countdownInterval);
        els.countdown.style.display = 'none';
      }
    }, 50);
  }

  function onGameEvent(event, data) {
    switch (event) {
      case 'waiting':
        els.status.textContent = 'Наступний політ через...';
        els.multiplier.textContent = '1.00x';
        els.multiplier.style.color = 'var(--text-muted)';
        canvas.setState('waiting');
        startCountdown(data.endsAt);
        bets.clearCashedBet();
        if (autoBetEnabled && autoRoundsLeft > 0) tryPlaceBet();
        updateBetUI();
        break;

      case 'fly':
        els.status.textContent = '';
        els.countdown.style.display = 'none';
        els.multiplier.style.color = getMultiplierColor(1);
        canvas.setState('flying');
        feed.onRoundStart();
        updateBetUI();
        break;

      case 'tick':
        els.multiplier.textContent = formatMultiplier(data.multiplier);
        els.multiplier.style.color = getMultiplierColor(data.multiplier);
        canvas.update(data.multiplier, data.progress);
        bets.tryAutoCashout(data.multiplier);
        updateBetUI();
        break;

      case 'crash':
        els.status.textContent = 'Розбився!';
        els.multiplier.textContent = formatMultiplier(data.crashPoint);
        els.multiplier.style.color = '#ef4444';
        els.multiplier.classList.add('crash-shake');
        els.crashFlash.classList.add('active');
        canvas.setState('crashed', data.crashPoint);
        bets.loseBet();
        feed.onCrash(data.crashPoint);
        setTimeout(() => {
          els.multiplier.classList.remove('crash-shake');
          els.crashFlash.classList.remove('active');
        }, 600);
        renderHistory();
        updateBetUI();
        break;
    }
  }

  function tryPlaceBet() {
    const amount = parseFloat(els.betAmount.value);
    const autoVal = parseFloat(els.autoCashout.value) || parseFloat(root.querySelector('#auto-cashout-tab').value);
    if (bets.placeBet(amount, autoVal)) {
      if (autoBetEnabled) autoRoundsLeft--;
      updateBalance();
      updateBetUI();
    }
  }

  els.actionBtn.addEventListener('click', () => {
    const { activeBet } = bets.getState();
    if (game.state === GameState.FLYING && activeBet && !activeBet.cashedOut) {
      if (bets.cashOut(game.multiplier)) {
        canvas.setState('cashed');
        feed.onCashout('Ви', game.multiplier, activeBet.amount * game.multiplier);
        updateBalance();
        updateBetUI();
      }
    } else if (game.state === GameState.WAITING) {
      tryPlaceBet();
    }
  });

  root.querySelectorAll('.quick-bet').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.betAmount.value = btn.dataset.amount;
      updateBetUI();
    });
  });

  els.betAmount.addEventListener('input', updateBetUI);

  root.querySelectorAll('.bet-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('.bet-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      root.querySelectorAll('.bet-content').forEach((c) => c.classList.add('hidden'));
      root.querySelector(`#tab-${tab.dataset.tab}`).classList.remove('hidden');
      if (tab.dataset.tab === 'auto') {
        autoBetEnabled = true;
        autoRoundsLeft = parseInt(root.querySelector('#auto-rounds').value) || 10;
      } else {
        autoBetEnabled = false;
      }
    });
  });

  const unsubGame = game.subscribe(onGameEvent);
  const unsubBets = bets.subscribe(() => {
    updateBalance();
    updateBetUI();
  });

  updateBalance();
  updateBetUI();
  feed.start();
  canvas.start();

  return {
    destroy() {
      unsubGame();
      unsubBets();
      clearInterval(countdownInterval);
      canvas.stop();
      feed.stop();
    },
  };
}

class GameCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'waiting';
    this.multiplier = 1;
    this.progress = 0;
    this.crashPoint = 1;
    this.trail = [];
    this.stars = [];
    this._raf = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._initStars();
  }

  _resize() {
    const wrap = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = wrap.clientWidth * dpr;
    this.canvas.height = wrap.clientHeight * dpr;
    this.canvas.style.width = wrap.clientWidth + 'px';
    this.canvas.style.height = wrap.clientHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = wrap.clientWidth;
    this.h = wrap.clientHeight;
  }

  _initStars() {
    this.stars = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }

  setState(state, crashPoint) {
    this.state = state;
    if (crashPoint) this.crashPoint = crashPoint;
    if (state === 'waiting') {
      this.trail = [];
      this.multiplier = 1;
      this.progress = 0;
    }
  }

  update(multiplier, progress) {
    this.multiplier = multiplier;
    this.progress = progress;
    const t = Math.min(progress, 0.95);
    this.trail.push({ x: t, y: this._curveY(t), m: multiplier });
    if (this.trail.length > 200) this.trail.shift();
  }

  _curveY(t) {
    return 0.85 - Math.pow(t, 0.7) * 0.65;
  }

  start() {
    const draw = () => {
      this._draw();
      this._raf = requestAnimationFrame(draw);
    };
    draw();
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }

  _draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0e1a');
    grad.addColorStop(0.5, '#111827');
    grad.addColorStop(1, '#1a1033');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (const star of this.stars) {
      star.y += star.speed * 0.001;
      if (star.y > 1) star.y = 0;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${star.opacity})`;
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const gy = (h / 8) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(0, this._curveY(0) * h);
      for (const p of this.trail) {
        ctx.lineTo(p.x * w, p.y * h);
      }
      const last = this.trail[this.trail.length - 1];
      const color = this.state === 'crashed' ? '#ef4444' : '#ff6b35';
      const lineGrad = ctx.createLinearGradient(0, 0, last.x * w, 0);
      lineGrad.addColorStop(0, 'rgba(255,107,53,0.1)');
      lineGrad.addColorStop(1, color);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.lineTo(last.x * w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, last.y * h, 0, h);
      fillGrad.addColorStop(0, 'rgba(255,107,53,0.15)');
      fillGrad.addColorStop(1, 'rgba(255,107,53,0)');
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    if (this.state === 'flying' || this.state === 'crashed' || this.state === 'cashed') {
      const t = Math.min(this.progress, 0.95);
      const px = t * w;
      const py = this._curveY(t) * h;
      this._drawPlane(px, py, this.state === 'crashed');
    } else if (this.state === 'waiting') {
      const bob = Math.sin(Date.now() / 500) * 5;
      this._drawPlane(w * 0.08, h * 0.5 + bob, false, 0.6);
    }
  }

  _drawPlane(x, y, crashed, alpha = 1) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    const angle = crashed ? 0.8 : -0.15 - this.progress * 0.3;
    ctx.rotate(angle);

    if (crashed) {
      ctx.globalAlpha = alpha * 0.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const dist = 20 + Math.sin(Date.now() / 100 + i) * 10;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${0.3 + Math.random() * 0.4})`;
        ctx.fill();
      }
    }

    ctx.shadowColor = crashed ? '#ef4444' : '#ff6b35';
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(-15, -8);
    ctx.lineTo(-20, -18);
    ctx.lineTo(-25, -8);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-20, 8);
    ctx.lineTo(-15, 8);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-20, -18, 30, 8);
    bodyGrad.addColorStop(0, crashed ? '#ef4444' : '#ff8c42');
    bodyGrad.addColorStop(1, crashed ? '#991b1b' : '#ff6b35');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, -8);
    ctx.lineTo(-5, -22);
    ctx.lineTo(-12, -8);
    ctx.closePath();
    ctx.fillStyle = crashed ? '#dc2626' : '#f72585';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(20, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(21, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    if (!crashed) {
      const flicker = 0.7 + Math.sin(Date.now() / 80) * 0.3;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(-35 - Math.random() * 10, 0);
      ctx.strokeStyle = `rgba(255,200,50,${flicker})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-32, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,150,30,${flicker * 0.5})`;
      ctx.fill();
    }

    ctx.restore();
  }
}

const FAKE_NAMES = [
  'Alex_K', 'Maria99', 'ProGamer', 'LuckyStar', 'NightOwl',
  'CryptoKing', 'Vortex', 'Shadow', 'Blaze', 'NovaX',
  'Phantom', 'Storm', 'Eclipse', 'Raven', 'Frost',
];

class PlayersFeed {
  constructor(listEl, countEl) {
    this.listEl = listEl;
    this.countEl = countEl;
    this.entries = [];
    this._interval = null;
  }

  start() {
    this._interval = setInterval(() => {
      const delta = Math.floor(Math.random() * 5) - 2;
      const base = 240 + delta;
      this.countEl.textContent = base + Math.floor(Math.random() * 20);
    }, 3000);
  }

  stop() {
    clearInterval(this._interval);
  }

  onRoundStart() {
    this.entries = FAKE_NAMES.slice(0, 8).map((name) => ({
      name,
      bet: [10, 20, 50, 100, 200][Math.floor(Math.random() * 5)],
      cashedOut: false,
      cashoutAt: null,
    }));
    this._render();
  }

  onCashout(name, multiplier, amount) {
    const entry = this.entries.find((e) => e.name === name);
    if (entry) {
      entry.cashedOut = true;
      entry.cashoutAt = multiplier;
      entry.win = amount;
    } else {
      const fake = this.entries[Math.floor(Math.random() * this.entries.length)];
      if (fake && !fake.cashedOut && Math.random() > 0.5) {
        fake.cashedOut = true;
        fake.cashoutAt = multiplier * (0.8 + Math.random() * 0.4);
        fake.win = fake.bet * fake.cashoutAt;
      }
    }
    this._render();
  }

  onCrash(crashPoint) {
    for (const e of this.entries) {
      if (!e.cashedOut && Math.random() > 0.4) {
        e.cashedOut = true;
        e.cashoutAt = 1.01 + Math.random() * (crashPoint - 1.01);
        e.win = e.bet * e.cashoutAt;
      }
    }
    this._render();
  }

  _render() {
    this.listEl.innerHTML = this.entries
      .map((e) => {
        if (e.cashedOut) {
          return `<div class="feed-item win">
            <span class="feed-name">${e.name}</span>
            <span class="feed-action">${e.cashoutAt.toFixed(2)}x</span>
            <span class="feed-amount">+${e.win.toFixed(0)} ₴</span>
          </div>`;
        }
        return `<div class="feed-item">
          <span class="feed-name">${e.name}</span>
          <span class="feed-action">ставка</span>
          <span class="feed-amount">${e.bet} ₴</span>
        </div>`;
      })
      .join('');
  }
}
