// Turn manager + app bootstrap: wires the engine, timer, bot, and renderer
// together, drives the Human -> Bot -> Human loop, and updates the HUD.

import { GameEngine, START_TIME_MS } from './engine.js';
import { Timer } from './timer.js';
import { Renderer } from './renderer.js';
import { chooseBotMove } from './bot.js';

const BOT_THINK_MS = 350;

class Game {
  constructor() {
    this.engine = new GameEngine();
    this.timer = new Timer(START_TIME_MS);
    this.mode = 'move';
    this.orientation = 'h';
    this.botTimer = null;

    this.renderer = new Renderer(document.getElementById('board'), {
      onMove: (r, c) => this.handleHumanMove(r, c),
      onPlaceWall: (o, r, c) => this.handleHumanWall(o, r, c),
    });
    this.renderer.setEngine(this.engine);

    this.dom = {
      humanTime: document.getElementById('human-time'),
      botTime: document.getElementById('bot-time'),
      humanWalls: document.getElementById('human-walls'),
      botWalls: document.getElementById('bot-walls'),
      turnIndicator: document.getElementById('turn-indicator'),
      modeMove: document.getElementById('mode-move'),
      modeWall: document.getElementById('mode-wall'),
      orientH: document.getElementById('orient-h'),
      orientV: document.getElementById('orient-v'),
      orientGroup: document.getElementById('orient-group'),
      newGame: document.getElementById('new-game'),
      overlay: document.getElementById('win-overlay'),
      winTitle: document.getElementById('win-title'),
      winMessage: document.getElementById('win-message'),
      winRestart: document.getElementById('win-restart'),
    };

    this.bindControls();
    this.timer.onTick = (t) => this.renderTimers(t);
    this.timer.onTimeout = (who) => this.handleTimeout(who);

    this.newGame();
  }

  bindControls() {
    this.dom.modeMove.addEventListener('click', () => this.setMode('move'));
    this.dom.modeWall.addEventListener('click', () => this.setMode('wall'));
    this.dom.orientH.addEventListener('click', () => this.setOrientation('h'));
    this.dom.orientV.addEventListener('click', () => this.setOrientation('v'));
    this.dom.newGame.addEventListener('click', () => this.newGame());
    this.dom.winRestart.addEventListener('click', () => this.newGame());

    window.addEventListener('keydown', (e) => this.handleKey(e));
  }

  newGame() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.engine.reset();
    this.timer.reset();
    this.mode = 'move';
    this.orientation = 'h';

    this.dom.overlay.classList.add('hidden');
    this.renderer.setOrientation('h');
    this.renderer.setMode('move');
    this.syncControls();
    this.renderTimers(this.timer.times);
    this.updateHud();
    this.beginTurn();
  }

  beginTurn() {
    if (this.engine.winner) return;
    this.updateHud();
    this.renderer.render();

    if (this.engine.turn === 'human') {
      this.renderer.setInteractive(true);
      this.syncControls();
      this.timer.start('human');
    } else {
      this.setMode('move');
      this.renderer.setInteractive(false);
      this.syncControls();
      this.timer.start('bot');
      this.botTimer = setTimeout(() => this.botTurn(), BOT_THINK_MS);
    }
  }

  botTurn() {
    this.botTimer = null;
    if (this.engine.winner) return;
    const action = chooseBotMove(this.engine);
    this.timer.stop();

    if (action && action.type === 'move') {
      this.engine.movePawn('bot', action.row, action.col);
    } else if (action && action.type === 'wall') {
      this.engine.placeWall('bot', action.orientation, action.r, action.c);
    }
    this.afterAction();
  }

  handleHumanMove(r, c) {
    this.timer.stop();
    if (!this.engine.movePawn('human', r, c)) {
      this.timer.start('human');
      return;
    }
    this.afterAction();
  }

  handleHumanWall(orientation, r, c) {
    this.timer.stop();
    if (!this.engine.placeWall('human', orientation, r, c)) {
      this.timer.start('human');
      return;
    }
    this.afterAction();
  }

  afterAction() {
    this.updateHud();
    this.renderer.render();
    if (this.engine.winner) {
      this.endGame();
      return;
    }
    this.beginTurn();
  }

  handleTimeout(who) {
    this.engine.winner = { who: this.engine.opponentOf(who), reason: 'time' };
    this.renderTimers(this.timer.times);
    this.endGame();
  }

  endGame() {
    this.timer.stop();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.renderer.setInteractive(false);
    this.renderer.render();

    const { who, reason } = this.engine.winner;
    const youWon = who === 'human';
    this.dom.winTitle.textContent = youWon ? 'You Win!' : 'Bot Wins';
    this.dom.winTitle.classList.toggle('lose', !youWon);
    if (reason === 'time') {
      const loser = youWon ? 'The bot' : 'You';
      this.dom.winMessage.textContent = `${loser} ran out of time.`;
    } else {
      this.dom.winMessage.textContent = youWon
        ? 'You reached the top row.'
        : 'The bot reached the bottom row.';
    }
    this.dom.overlay.classList.remove('hidden');
  }

  setMode(mode) {
    if (this.engine.turn !== 'human' && mode === 'wall') return;
    if (mode === 'wall' && this.engine.players.human.walls <= 0) return;
    this.mode = mode;
    this.renderer.setMode(mode);
    this.syncControls();
  }

  setOrientation(orientation) {
    this.orientation = orientation;
    this.renderer.setOrientation(orientation);
    this.syncControls();
  }

  syncControls() {
    const humanTurn = this.engine.turn === 'human' && !this.engine.winner;
    const noWalls = this.engine.players.human.walls <= 0;

    this.dom.modeMove.classList.toggle('active', this.mode === 'move');
    this.dom.modeWall.classList.toggle('active', this.mode === 'wall');
    this.dom.modeMove.disabled = !humanTurn;
    this.dom.modeWall.disabled = !humanTurn || noWalls;

    this.dom.orientGroup.classList.toggle('hidden', this.mode !== 'wall');
    this.dom.orientH.classList.toggle('active', this.orientation === 'h');
    this.dom.orientV.classList.toggle('active', this.orientation === 'v');
  }

  updateHud() {
    this.dom.humanWalls.textContent = this.engine.players.human.walls;
    this.dom.botWalls.textContent = this.engine.players.bot.walls;

    if (this.engine.winner) {
      this.dom.turnIndicator.textContent = 'Game over';
    } else if (this.engine.turn === 'human') {
      this.dom.turnIndicator.textContent = 'Your turn';
    } else {
      this.dom.turnIndicator.textContent = 'Bot thinking…';
    }
    this.dom.turnIndicator.classList.toggle('human-turn', this.engine.turn === 'human');
    this.syncControls();
  }

  renderTimers(times) {
    this.dom.humanTime.textContent = formatTime(times.human);
    this.dom.botTime.textContent = formatTime(times.bot);
    this.dom.humanTime.classList.toggle('low', times.human <= 10000);
    this.dom.botTime.classList.toggle('low', times.bot <= 10000);
  }

  handleKey(e) {
    if (this.engine.winner || this.engine.turn !== 'human') return;

    if (e.key === 'w' || e.key === 'W') {
      this.setMode(this.mode === 'wall' ? 'move' : 'wall');
      return;
    }
    if ((e.key === 'r' || e.key === 'R') && this.mode === 'wall') {
      this.setOrientation(this.orientation === 'h' ? 'v' : 'h');
      return;
    }
    if (this.mode !== 'move') return;

    const dirs = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();

    const me = this.engine.players.human;
    const moves = this.engine.getValidMoves('human');
    // Prefer a straight step/jump in the pressed direction.
    const targets = [
      { r: me.row + d[0], c: me.col + d[1] },
      { r: me.row + d[0] * 2, c: me.col + d[1] * 2 },
    ];
    for (const t of targets) {
      if (moves.some((m) => m.row === t.r && m.col === t.c)) {
        this.handleHumanMove(t.r, t.c);
        return;
      }
    }
  }
}

function formatTime(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

window.addEventListener('DOMContentLoaded', () => new Game());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
