// All editor UI as HTML/CSS. The scene mounts this on entry, unmounts on
// exit. Taps in the bars are captured here; taps in the grid area fall
// through to the Phaser canvas below.
//
// The palette uses the system font at readable sizes and honors iOS safe
// areas. Nothing here uses the game's bitmap font.

const TOOL_DEFS = [
  { id: 'solid',       label: 'SOLID',   title: 'Solid wall tile' },
  { id: 'oneway',      label: 'PLAT',    title: 'One-way platform' },
  { id: 'erase',       label: 'ERASE',   title: 'Erase tile (keeps entities)' },
  { id: 'multi-erase', label: 'M-ERASE', title: 'Erase tile + all entities' },
  { id: 'player',      label: 'SPAWN',   title: 'Player spawn' },
  { id: 'walker',      label: 'ENEMY',   title: 'Walker (tap again to remove)' },
  { id: 'pickup',      label: 'PICK',    title: 'Pickup' },
  { id: 'door',        label: 'DOOR',    title: 'Door' },
  { id: 'multi-place', label: 'STAMP',   title: 'Multi-place stamp' },
  { id: 'pan',         label: 'PAN',     title: 'Pan view (drag)' }
];

const STYLE = `
  #editor-ui {
    position: fixed; inset: 0; z-index: 100;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    font-size: 13px;
    line-height: 1.2;
    -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  #editor-ui .ed-bars {
    position: absolute; top: 0; left: 0; right: 0;
    padding-top: env(safe-area-inset-top, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    pointer-events: auto;
    background: #181822;
    border-bottom: 1px solid #000;
    box-sizing: border-box;
  }
  #editor-ui .ed-bar {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 6px;
    border-bottom: 1px solid #2a2a3a;
    min-height: 34px;
    box-sizing: border-box;
  }
  #editor-ui .ed-bar:last-child { border-bottom: none; }
  #editor-ui .ed-spacer { flex: 1; }
  #editor-ui .ed-room-name {
    font-weight: 600; color: #9cf; padding: 0 6px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 40vw;
  }
  #editor-ui button.ed-btn {
    appearance: none; -webkit-appearance: none;
    background: #333348; color: #ddd;
    border: 1px solid #555;
    border-radius: 6px;
    padding: 6px 10px;
    font: inherit; font-size: 13px; font-weight: 600;
    min-height: 30px; min-width: 30px;
    touch-action: manipulation;
    cursor: pointer;
  }
  #editor-ui button.ed-btn:active { background: #4a4a60; }
  #editor-ui button.ed-btn.sm { padding: 4px 8px; min-height: 28px; min-width: 28px; font-size: 12px; }
  #editor-ui button.ed-btn.play { background: #005522; border-color: #007733; color: #fff; }
  #editor-ui button.ed-btn.back { background: #553333; border-color: #773333; }
  #editor-ui button.ed-btn.danger { background: #772222; border-color: #aa3333; color: #fff; }
  #editor-ui button.ed-btn.active { background: #006644; border-color: #00aa66; color: #fff; }
  #editor-ui .ed-tools-wrap {
    flex-wrap: wrap;
    row-gap: 4px;
  }
  #editor-ui .ed-tool {
    appearance: none; -webkit-appearance: none;
    background: #222233; color: #ddd;
    border: 1px solid #444;
    border-radius: 6px;
    font: inherit; font-size: 11px; font-weight: 700;
    min-height: 36px; min-width: 54px;
    padding: 2px 4px;
    flex: 1 1 54px;
    letter-spacing: -0.3px;
    line-height: 1.1;
    cursor: pointer;
    touch-action: manipulation;
  }
  #editor-ui .ed-tool.active { background: #006644; border-color: #00aa66; color: #fff; }
  #editor-ui .ed-val {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px; color: #ddd;
    min-width: 28px; text-align: center;
  }
  #editor-ui .ed-label {
    color: #888; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  #editor-ui .ed-toast {
    position: absolute; bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.9); color: #fff;
    padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms;
    z-index: 20;
    white-space: nowrap;
  }
  #editor-ui .ed-toast.show { opacity: 1; }
  #editor-ui .ed-toast.error { background: rgba(120,0,0,0.95); }
  #editor-ui .ed-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    display: none;
    align-items: center; justify-content: center;
    pointer-events: auto;
    z-index: 50;
    padding: calc(20px + env(safe-area-inset-top, 0px))
             calc(20px + env(safe-area-inset-right, 0px))
             calc(20px + env(safe-area-inset-bottom, 0px))
             calc(20px + env(safe-area-inset-left, 0px));
    box-sizing: border-box;
  }
  #editor-ui .ed-modal-backdrop.show { display: flex; }
  #editor-ui .ed-modal {
    background: #222230;
    border: 1px solid #444;
    border-radius: 10px;
    padding: 16px;
    min-width: 260px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  }
  #editor-ui .ed-modal h2 {
    font-size: 15px; font-weight: 700; margin: 0 0 12px 0;
    color: #fff;
  }
  #editor-ui .ed-modal-body { margin-bottom: 14px; }
  #editor-ui .ed-modal-actions {
    display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;
  }
  #editor-ui .ed-form label {
    display: flex; align-items: center; gap: 8px;
    margin: 8px 0;
    font-size: 13px; color: #ccc;
  }
  #editor-ui .ed-form input,
  #editor-ui .ed-form select {
    flex: 1;
    appearance: none;
    background: #333348; color: #fff;
    border: 1px solid #555;
    border-radius: 6px;
    padding: 8px 10px;
    font: inherit; font-size: 14px;
    min-height: 36px;
    box-sizing: border-box;
  }
  #editor-ui .ed-form input:focus,
  #editor-ui .ed-form select:focus {
    outline: none; border-color: #00aa66;
  }
  #editor-ui .ed-room-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 0; border-bottom: 1px solid #333;
  }
  #editor-ui .ed-room-row:last-child { border-bottom: none; }
  #editor-ui .ed-room-row .ed-room-label {
    flex: 1; font-size: 13px; color: #ddd;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #editor-ui .ed-room-row .ed-room-meta {
    font-size: 11px; color: #888; font-family: ui-monospace, monospace;
  }
  #editor-ui .ed-section-title {
    font-size: 11px; font-weight: 700; color: #888;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin: 12px 0 4px 0;
  }
  #editor-ui .ed-warn {
    color: #fc8; font-size: 13px; line-height: 1.4;
  }
  #editor-ui .ed-textarea {
    width: 100%; box-sizing: border-box;
    background: #111; color: #9f9;
    border: 1px solid #333; border-radius: 6px;
    padding: 8px; font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    min-height: 200px; max-height: 50vh;
    resize: vertical;
  }
`;

export class EditorUI {
  constructor({ onAction }) {
    this.onAction = onAction;
    this.el = null;
    this.bars = null;
    this.toolBtns = {};
    this.toolActive = 'solid';
    this.modalEl = null;
    this.toastEl = null;
    this.toastTimer = null;
    this._barRect = null;
    this._onResize = () => this._remeasure();
  }

  mount() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'editor-ui';
    this.el.innerHTML = this._buildHtml();
    document.body.appendChild(this.el);
    this._cache();
    this._wire();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    // First measurement after layout settles.
    requestAnimationFrame(() => this._remeasure());
  }

  unmount() {
    if (!this.el) return;
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.el.remove();
    this.el = null;
    this.bars = null;
    this.toolBtns = {};
    this.modalEl = null;
    this.toastEl = null;
  }

  _buildHtml() {
    const toolsHtml = TOOL_DEFS.map((t) =>
      `<button class="ed-tool" data-tool="${t.id}" title="${t.title}">${t.label}</button>`
    ).join('');

    return `
      <style>${STYLE}</style>
      <div class="ed-bars" id="ed-bars">
        <div class="ed-bar">
          <button class="ed-btn back" data-action="back">BACK</button>
          <button class="ed-btn" data-action="rooms">ROOMS</button>
          <span class="ed-room-name" id="ed-room-name">-</span>
          <span class="ed-spacer"></span>
          <button class="ed-btn sm" data-action="new">NEW</button>
          <button class="ed-btn sm" data-action="duplicate">DUP</button>
          <button class="ed-btn sm" data-action="rename">REN</button>
          <button class="ed-btn sm" data-action="delete">DEL</button>
          <button class="ed-btn sm" data-action="export">EXP</button>
          <button class="ed-btn play" data-action="play">PLAY</button>
        </div>
        <div class="ed-bar ed-tools-wrap">
          ${toolsHtml}
        </div>
        <div class="ed-bar">
          <span class="ed-label">W</span>
          <button class="ed-btn sm" data-action="resize" data-axis="w" data-delta="-1">-</button>
          <span class="ed-val" id="ed-w-val">-</span>
          <button class="ed-btn sm" data-action="resize" data-axis="w" data-delta="1">+</button>
          <span class="ed-label">H</span>
          <button class="ed-btn sm" data-action="resize" data-axis="h" data-delta="-1">-</button>
          <span class="ed-val" id="ed-h-val">-</span>
          <button class="ed-btn sm" data-action="resize" data-axis="h" data-delta="1">+</button>
          <span class="ed-spacer"></span>
          <button class="ed-btn sm" data-action="zoom" data-delta="-1">-</button>
          <span class="ed-val" id="ed-z-val">-</span>
          <button class="ed-btn sm" data-action="zoom" data-delta="1">+</button>
          <button class="ed-btn sm" data-action="fit">FIT</button>
        </div>
      </div>
      <div class="ed-toast" id="ed-toast"></div>
      <div class="ed-modal-backdrop" id="ed-modal-backdrop">
        <div class="ed-modal" id="ed-modal"></div>
      </div>
    `;
  }

  _cache() {
    this.bars = this.el.querySelector('#ed-bars');
    this.roomNameEl = this.el.querySelector('#ed-room-name');
    this.wValEl = this.el.querySelector('#ed-w-val');
    this.hValEl = this.el.querySelector('#ed-h-val');
    this.zValEl = this.el.querySelector('#ed-z-val');
    this.toastEl = this.el.querySelector('#ed-toast');
    this.modalEl = this.el.querySelector('#ed-modal');
    this.modalBackdrop = this.el.querySelector('#ed-modal-backdrop');
    this.toolBtns = {};
    this.el.querySelectorAll('.ed-tool').forEach((btn) => {
      this.toolBtns[btn.dataset.tool] = btn;
    });
  }

  _wire() {
    // Bars: buttons with data-action
    this.el.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = { type: btn.dataset.action };
        if (btn.dataset.axis)  action.axis  = btn.dataset.axis;
        if (btn.dataset.delta) action.delta = parseInt(btn.dataset.delta, 10);
        this.onAction(action);
      });
    });
    // Tool buttons
    this.el.querySelectorAll('.ed-tool').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onAction({ type: 'tool', id: btn.dataset.tool });
      });
    });
  }

  _remeasure() {
    if (!this.bars) return;
    this._barRect = this.bars.getBoundingClientRect();
  }

  // Bottom of the top bars, in PAGE coordinates. Used by the scene to
  // compute the camera viewport top edge.
  getBarsBottomPhysical() {
    if (!this._barRect) this._remeasure();
    return this._barRect ? this._barRect.bottom : 0;
  }

  // Physical pixels occupied by the bottom safe area (home indicator).
  // Uses a sentinel element because getComputedStyle is unreliable for
  // env() on some Safari versions. Cheap to call - - one hidden DOM
  // node per query, but fitRoom runs only on load / resize.
  getBottomInsetPhysical() {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;height:env(safe-area-inset-bottom,0px);' +
      'pointer-events:none;visibility:hidden;';
    document.body.appendChild(el);
    const h = el.getBoundingClientRect().height;
    el.remove();
    return h;
  }

  setState(state) {
    if (!this.el) return;
    if (state.tool != null) {
      this.toolActive = state.tool;
      for (const id in this.toolBtns) {
        this.toolBtns[id].classList.toggle('active', id === state.tool);
      }
    }
    if (state.roomName != null) this.roomNameEl.textContent = state.roomName;
    if (state.size) {
      this.wValEl.textContent = String(state.size[0]);
      this.hValEl.textContent = String(state.size[1]);
    }
    if (state.zoom != null) this.zValEl.textContent = 'x' + state.zoom;
  }

  showToast(text, isError = false) {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.toggle('error', !!isError);
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2200);
  }

  isModalOpen() {
    return this.modalBackdrop && this.modalBackdrop.classList.contains('show');
  }

  // Generic modal: { title, bodyHtml, buttons: [{label, danger, primary, onClick(el)}] }
  showModal({ title, bodyHtml, buttons }) {
    if (!this.modalEl) return;
    const btnsHtml = (buttons || []).map((b, i) => {
      const cls = b.danger ? 'danger' : (b.primary ? 'play' : '');
      return `<button class="ed-btn ${cls}" data-idx="${i}">${b.label}</button>`;
    }).join('');
    this.modalEl.innerHTML = `
      <h2>${title}</h2>
      <div class="ed-modal-body">${bodyHtml || ''}</div>
      <div class="ed-modal-actions">${btnsHtml}</div>
    `;
    this.modalEl.querySelectorAll('[data-idx]').forEach((btn) => {
      const idx = parseInt(btn.dataset.idx, 10);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handler = buttons[idx].onClick;
        if (handler) handler(this.modalEl);
      });
    });
    this.modalBackdrop.classList.add('show');
    // Force layout so any input has a size.
    void this.modalEl.offsetHeight;
  }

  hideModal() {
    if (this.modalBackdrop) this.modalBackdrop.classList.remove('show');
    if (this.modalEl) this.modalEl.innerHTML = '';
  }
}
