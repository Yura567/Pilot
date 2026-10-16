import { GameState } from './game.js';
import { GameScene } from './scene.js';

function formatMultiplier(v) {
  return v.toFixed(2) + 'x';
}

function formatMoney(v) {
  return v.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₴';
}

function multiplierClass(m) {
  if (m >= 10) return 'mega';
  if (m >= 2) return 'high';
  return 'low';
}

const LOGO_SVG = `
  <svg class="logo-icon" viewBox="-68 -34 130 54" aria-hidden="true">
    <path d="M-34-10-50-29Q-55-33-59-29L-60-4Z" fill="#e50539"/>
    <path d="M50-5C50-13 42-16 30-16L-30-10C-44-9-56-7-60-4V0C-50 3-30 6 0 7H30C42 7 50 3 50-5Z" fill="#e50539"/>
    <path d="M24-16C20-27 4-28-6-14Z" fill="#1c2530"/>
    <path d="M18-1H-12L-26 14Q-26 17-22 17H-4Z" fill="#a1001f"/>
    <path d="M50-12Q60-5 50 2Z" fill="#e4e4e4"/>
    <rect x="54" y="-30" width="4" height="50" rx="2" fill="#fff" opacity=".7"/>
  </svg>`;

export function createUI(root, game, bets) {
  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="logo">${LOGO_SVG}<span class="logo-text">Pilot</span></div>
        <div class="topbar-right">
          <span class="demo-badge">Демо</span>
          <div class="balance-card">
            <span class="balance-label">Баланс</span>
            <span class="balance-value"><b id="balance">0</b><i>₴</i></span>
          </div>
        </div>
      </header>

      <div class="layout">
        <aside class="bets-sidebar">
          <div class="side-tabs">
            <button class="side-tab active">Всі ставки</button>
            <button class="side-tab" disabled>Мої</button>
            <button class="side-tab" disabled>Топ</button>
          </div>
          <div class="side-summary">
            <div>
              <div class="side-summary-label">Всього ставок</div>
              <div class="side-summary-value" id="online-count">0</div>
            </div>
            <div class="avatars">
              <span style="--c:#7c3aed">A</span><span style="--c:#0ea5e9">M</span><span style="--c:#f59e0b">L</span>
            </div>
          </div>
          <div class="feed-head"><span>Гравець</span><span>Ставка ₴</span><span>x</span><span>Виграш ₴</span></div>
          <div class="feed-list" id="feed-list"></div>
        </aside>

        <main class="stage">
          <div class="history-row">
            <div class="history-bar" id="history"></div>
            <span class="history-icon" title="Історія раундів">↺</span>
          </div>

          <div class="canvas-wrap" id="canvas-wrap">
            <div class="canvas-overlay">
              <div class="flew-away" id="status">FLEW AWAY!</div>
              <div class="multiplier-display" id="multiplier">1.00x</div>
            </div>
            <div class="crash-flash" id="crash-flash"></div>
            <div class="cashout-toast" id="toast"></div>
          </div>

          <section class="bet-card">
            <div class="bet-tabs">
              <button class="bet-tab active" data-tab="bet">Ставка</button>
              <button class="bet-tab" data-tab="auto">Авто</button>
            </div>

            <div class="bet-body">
              <div class="bet-controls">
                <div class="stepper">
                  <button class="step-btn" data-step="-10" aria-label="Зменшити">−</button>
                  <input type="number" id="bet-amount" value="50" min="10" step="10" />
                  <button class="step-btn" data-step="10" aria-label="Збільшити">+</button>
                </div>
                <div class="quick-bets">
                  <button class="quick-bet" data-amount="10">10</button>
                  <button class="quick-bet" data-amount="50">50</button>
                  <button class="quick-bet" data-amount="100">100</button>
                  <button class="quick-bet" data-amount="500">500</button>
                </div>
              </div>

              <button class="action-btn bet-btn" id="action-btn">
                <span class="btn-label">СТАВКА</span>
                <span class="btn-sub" id="btn-sub">50.00 ₴</span>
              </button>
            </div>

            <div class="bet-extra" id="tab-bet">
              <label class="extra-field">
                <span>Авто-кешаут</span>
                <span class="mini-input"><input type="number" id="auto-cashout" placeholder="—" min="1.01" step="0.1" /><i>x</i></span>
              </label>
            </div>

            <div class="bet-extra hidden" id="tab-auto">
              <label class="extra-field">
                <span>Раундів</span>
                <span class="mini-input"><input type="number" id="auto-rounds" value="10" min="1" max="100" /></span>
              </label>
              <label class="extra-field">
                <span>Кешаут</span>
                <span class="mini-input"><input type="number" id="auto-cashout-tab" value="2.00" min="1.01" step="0.1" /><i>x</i></span>
              </label>
            </div>
          </section>
        </main>
      </div>

      <footer class="footer">
        <span>Демо-режим · Віртуальні кошти</span>
        <span>PILOT v2.0 · PixiJS</span>
      </footer>
    </div>
  `;

  const els = {
    balance: root.querySelector('#balance'),
    history: root.querySelector('#history'),
    canvasWrap: root.querySelector('#canvas-wrap'),
    multiplier: root.querySelector('#multiplier'),
    status: root.querySelector('#status'),
    crashFlash: root.querySelector('#crash-flash'),
    toast: root.querySelector('#toast'),
    feedList: root.querySelector('#feed-list'),
    betAmount: root.querySelector('#bet-amount'),
    autoCashout: root.querySelector('#auto-cashout'),
    autoCashoutTab: root.querySelector('#auto-cashout-tab'),
    autoRounds: root.querySelector('#auto-rounds'),
    actionBtn: root.querySelector('#action-btn'),
    btnLabel: root.querySelector('#action-btn .btn-label'),
    btnSub: root.querySelector('#btn-sub'),
    onlineCount: root.querySelector('#online-count'),
  };

  const scene = new GameScene(els.canvasWrap);
  const feed = new PlayersFeed(els.feedList, els.onlineCount);

  let autoBetEnabled = false;
  let autoRoundsLeft = 0;
  let toastTimer = null;

  function updateBalance() {
    els.balance.textContent = formatMoney(bets.getState().balance).replace(' ₴', '');
  }

  function setButton(cls, label, sub, disabled) {
    els.actionBtn.className = `action-btn ${cls}`;
    els.btnLabel.textContent = label;
    els.btnSub.textContent = sub;
    els.actionBtn.disabled = disabled;
  }

  function updateBetUI() {
    const amount = parseFloat(els.betAmount.value) || 0;
    const { activeBet } = bets.getState();

    if (game.state === GameState.FLYING && activeBet && !activeBet.cashedOut) {
      const potential = Math.floor(activeBet.amount * game.multiplier * 100) / 100;
      setButton('cashout-btn', 'ЗАБРАТИ', formatMoney(potential), false);
    } else if (activeBet?.cashedOut) {
      setButton('cashed-btn', 'ВИГРАШ ЗАБРАНО', formatMoney(activeBet.payout), true);
    } else if (activeBet && game.state === GameState.WAITING) {
      setButton('waiting-btn', 'ОЧІКУВАННЯ', formatMoney(activeBet.amount), true);
    } else if (activeBet && game.state === GameState.CRASHED) {
      setButton('lost-btn', 'ПРОГРАШ', formatMoney(activeBet.amount), true);
    } else {
      const canBet = game.state === GameState.WAITING && bets.canBet(amount);
      setButton('bet-btn', 'СТАВКА', formatMoney(amount), !canBet);
    }
  }

  function renderHistory() {
    els.history.innerHTML = game.history
      .map((h) => `<span class="history-chip ${multiplierClass(h.crashPoint)}">${formatMultiplier(h.crashPoint)}</span>`)
      .join('');
  }

  function showToast(multiplier, payout) {
    els.toast.innerHTML = `
      <div><small>Ви забрали!</small><b>${formatMultiplier(multiplier)}</b></div>
      <div class="toast-win"><small>Виграш</small><b>${formatMoney(payout)}</b></div>`;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }

  function onGameEvent(event, data) {
    switch (event) {
      case 'waiting':
        els.canvasWrap.dataset.state = 'waiting';
        els.multiplier.textContent = '1.00x';
        scene.setState('waiting', data);
        bets.clearCashedBet();
        if (autoBetEnabled && autoRoundsLeft > 0) tryPlaceBet();
        updateBetUI();
        break;

      case 'fly':
        els.canvasWrap.dataset.state = 'flying';
        scene.setState('flying');
        feed.onRoundStart();
        updateBetUI();
        break;

      case 'tick':
        els.multiplier.textContent = formatMultiplier(data.multiplier);
        scene.update(data.elapsed);
        feed.onTick(data.multiplier);
        if (bets.tryAutoCashout(data.multiplier)) {
          const { activeBet } = bets.getState();
          feed.onCashout('Ви', activeBet.cashoutAt, activeBet.payout);
          showToast(activeBet.cashoutAt, activeBet.payout);
        }
        updateBetUI();
        break;

      case 'crash':
        els.canvasWrap.dataset.state = 'crashed';
        els.multiplier.textContent = formatMultiplier(data.crashPoint);
        els.crashFlash.classList.add('active');
        scene.setState('crashed');
        bets.loseBet();
        feed.onCrash();
        setTimeout(() => els.crashFlash.classList.remove('active'), 500);
        renderHistory();
        updateBetUI();
        break;
    }
  }

  function tryPlaceBet() {
    const amount = parseFloat(els.betAmount.value);
    const autoVal = autoBetEnabled
      ? parseFloat(els.autoCashoutTab.value)
      : parseFloat(els.autoCashout.value);
    if (bets.placeBet(amount, Number.isFinite(autoVal) ? autoVal : null)) {
      if (autoBetEnabled) autoRoundsLeft--;
      feed.addPlayer('Ви', amount);
      updateBalance();
      updateBetUI();
    }
  }

  els.actionBtn.addEventListener('click', () => {
    const { activeBet } = bets.getState();
    if (game.state === GameState.FLYING && activeBet && !activeBet.cashedOut) {
      if (bets.cashOut(game.multiplier)) {
        const { activeBet: done } = bets.getState();
        feed.onCashout('Ви', done.cashoutAt, done.payout);
        showToast(done.cashoutAt, done.payout);
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

  root.querySelectorAll('.step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (parseFloat(els.betAmount.value) || 0) + Number(btn.dataset.step);
      els.betAmount.value = Math.max(10, next);
      updateBetUI();
    });
  });

  els.betAmount.addEventListener('input', updateBetUI);

  root.querySelectorAll('.bet-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('.bet-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      root.querySelectorAll('.bet-extra').forEach((c) => c.classList.add('hidden'));
      root.querySelector(`#tab-${tab.dataset.tab}`).classList.remove('hidden');
      autoBetEnabled = tab.dataset.tab === 'auto';
      if (autoBetEnabled) autoRoundsLeft = parseInt(els.autoRounds.value) || 10;
    });
  });

  const unsubGame = game.subscribe(onGameEvent);
  const unsubBets = bets.subscribe(() => {
    updateBalance();
    updateBetUI();
  });

  els.canvasWrap.dataset.state = 'waiting';
  updateBalance();
  updateBetUI();
  feed.onRoundStart();

  return {
    destroy() {
      unsubGame();
      unsubBets();
      clearTimeout(toastTimer);
      scene.destroy();
    },
  };
}

const FAKE_NAMES = [
  'Alex_K', 'Maria99', 'ProGamer', 'LuckyStar', 'NightOwl', 'CryptoKing', 'Vortex', 'Shadow',
  'Blaze', 'NovaX', 'Phantom', 'Storm', 'Eclipse', 'Raven', 'Frost', 'd***7', 'k***2', 'Max_UA',
];
const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

class PlayersFeed {
  constructor(listEl, countEl) {
    this.listEl = listEl;
    this.countEl = countEl;
    this.entries = [];
  }

  onRoundStart() {
    const shuffled = [...FAKE_NAMES].sort(() => Math.random() - 0.5).slice(0, 14);
    const mine = this.entries.find((e) => e.me && !e.cashedOut && !e.lost);
    this.entries = shuffled.map((name, i) => ({
      name,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      bet: [10, 20, 50, 100, 200, 500, 1000][Math.floor(Math.random() * 7)],
      target: 1.05 + Math.pow(Math.random(), 2) * 6,
      cashedOut: false,
    }));
    if (mine) this.entries.unshift(mine);
    this.countEl.textContent = 180 + Math.floor(Math.random() * 120);
    this._render();
  }

  addPlayer(name, bet) {
    this.entries = this.entries.filter((e) => e.name !== name);
    this.entries.unshift({ name, color: '#e50539', bet, target: Infinity, cashedOut: false, me: true });
    this._render();
  }

  onTick(multiplier) {
    let changed = false;
    for (const e of this.entries) {
      if (!e.cashedOut && !e.me && multiplier >= e.target) {
        e.cashedOut = true;
        e.cashoutAt = e.target;
        e.win = e.bet * e.target;
        changed = true;
      }
    }
    if (changed) this._render();
  }

  onCashout(name, multiplier, payout) {
    const entry = this.entries.find((e) => e.name === name);
    if (!entry) return;
    entry.cashedOut = true;
    entry.cashoutAt = multiplier;
    entry.win = payout;
    this._render();
  }

  onCrash() {
    for (const e of this.entries) if (!e.cashedOut) e.lost = true;
    this._render();
  }

  _render() {
    this.listEl.innerHTML = this.entries
      .map((e) => {
        const cls = e.cashedOut ? 'win' : e.lost ? 'lost' : '';
        const x = e.cashedOut
          ? `<span class="feed-x ${multiplierClass(e.cashoutAt)}">${e.cashoutAt.toFixed(2)}x</span>`
          : '<span class="feed-x"></span>';
        return `<div class="feed-item ${cls} ${e.me ? 'me' : ''}">
          <span class="feed-name"><i style="--c:${e.color}">${escapeHtml(e.name[0])}</i>${escapeHtml(e.name)}</span>
          <span class="feed-bet">${e.bet.toFixed(2)}</span>
          ${x}
          <span class="feed-win">${e.cashedOut ? e.win.toFixed(2) : ''}</span>
        </div>`;
      })
      .join('');
  }
}
