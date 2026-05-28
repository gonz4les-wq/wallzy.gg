// UI layer: builds the 9x9 board, renders pawns/walls, highlights valid moves
// (including jumps), previews wall placement, and routes input to callbacks.

export class Renderer {
  constructor(boardEl, { onMove, onPlaceWall }) {
    this.board = boardEl;
    this.onMove = onMove;
    this.onPlaceWall = onPlaceWall;

    this.engine = null;
    this.interactive = false;
    this.mode = 'move'; // 'move' | 'wall'
    this.orientation = 'h'; // 'h' | 'v'

    this.cell = 0;
    this.gap = 0;
    this.validMoves = new Map(); // "r,c" -> { jump }
    this.previewSlot = null;

    this.cells = [];
    this.pawns = {};

    this.build();
    this.attachInput();
    window.addEventListener('resize', () => {
      this.layout();
      this.render();
    });
  }

  setEngine(engine) {
    this.engine = engine;
  }

  build() {
    this.board.innerHTML = '';
    this.cells = [];

    for (let r = 0; r < 9; r++) {
      const row = [];
      for (let c = 0; c < 9; c++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.r = r;
        el.dataset.c = c;
        if (r === 0) el.classList.add('goal-human');
        if (r === 8) el.classList.add('goal-bot');
        this.board.appendChild(el);
        row.push(el);
      }
      this.cells.push(row);
    }

    this.wallsLayer = document.createElement('div');
    this.wallsLayer.className = 'walls-layer';
    this.board.appendChild(this.wallsLayer);

    this.preview = document.createElement('div');
    this.preview.className = 'wall preview hidden';
    this.board.appendChild(this.preview);

    this.pawns.bot = document.createElement('div');
    this.pawns.bot.className = 'pawn bot';
    this.pawns.bot.textContent = 'B';
    this.board.appendChild(this.pawns.bot);

    this.pawns.human = document.createElement('div');
    this.pawns.human.className = 'pawn human';
    this.pawns.human.textContent = 'You';
    this.board.appendChild(this.pawns.human);

    this.layout();
  }

  layout() {
    const size = this.board.clientWidth || 480;
    this.gap = Math.max(6, Math.round(size / 55));
    this.cell = (size - 8 * this.gap) / 9;
    const step = this.cell + this.gap;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const el = this.cells[r][c];
        el.style.width = `${this.cell}px`;
        el.style.height = `${this.cell}px`;
        el.style.left = `${c * step}px`;
        el.style.top = `${r * step}px`;
      }
    }
    for (const p of Object.values(this.pawns)) {
      const inset = Math.round(this.cell * 0.12);
      p.style.width = `${this.cell - inset * 2}px`;
      p.style.height = `${this.cell - inset * 2}px`;
      p.style.fontSize = `${Math.max(10, Math.round(this.cell * 0.28))}px`;
    }
  }

  step() {
    return this.cell + this.gap;
  }

  // Pixel geometry of a wall anchored at post (r, c).
  wallRect(orientation, r, c) {
    const step = this.step();
    if (orientation === 'h') {
      return {
        left: c * step,
        top: r * step + this.cell,
        width: 2 * this.cell + this.gap,
        height: this.gap,
      };
    }
    return {
      left: c * step + this.cell,
      top: r * step,
      width: this.gap,
      height: 2 * this.cell + this.gap,
    };
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'wall') this.hidePreview();
    this.render();
  }

  setOrientation(orientation) {
    this.orientation = orientation;
    this.render();
  }

  setInteractive(on) {
    this.interactive = on;
    if (!on) this.hidePreview();
    this.render();
  }

  render() {
    if (!this.engine) return;
    const s = this.engine.getState();

    const inset = Math.round(this.cell * 0.12);
    this.placePawn(this.pawns.human, s.players.human, inset);
    this.placePawn(this.pawns.bot, s.players.bot, inset);
    this.pawns.human.classList.toggle('active', s.turn === 'human' && !s.winner);
    this.pawns.bot.classList.toggle('active', s.turn === 'bot' && !s.winner);

    this.renderWalls(s);
    this.renderHighlights(s);
  }

  placePawn(el, player, inset) {
    const step = this.step();
    el.style.transform = `translate(${player.col * step + inset}px, ${player.row * step + inset}px)`;
  }

  renderWalls(s) {
    this.wallsLayer.innerHTML = '';
    const add = (orientation, set) => {
      for (const k of set) {
        const [r, c] = k.split(',').map(Number);
        const rect = this.wallRect(orientation, r, c);
        const el = document.createElement('div');
        el.className = `wall ${orientation}`;
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        this.wallsLayer.appendChild(el);
      }
    };
    add('h', s.hWalls);
    add('v', s.vWalls);
  }

  renderHighlights(s) {
    this.validMoves.clear();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.cells[r][c].classList.remove('valid', 'jump');
      }
    }

    const canMove = this.interactive && this.mode === 'move' && s.turn === 'human' && !s.winner;
    if (!canMove) return;

    for (const m of this.engine.getValidMoves('human')) {
      this.validMoves.set(`${m.row},${m.col}`, { jump: m.jump });
      const el = this.cells[m.row][m.col];
      el.classList.add('valid');
      if (m.jump) el.classList.add('jump');
    }
  }

  // Nearest wall post (r, c) to a board-local point.
  slotAt(localX, localY) {
    const step = this.step();
    const r = Math.round((localY - this.cell - this.gap / 2) / step);
    const c = Math.round((localX - this.cell - this.gap / 2) / step);
    return {
      r: Math.max(0, Math.min(7, r)),
      c: Math.max(0, Math.min(7, c)),
    };
  }

  localPoint(evt) {
    const rect = this.board.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  updatePreview(evt) {
    if (!(this.interactive && this.mode === 'wall' && this.engine && !this.engine.winner)) {
      this.hidePreview();
      return;
    }
    const { x, y } = this.localPoint(evt);
    const { r, c } = this.slotAt(x, y);
    const valid =
      this.engine.players.human.walls > 0 &&
      this.engine.canPlaceWall(this.orientation, r, c);

    this.previewSlot = { r, c, valid };
    const rect = this.wallRect(this.orientation, r, c);
    this.preview.className = `wall preview ${this.orientation} ${valid ? 'ok' : 'bad'}`;
    this.preview.style.left = `${rect.left}px`;
    this.preview.style.top = `${rect.top}px`;
    this.preview.style.width = `${rect.width}px`;
    this.preview.style.height = `${rect.height}px`;
  }

  hidePreview() {
    this.previewSlot = null;
    this.preview.className = 'wall preview hidden';
  }

  attachInput() {
    this.board.addEventListener('click', (evt) => {
      if (!this.interactive || !this.engine || this.engine.winner) return;

      if (this.mode === 'move') {
        const cellEl = evt.target.closest('.cell');
        if (!cellEl) return;
        const r = Number(cellEl.dataset.r);
        const c = Number(cellEl.dataset.c);
        if (this.validMoves.has(`${r},${c}`)) this.onMove(r, c);
        return;
      }

      // Wall mode: place at the slot under the pointer.
      const { x, y } = this.localPoint(evt);
      const { r, c } = this.slotAt(x, y);
      if (
        this.engine.players.human.walls > 0 &&
        this.engine.canPlaceWall(this.orientation, r, c)
      ) {
        this.onPlaceWall(this.orientation, r, c);
      }
    });

    this.board.addEventListener('pointermove', (evt) => this.updatePreview(evt));
    this.board.addEventListener('pointerleave', () => this.hidePreview());
  }
}
