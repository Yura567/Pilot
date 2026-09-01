import { CrashGame, GameState, BetManager } from './game.js';
import { createUI } from './ui.js';
import './styles.css';

const game = new CrashGame();
const bets = new BetManager(1000);

const ui = createUI(document.getElementById('app'), game, bets);

game.startWaiting(4000);

window.addEventListener('beforeunload', () => {
  game.destroy();
  ui.destroy();
});
