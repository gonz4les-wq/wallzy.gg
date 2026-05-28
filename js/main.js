// App bootstrap + orchestration: screens (home / mode / shop / game / win),
// the turn manager, profile (XP, coins, cosmetics) and the per-mode game loop.

import { GameEngine } from './engine.js';
import { Timer } from './timer.js';
import { Renderer } from './renderer.js';
import { chooseBotMove, resetBotMemory } from './bot.js';
import { MODES, MODE_ORDER, getMode } from './modes.js';
import { itemsByType, getItem, applyEquipped, applyPreview } from './cosmetics.js';
import { loadProfile, saveProfile, levelInfo, applyResult, buyItem, equipItem } from './profile.js';

class Game {
  constructor() {
    this.profile = loadProfile();
    applyEquipped(this.profile.equipped);

    this.engine = new GameEngine();
    this.timer = new Timer(60000);
    this.mode = getMode('classic');
    this.level = 'medium';
    this.selectedMode = 'classic';
    this.selectedLevel = 'medium';
    this.uiMode = 'move';
    this.orientation = 'h';
    this.botTimer = null;
    this.screen = 'home';

    this.renderer = new Renderer(document.getElementById('board'), {
      onMove: (r, c) => this.handleHumanMove(r, c),
      onPlaceWall: (o, r, c) => this.handleHumanWall(o, r, c),
    });
    this.renderer.setEngine(this.engine);

    this.cacheDom();
    this.bindControls();
    this.timer.onTick = (t) => this.renderTimers(t);
    this.timer.onTimeout = (who) => this.handleTimeout(who);

    this.buildModeList();
    this.renderShop();

    this.engine.reset({ size: this.mode.size, walls: this.mode.walls });
    this.renderer.buildBoard();
    this.renderer.render();
    this.showScreen('home');
  }

  cacheDom() {
    const id = (x) => document.getElementById(x);
    this.dom = {
      humanTime: id('human-time'),
      botTime: id('bot-time'),
      humanWalls: id('human-walls'),
      botWalls: id('bot-walls'),
      turnIndicator: id('turn-indicator'),
      botRole: id('bot-role'),
      modeMove: id('mode-move'),
      modeWall: id('mode-wall'),
      orientH: id('orient-h'),
      orientV: id('orient-v'),
      orientGroup: id('orient-group'),
      menuBtn: id('menu-btn'),

      home: id('home-screen'),
      homeLevel: id('home-level'),
      homeXpBar: id('home-xp-bar'),
      homeXpText: id('home-xp-text'),
      homeCoins: id('home-coins'),
      homeStats: id('home-stats'),
      openPlay: id('open-play'),
      openShop: id('open-shop'),

      modeScreen: id('mode-screen'),
      modeList: id('mode-list'),
      modeStart: id('mode-start'),
      modeBack: id('mode-back'),
      diffButtons: Array.from(document.querySelectorAll('.diff')),

      shopScreen: id('shop-screen'),
      shopCoins: id('shop-coins'),
      shopPawn: id('shop-pawn'),
      shopBoard: id('shop-board'),
      shopWall: id('shop-wall'),
      shopBack: id('shop-back'),

      winOverlay: id('win-overlay'),
      winTitle: id('win-title'),
      winMessage: id('win-message'),
      rewardXp: id('reward-xp'),
      rewardCoins: id('reward-coins'),
      winLevelup: id('win-levelup'),
      winRestart: id('win-restart'),
      winHome: id('win-home'),
    };
  }

  bindControls() {
    this.dom.modeMove.addEventListener('click', () => this.setUiMode('move'));
    this.dom.modeWall.addEventListener('click', () => this.setUiMode('wall'));
    this.dom.orientH.addEventListener('click', () => this.setOrientation('h'));
    this.dom.orientV.addEventListener('click', () => this.setOrientation('v'));
    this.dom.menuBtn.addEventListener('click', () => this.showScreen('home'));

    this.dom.openPlay.addEventListener('click', () => this.showScreen('mode'));
    this.dom.openShop.addEventListener('click', () => this.showScreen('shop'));
    this.dom.modeBack.addEventListener('click', () => this.showScreen('home'));
    this.dom.shopBack.addEventListener('click', () => this.showScreen('home'));
    this.dom.modeStart.addEventListener('click', () => this.startGame());
    for (const btn of this.dom.diffButtons) {
      btn.addEventListener('click', () => this.selectDifficulty(btn.dataset.level));
    }

    this.dom.winRestart.addEventListener('click', () => this.startGame());
    this.dom.winHome.addEventListener('click', () => this.showScreen('home'));

    window.addEventListener('keydown', (e) => this.handleKey(e));
  }

  // ---- screens ----

  showScreen(name) {
    this.screen = name;
    this.dom.home.classList.toggle('hidden', name !== 'home');
    this.dom.modeScreen.classList.toggle('hidden', name !== 'mode');
    this.dom.shopScreen.classList.toggle('hidden', name !== 'shop');
    this.dom.winOverlay.classList.toggle('hidden', name !== 'win');

    if (name !== 'game') {
      this.timer.stop();
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
      this.renderer.setInteractive(false);
    }
    if (name === 'home') this.renderHome();
    if (name === 'shop') this.renderShop();
    if (name === 'mode') this.syncModeSelect();
  }

  renderHome() {
    applyEquipped(this.profile.equipped);
    const info = levelInfo(this.profile.xp);
    this.dom.homeLevel.textContent = info.level;
    this.dom.homeXpBar.style.width = `${info.pct}%`;
    this.dom.homeXpText.textContent = `${info.intoLevel} / ${info.need} XP`;
    this.dom.homeCoins.textContent = this.profile.coins;
    const s = this.profile.stats;
    this.dom.homeStats.textContent = `Wins ${s.wins} · Losses ${s.losses}`;
  }

  buildModeList() {
    this.dom.modeList.innerHTML = '';
    for (const mid of MODE_ORDER) {
      const m = MODES[mid];
      const card = document.createElement('button');
      card.className = 'mode-card';
      card.dataset.mode = mid;
      card.innerHTML = `<span class="mode-name">${m.name}</span>
        <span class="mode-tag">${m.tagline}</span>
        <span class="mode-desc">${m.desc}</span>`;
      card.addEventListener('click', () => this.selectMode(mid));
      this.dom.modeList.appendChild(card);
    }
    this.syncModeSelect();
  }

  selectMode(id) {
    this.selectedMode = id;
    this.syncModeSelect();
  }

  selectDifficulty(level) {
    this.selectedLevel = level;
    this.syncModeSelect();
  }

  syncModeSelect() {
    for (const card of this.dom.modeList.children) {
      card.classList.toggle('active', card.dataset.mode === this.selectedMode);
    }
    for (const btn of this.dom.diffButtons) {
      btn.classList.toggle('active', btn.dataset.level === this.selectedLevel);
    }
  }

  // ---- shop ----

  renderShop() {
    this.dom.shopCoins.textContent = `${this.profile.coins} ⛁`;
    this.fillShopGrid(this.dom.shopPawn, 'pawn');
    this.fillShopGrid(this.dom.shopBoard, 'board');
    this.fillShopGrid(this.dom.shopWall, 'wall');
  }

  fillShopGrid(grid, type) {
    grid.innerHTML = '';
    for (const item of itemsByType(type)) {
      const owned = this.profile.owned.includes(item.id);
      const equipped = this.profile.equipped[type] === item.id;
      const card = document.createElement('button');
      card.className = `shop-item${owned ? ' owned' : ''}${equipped ? ' equipped' : ''}`;

      let status;
      if (equipped) status = 'Equipped';
      else if (owned) status = 'Equip';
      else status = `${item.price} ⛁`;

      card.innerHTML = `<span class="swatch" style="background:${swatchColor(item)}"></span>
        <span class="item-name">${item.name}</span>
        <span class="item-status">${status}</span>`;

      card.addEventListener('pointerenter', () => applyPreview(this.profile.equipped, item));
      card.addEventListener('pointerleave', () => applyEquipped(this.profile.equipped));
      card.addEventListener('click', () => this.handleShopClick(item, card));
      grid.appendChild(card);
    }
  }

  handleShopClick(item, card) {
    const owned = this.profile.owned.includes(item.id);
    if (owned) {
      equipItem(this.profile, item.id);
    } else {
      const res = buyItem(this.profile, item.id);
      if (!res.ok) {
        if (res.reason === 'funds') {
          card.classList.add('cant');
          setTimeout(() => card.classList.remove('cant'), 400);
        }
        return;
      }
      equipItem(this.profile, item.id); // auto-equip on purchase
    }
    saveProfile(this.profile);
    applyEquipped(this.profile.equipped);
    this.renderShop();
  }

  // ---- game loop ----

  startGame() {
    this.mode = getMode(this.selectedMode);
    this.level = this.selectedLevel;
    this.uiMode = 'move';
    this.orientation = 'h';

    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.engine.reset({ size: this.mode.size, walls: this.mode.walls });
    resetBotMemory();
    this.timer.startMs = this.mode.timeMs;
    this.timer.reset();

    this.renderer.buildBoard();
    this.renderer.setOrientation('h');
    this.renderer.setMode('move');

    this.showScreen('game');
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
      this.setUiMode('move');
      this.renderer.setInteractive(false);
      this.syncControls();
      this.timer.start('bot');
      this.botTimer = setTimeout(() => this.botTurn(), this.mode.thinkMs);
    }
  }

  botTurn() {
    this.botTimer = null;
    if (this.engine.winner || this.screen !== 'game') return;
    const action = chooseBotMove(this.engine, this.level);
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
    const won = who === 'human';
    const reward = applyResult(this.profile, { mode: this.mode, won });
    saveProfile(this.profile);

    this.dom.winTitle.textContent = won ? 'You Win!' : 'Bot Wins';
    this.dom.winTitle.classList.toggle('lose', !won);
    if (reason === 'time') {
      this.dom.winMessage.textContent = won ? 'The bot ran out of time.' : 'You ran out of time.';
    } else {
      this.dom.winMessage.textContent = won ? 'You reached the top row.' : 'The bot reached the bottom row.';
    }
    this.dom.rewardXp.textContent = `+${reward.xpGain}`;
    this.dom.rewardCoins.textContent = `+${reward.coinGain}`;
    this.dom.winLevelup.classList.toggle('hidden', !reward.leveledUp);
    if (reward.leveledUp) this.dom.winLevelup.textContent = `Level up! You reached level ${reward.newLevel}.`;

    this.showScreen('win');
  }

  // ---- in-game UI ----

  setUiMode(mode) {
    if (this.engine.turn !== 'human' && mode === 'wall') return;
    if (mode === 'wall' && this.engine.players.human.walls <= 0) return;
    this.uiMode = mode;
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

    this.dom.modeMove.classList.toggle('active', this.uiMode === 'move');
    this.dom.modeWall.classList.toggle('active', this.uiMode === 'wall');
    this.dom.modeMove.disabled = !humanTurn;
    this.dom.modeWall.disabled = !humanTurn || noWalls;

    this.dom.orientGroup.classList.toggle('hidden', this.uiMode !== 'wall');
    this.dom.orientH.classList.toggle('active', this.orientation === 'h');
    this.dom.orientV.classList.toggle('active', this.orientation === 'v');
  }

  updateHud() {
    this.dom.humanWalls.textContent = this.engine.players.human.walls;
    this.dom.botWalls.textContent = this.engine.players.bot.walls;
    const lvl = this.level[0].toUpperCase() + this.level.slice(1);
    this.dom.botRole.textContent = `Bot · ${lvl}`;

    if (this.engine.winner) {
      this.dom.turnIndicator.textContent = 'Game over';
    } else if (this.engine.turn === 'human') {
      this.dom.turnIndicator.textContent = 'Your turn';
    } else {
      this.dom.turnIndicator.textContent = 'Bot thinking…';
    }
    this.dom.turnIndicator.classList.toggle('human-turn', this.engine.turn === 'human' && !this.engine.winner);
    this.syncControls();
  }

  renderTimers(times) {
    this.dom.humanTime.textContent = formatTime(times.human);
    this.dom.botTime.textContent = formatTime(times.bot);
    this.dom.humanTime.classList.toggle('low', times.human <= 10000);
    this.dom.botTime.classList.toggle('low', times.bot <= 10000);
  }

  handleKey(e) {
    if (this.screen !== 'game' || this.engine.winner || this.engine.turn !== 'human') return;

    if (e.key === 'w' || e.key === 'W') {
      this.setUiMode(this.uiMode === 'wall' ? 'move' : 'wall');
      return;
    }
    if ((e.key === 'r' || e.key === 'R') && this.uiMode === 'wall') {
      this.setOrientation(this.orientation === 'h' ? 'v' : 'h');
      return;
    }
    if (this.uiMode !== 'move') return;

    const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();

    const me = this.engine.players.human;
    const moves = this.engine.getValidMoves('human');
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

function swatchColor(item) {
  if (item.type === 'pawn') return item.vars['--human'] || '#00d4a0';
  if (item.type === 'wall') return item.vars['--wall'] || '#f4b740';
  return item.vars['--cell'] || '#2a3160';
}

window.addEventListener('DOMContentLoaded', () => new Game());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
