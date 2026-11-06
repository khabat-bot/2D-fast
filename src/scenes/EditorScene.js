import Phaser from 'phaser';
import { TILE_SIZE, DOOR_W, DOOR_H } from '../config/roomConfig.js';
import {
  ZOOM_LEVELS, MIN_ROOM_W, MAX_ROOM_W, MIN_ROOM_H, MAX_ROOM_H,
  COLOR_SOLID_TILE, COLOR_ONEWAY_TILE,
  COLOR_GRID_LINE, COLOR_GRID_LINE_ALPHA,
  COLOR_PLAYER_MARK, COLOR_WALKER_MARK, COLOR_PICKUP_MARK, COLOR_DOOR_MARK,
  COLOR_BG, DEFAULT_NEW_W, DEFAULT_NEW_H
} from '../config/editorConfig.js';
import * as RoomStore from '../systems/RoomStore.js';
import { EditorUI } from '../ui/EditorUI.js';
import { TILE } from '../data/tiles.js';
import { WEAPONS } from '../data/weapons.js';

const VIEW_W = 390;
const VIEW_H = 180;

// Phaser-side renderer for the grid. The HTML UI (EditorUI) handles all
// buttons, modals, and toasts. The Phaser camera's viewport is set to
// exclude the top HTML bars so paint taps land on the correct tile.
export class EditorScene extends Phaser.Scene {
  constructor() {
    super('EditorScene');
    this.roomData = null;
    this.tool = 'solid';
    this.zoom = 0.5;
    this.gridDirty = true;
    this.activePointerId = null;
    this.dragMode = null;
    this.transitioning = false;
    this.saveTimer = null;
    this.roomRT = null;
    this.viewportTop = 0;
    this.viewportH = VIEW_H;
    this.multiPlaceConfig = null;
  }

  create() {
    this.gridDirty = true;
    this.activePointerId = null;
    this.dragMode = null;
    this.transitioning = false;
    this.saveTimer = null;
    this.roomRT = null;

    // Load room from store (or seed from test_room on first ever open).
    if (!this.roomData) {
      RoomStore.ensureSeedRoom();
      const store = RoomStore.load();
      const id = store.lastId || Object.keys(store.rooms)[0];
      const working = RoomStore.getWorkingById(id);
      if (working) {
        this.roomData = working;
      } else {
        this.roomData = RoomStore.createBlank(DEFAULT_NEW_W, DEFAULT_NEW_H);
        RoomStore.saveRoom(this.roomData);
      }
    }

    this.cameras.main.setBackgroundColor(COLOR_BG);

    // HTML overlay.
    this.ui = new EditorUI({ onAction: (a) => this.handleAction(a) });
    this.ui.mount();
    this.ui.setState({
      tool: this.tool,
      roomName: this.roomData.id,
      size: [this.roomData.tilesWide, this.roomData.tilesTall],
      zoom: this.zoom
    });

    // Wait one frame for the bars to lay out before fitting.
    this.time.delayedCall(0, () => this.fitRoom());

    // Phaser-side input (grid only - - bars intercept their own taps).
    this._setupGridInput();

    this.events.once('shutdown', () => this._onShutdown());
    this.events.once('sleep', () => this._onShutdown());
  }

  _onShutdown() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.roomData) RoomStore.saveRoom(this.roomData);
    if (this.ui) { this.ui.unmount(); this.ui = null; }
    if (this.roomRT) { this.roomRT.destroy(); this.roomRT = null; }
    this.input.removeAllListeners();
  }

  update() {
    if (this.gridDirty) {
      this.gridDirty = false;
      this.rebuildRoomTexture();
    }
  }

  // --- camera / layout ----------------------------------------------------

  fitRoom() {
    if (!this.ui) return;
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const barsBottom = this.ui.getBarsBottomPhysical();
    const pxPerInternal = canvasRect.height / VIEW_H;
    const viewportTopPx = Math.max(0, (barsBottom - canvasRect.top) / pxPerInternal);
    // Respect bottom safe area (home indicator on iPhone). Without this,
    // the bottom row of tiles sits under the home indicator and is
    // unreachable.
    const bottomInsetPx = this.ui.getBottomInsetPhysical();
    const viewportBottomPx = VIEW_H - (bottomInsetPx / pxPerInternal);
    const viewportH = Math.max(20, viewportBottomPx - viewportTopPx);

    const roomW = this.roomData.tilesWide * this.roomData.tileSize;
    const roomH = this.roomData.tilesTall * this.roomData.tileSize;

    let z = ZOOM_LEVELS[0];
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
      const cand = ZOOM_LEVELS[i];
      if (roomW * cand <= VIEW_W && roomH * cand <= viewportH) {
        z = cand;
        break;
      }
    }

    const cam = this.cameras.main;
    this.viewportTop = Math.floor(viewportTopPx);
    this.viewportH = Math.ceil(viewportH);
    cam.setViewport(0, this.viewportTop, VIEW_W, this.viewportH);
    cam.setZoom(z);
    cam.centerOn(roomW / 2, roomH / 2);
    this.zoom = z;
    this.ui.setState({ zoom: z });
  }

  refitZoomOnly() {
    // Called after resize: keep the room centered, adjust zoom if needed.
    if (!this.ui) return;
    const roomW = this.roomData.tilesWide * this.roomData.tileSize;
    const roomH = this.roomData.tilesTall * this.roomData.tileSize;
    const maxW = VIEW_W;
    const maxH = this.viewportH;
    let z = this.zoom;
    if (roomW * z > maxW || roomH * z > maxH) {
      for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
        const cand = ZOOM_LEVELS[i];
        if (roomW * cand <= maxW && roomH * cand <= maxH) { z = cand; break; }
      }
    }
    const cam = this.cameras.main;
    cam.setZoom(z);
    cam.centerOn(roomW / 2, roomH / 2);
    this.zoom = z;
    this.ui.setState({ zoom: z });
  }

  setZoomLevel(z) {
    const cam = this.cameras.main;
    const cx = cam.worldView.centerX;
    const cy = cam.worldView.centerY;
    cam.setZoom(z);
    cam.centerOn(cx, cy);
    this.zoom = z;
    this.ui.setState({ zoom: z });
  }

  // --- actions from HTML UI ----------------------------------------------

  handleAction(action) {
    if (this.transitioning && action.type !== 'back') return;
    switch (action.type) {
      case 'play':       this.onPlay(); break;
      case 'back':       this.onBack(); break;
      case 'tool':       this.onSelectTool(action.id); break;
      case 'resize':     this.onResize(action.axis, action.delta); break;
      case 'zoom':       this.onZoomStep(action.delta); break;
      case 'fit':        this.fitRoom(); break;
      case 'rooms':      this.showRoomsModal(); break;
      case 'new':        this.showNewRoomModal(); break;
      case 'duplicate':  this.showDuplicateCurrentModal(); break;
      case 'rename':     this.showRenameModal(); break;
      case 'delete':     this.showDeleteModal(); break;
      case 'export':     this.showExportModal(); break;
    }
  }

  onSelectTool(id) {
    this.tool = id;
    this.ui.setState({ tool: id });
  }

  onZoomStep(delta) {
    const cur = ZOOM_LEVELS.indexOf(this.zoom);
    let next = cur < 0 ? 1 : cur + delta;
    if (next < 0) next = 0;
    if (next >= ZOOM_LEVELS.length) next = ZOOM_LEVELS.length - 1;
    this.setZoomLevel(ZOOM_LEVELS[next]);
  }

  onPlay() {
    if (this.transitioning) return;
    if (!this.roomData.playerSpawn) {
      this.ui.showToast('PLACE PLAYER SPAWN (P)', true);
      return;
    }
    if (!this._hasCompleteBorder()) {
      this.ui.showToast('CLOSE THE OUTER BORDER', true);
      return;
    }
    RoomStore.saveRoom(this.roomData);
    this.transitioning = true;
    const gameShape = RoomStore.toGame(this.roomData);
    this.scene.start('GameScene', { room: gameShape });
  }

  onBack() {
    if (this.transitioning) return;
    RoomStore.saveRoom(this.roomData);
    this.transitioning = true;
    this.scene.start('MenuScene');
  }

  onResize(axis, delta) {
    const W = this.roomData.tilesWide;
    const H = this.roomData.tilesTall;
    const newW = Phaser.Math.Clamp(axis === 'w' ? W + delta : W, MIN_ROOM_W, MAX_ROOM_W);
    const newH = Phaser.Math.Clamp(axis === 'h' ? H + delta : H, MIN_ROOM_H, MAX_ROOM_H);
    if (newW === W && newH === H) return;

    const newGrid = [];
    for (let r = 0; r < newH; r++) {
      const row = [];
      for (let c = 0; c < newW; c++) {
        if (r < H && c < W) row.push(this.roomData.grid[r][c]);
        else row.push('.');
      }
      newGrid.push(row);
    }
    for (let c = 0; c < newW; c++) {
      newGrid[0][c] = TILE.SOLID;
      newGrid[newH - 1][c] = TILE.SOLID;
    }
    for (let r = 0; r < newH; r++) {
      newGrid[r][0] = TILE.SOLID;
      newGrid[r][newW - 1] = TILE.SOLID;
    }
    this.roomData.tilesWide = newW;
    this.roomData.tilesTall = newH;
    this.roomData.grid = newGrid;
    this.roomData.walkers = (this.roomData.walkers || []).filter(
      (w) => w.col > 0 && w.col < newW - 1 && w.row > 0 && w.row < newH - 1);
    this.roomData.pickups = (this.roomData.pickups || []).filter(
      (p) => p.col > 0 && p.col < newW - 1 && p.row > 0 && p.row < newH - 1);
    this.roomData.doors = (this.roomData.doors || []).filter(
      (d) => d.col >= 0 && d.col < newW && d.row >= 0 && d.row < newH);
    if (!this.roomData.playerSpawn ||
        this.roomData.playerSpawn.col >= newW - 1 ||
        this.roomData.playerSpawn.row >= newH - 1) {
      this.roomData.playerSpawn = { col: 1, row: newH - 2 };
    }
    this.ui.setState({ size: [newW, newH] });
    this.gridDirty = true;
    this.refitZoomOnly();
    this.scheduleSave();
  }

  // --- persistence --------------------------------------------------------

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      RoomStore.saveRoom(this.roomData);
    }, 400);
  }

  // --- modals -------------------------------------------------------------

  showRoomsModal() {
    const builtins = RoomStore.listBuiltins();
    const userRooms = RoomStore.listUserRooms();

    const builtinRows = builtins.map((r) =>
      `<div class="ed-room-row">
        <div class="ed-room-label">${r.id}
          <span class="ed-room-meta">${r.tilesWide}x${r.tilesTall}</span></div>
        <button class="ed-btn sm" data-copy="${r.id}">COPY</button>
      </div>`
    ).join('');

    const userRows = userRooms.length === 0
      ? `<div class="ed-room-row"><div class="ed-room-label" style="color:#888">No rooms yet</div></div>`
      : userRooms.map((r) =>
        `<div class="ed-room-row">
          <div class="ed-room-label">${r.id}
            <span class="ed-room-meta">${r.tilesWide}x${r.tilesTall}</span></div>
          <button class="ed-btn sm" data-open="${r.id}">OPEN</button>
          <button class="ed-btn sm" data-dup="${r.id}">DUP</button>
        </div>`
      ).join('');

    const body = `
      <div class="ed-section-title">Built-in (read-only)</div>
      ${builtinRows}
      <div class="ed-section-title">Your rooms</div>
      ${userRows}
    `;

    this.ui.showModal({
      title: 'ROOMS',
      bodyHtml: body,
      buttons: [{ label: 'CLOSE', onClick: () => this.ui.hideModal() }]
    });

    this.ui.modalEl.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openRoom(btn.dataset.open);
        this.ui.hideModal();
      });
    });
    this.ui.modalEl.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dup = RoomStore.duplicateRoom(btn.dataset.copy);
        if (!dup) { this.ui.showToast('COPY FAILED', true); return; }
        RoomStore.saveRoom(dup);
        this.openRoom(dup.id);
        this.ui.hideModal();
      });
    });
    this.ui.modalEl.querySelectorAll('[data-dup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dup = RoomStore.duplicateRoom(btn.dataset.dup);
        if (!dup) { this.ui.showToast('DUP FAILED', true); return; }
        RoomStore.saveRoom(dup);
        this.openRoom(dup.id);
        this.ui.hideModal();
      });
    });
  }

  openRoom(id) {
    const working = RoomStore.getWorkingById(id);
    if (!working) { this.ui.showToast('ROOM NOT FOUND', true); return; }
    this.roomData = working;
    this.multiPlaceConfig = null;
    RoomStore.setLastId(id);
    this.ui.setState({
      roomName: this.roomData.id,
      size: [this.roomData.tilesWide, this.roomData.tilesTall]
    });
    this.gridDirty = true;
    this.fitRoom();
  }

  showNewRoomModal() {
    const body = `
      <div class="ed-form">
        <label>Width <input type="text" inputmode="numeric" pattern="[0-9]*" id="ed-new-w" value="${DEFAULT_NEW_W}"></label>
        <label>Height <input type="text" inputmode="numeric" pattern="[0-9]*" id="ed-new-h" value="${DEFAULT_NEW_H}"></label>
      </div>
    `;
    this.ui.showModal({
      title: 'NEW ROOM',
      bodyHtml: body,
      buttons: [
        { label: 'CANCEL', onClick: () => this.ui.hideModal() },
        { label: 'CREATE', primary: true, onClick: (el) => {
          const w = parseInt(el.querySelector('#ed-new-w').value, 10);
          const h = parseInt(el.querySelector('#ed-new-h').value, 10);
          if (isNaN(w) || isNaN(h) || w < MIN_ROOM_W || w > MAX_ROOM_W ||
              h < MIN_ROOM_H || h > MAX_ROOM_H) {
            this.ui.showToast(`SIZE ${MIN_ROOM_W}-${MAX_ROOM_W} x ${MIN_ROOM_H}-${MAX_ROOM_H}`, true);
            return;
          }
          const room = RoomStore.createBlank(w, h);
          RoomStore.saveRoom(room);
          this.openRoom(room.id);
          this.ui.hideModal();
        }}
      ]
    });
  }

  showDuplicateCurrentModal() {
    const body = `<div class="ed-warn">Duplicate "${this.roomData.id}"?</div>`;
    this.ui.showModal({
      title: 'DUPLICATE',
      bodyHtml: body,
      buttons: [
        { label: 'CANCEL', onClick: () => this.ui.hideModal() },
        { label: 'DUPLICATE', primary: true, onClick: () => {
          const dup = RoomStore.duplicateRoom(this.roomData.id);
          if (!dup) { this.ui.showToast('DUP FAILED', true); return; }
          RoomStore.saveRoom(dup);
          this.openRoom(dup.id);
          this.ui.hideModal();
        }}
      ]
    });
  }

  showRenameModal() {
    const body = `
      <div class="ed-form">
        <label>Name <input type="text" id="ed-rename" value="${this.roomData.id}" maxlength="48"></label>
      </div>
    `;
    this.ui.showModal({
      title: 'RENAME ROOM',
      bodyHtml: body,
      buttons: [
        { label: 'CANCEL', onClick: () => this.ui.hideModal() },
        { label: 'SAVE', primary: true, onClick: (el) => {
          const raw = (el.querySelector('#ed-rename').value || '').trim();
          // Sanitize: keep only [A-Za-z0-9_], replace spaces with _.
          const clean = raw.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
          if (clean.length < 2) { this.ui.showToast('NAME TOO SHORT', true); return; }
          if (clean === this.roomData.id) { this.ui.hideModal(); return; }
          // Room ids must stay unique within the local store.
          const existing = RoomStore.listUserRooms().some((r) => r.id === clean);
          if (existing) { this.ui.showToast('NAME IN USE', true); return; }
          const oldId = this.roomData.id;
          const newId = clean.startsWith('user_') ? clean : 'user_' + clean;
          // Copy under new id, remove old.
          const copy = RoomStore.toWorking(RoomStore.toGame(this.roomData));
          copy.id = newId;
          RoomStore.saveRoom(copy);
          RoomStore.deleteRoom(oldId);
          this.roomData = copy;
          RoomStore.setLastId(newId);
          this.ui.setState({ roomName: newId });
          this.ui.hideModal();
        }}
      ]
    });
  }

  showDeleteModal() {
    const body = `<div class="ed-warn">Delete "${this.roomData.id}"? This cannot be undone.</div>`;
    this.ui.showModal({
      title: 'DELETE ROOM?',
      bodyHtml: body,
      buttons: [
        { label: 'CANCEL', onClick: () => this.ui.hideModal() },
        { label: 'DELETE', danger: true, onClick: () => {
          RoomStore.deleteRoom(this.roomData.id);
          this.ui.hideModal();
          const remaining = RoomStore.listUserRooms();
          if (remaining.length > 0) {
            this.openRoom(remaining[0].id);
          } else {
            const blank = RoomStore.createBlank(DEFAULT_NEW_W, DEFAULT_NEW_H);
            RoomStore.saveRoom(blank);
            this.openRoom(blank.id);
          }
        }}
      ]
    });
  }

  showExportModal() {
    const json = RoomStore.toExportJson(this.roomData);
    const body = `
      <div class="ed-warn" style="margin-bottom:8px">
        Paste into src/data/rooms.js as a new entry, or send to yourself.
      </div>
      <textarea class="ed-textarea" readonly id="ed-export">${json.replace(/</g, '&lt;')}</textarea>
    `;
    this.ui.showModal({
      title: 'EXPORT JSON',
      bodyHtml: body,
      buttons: [
        { label: 'CLOSE', onClick: () => this.ui.hideModal() },
        { label: 'COPY', primary: true, onClick: (el) => {
          const ta = el.querySelector('#ed-export');
          if (ta) { ta.select(); ta.setSelectionRange(0, 99999); }
          try {
            if (navigator.clipboard) navigator.clipboard.writeText(json);
            else document.execCommand('copy');
            this.ui.showToast('COPIED');
          } catch (e) {
            this.ui.showToast('COPY FAILED', true);
          }
        }}
      ]
    });
  }

  // --- paint / pan --------------------------------------------------------

  _setupGridInput() {
    this.input.on('pointerdown', (p) => {
      if (this.transitioning || this.ui.isModalOpen()) return;
      // Ignore taps inside the HTML bars (canvas coords may briefly overlap
      // the bar edge during rounding).
      if (p.y < this.viewportTop) return;
      if (this.activePointerId !== null) return;
      this.activePointerId = p.id;
      if (this.tool === 'pan') {
        this.dragMode = 'pan';
        this._panStartScrollX = this.cameras.main.scrollX;
        this._panStartScrollY = this.cameras.main.scrollY;
        this._panStartPx = p.x;
        this._panStartPy = p.y;
      } else {
        this.dragMode = 'paint';
        this._paintAt(p);
      }
    });

    this.input.on('pointermove', (p) => {
      if (p.id !== this.activePointerId) return;
      if (this.dragMode === 'pan') {
        const cam = this.cameras.main;
        cam.scrollX = this._panStartScrollX - (p.x - this._panStartPx) / cam.zoom;
        cam.scrollY = this._panStartScrollY - (p.y - this._panStartPy) / cam.zoom;
      } else if (this.dragMode === 'paint') {
        this._paintAt(p);
      }
    });

    const end = (p) => {
      if (p.id !== this.activePointerId) return;
      this.activePointerId = null;
      this.dragMode = null;
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);

    // Belt-and-suspenders: window blur resets stuck drag state.
    this._onWindowBlur = () => {
      this.activePointerId = null;
      this.dragMode = null;
    };
    window.addEventListener('blur', this._onWindowBlur);
    window.addEventListener('pointercancel', this._onWindowBlur);
    this.events.once('shutdown', () => {
      window.removeEventListener('blur', this._onWindowBlur);
      window.removeEventListener('pointercancel', this._onWindowBlur);
    });
  }

  _paintAt(pointer) {
    const cam = this.cameras.main;
    const wp = cam.getWorldPoint(pointer.x, pointer.y);
    const ts = this.roomData.tileSize;
    const col = Math.floor(wp.x / ts);
    const row = Math.floor(wp.y / ts);
    if (col < 0 || col >= this.roomData.tilesWide) return;
    if (row < 0 || row >= this.roomData.tilesTall) return;

    const tool = this.tool;
    if (tool === 'solid' || tool === 'oneway' || tool === 'erase') {
      const val = tool === 'solid' ? TILE.SOLID
                : tool === 'oneway' ? TILE.ONEWAY
                : TILE.EMPTY;
      if (this.roomData.grid[row][col] === val) return;
      this.roomData.grid[row][col] = val;
      // Erase (tile only) deliberately does NOT touch entities. Doors,
      // walkers and pickups have their own tools for removal.
      this.gridDirty = true;
      this.scheduleSave();
    } else if (tool === 'multi-erase') {
      this._applyMultiErase(col, row);
    } else if (tool === 'player') {
      this.roomData.playerSpawn = { col, row };
      this.gridDirty = true;
      this.scheduleSave();
    } else if (tool === 'walker') {
      const idx = (this.roomData.walkers || []).findIndex(
        (w) => w.col === col && w.row === row);
      if (idx >= 0) {
        this.roomData.walkers.splice(idx, 1);
        this.ui.showToast('WALKER REMOVED');
      } else {
        this.roomData.walkers = this.roomData.walkers || [];
        this.roomData.walkers.push({ col, row });
      }
      this.gridDirty = true;
      this.scheduleSave();
    } else if (tool === 'pickup') {
      this._openPickupModal(col, row);
    } else if (tool === 'door') {
      this._openDoorModal(col, row);
    } else if (tool === 'multi-place') {
      if (!this.multiPlaceConfig) {
        this._openMultiPlaceModal(col, row);
      } else {
        this._applyMultiPlace(col, row);
        this.gridDirty = true;
        this.scheduleSave();
      }
    }
  }

  _applyMultiErase(col, row) {
    let changed = false;
    if (this.roomData.grid[row][col] !== TILE.EMPTY) {
      this.roomData.grid[row][col] = TILE.EMPTY;
      changed = true;
    }
    const wBefore = (this.roomData.walkers || []).length;
    this.roomData.walkers = (this.roomData.walkers || []).filter(
      (w) => !(w.col === col && w.row === row));
    if (this.roomData.walkers.length !== wBefore) changed = true;
    const pBefore = (this.roomData.pickups || []).length;
    this.roomData.pickups = (this.roomData.pickups || []).filter(
      (p) => !(p.col === col && p.row === row));
    if (this.roomData.pickups.length !== pBefore) changed = true;
    const dBefore = (this.roomData.doors || []).length;
    this.roomData.doors = (this.roomData.doors || []).filter(
      (d) => !(d.col === col && d.row === row));
    if (this.roomData.doors.length !== dBefore) changed = true;
    if (changed) {
      this.gridDirty = true;
      this.scheduleSave();
    }
  }

  _applyMultiPlace(col, row) {
    const cfg = this.multiPlaceConfig;
    if (!cfg) return;
    if (cfg.tile === 'solid')       this.roomData.grid[row][col] = TILE.SOLID;
    else if (cfg.tile === 'oneway') this.roomData.grid[row][col] = TILE.ONEWAY;
    if (cfg.playerSpawn) this.roomData.playerSpawn = { col, row };
    if (cfg.walker) {
      const exists = (this.roomData.walkers || []).some(
        (w) => w.col === col && w.row === row);
      if (!exists) {
        this.roomData.walkers = this.roomData.walkers || [];
        this.roomData.walkers.push({ col, row });
      }
    }
    if (cfg.pickup) {
      this.roomData.pickups = (this.roomData.pickups || []).filter(
        (p) => !(p.col === col && p.row === row));
      const entry = { col, row, kind: cfg.pickup.kind };
      if (cfg.pickup.kind === 'weapon') entry.weaponId = cfg.pickup.weaponId;
      this.roomData.pickups.push(entry);
    }
    if (cfg.door) {
      this.roomData.doors = (this.roomData.doors || []).filter(
        (d) => !(d.col === col && d.row === row));
      const door = { col, row, side: cfg.door.side, to: cfg.door.to };
      if (cfg.door.entry) door.entry = cfg.door.entry;
      this.roomData.doors.push(door);
    }
  }

  _openMultiPlaceModal(firstCol, firstRow) {
    this.activePointerId = null;
    this.dragMode = null;
    const cfg = this.multiPlaceConfig || {
      tile: 'none', playerSpawn: false, walker: false, pickup: null, door: null
    };
    const weapons = Object.values(WEAPONS);
    const weaponOpts = weapons.map((w) =>
      `<option value="${w.id}">${w.name}</option>`).join('');
    const allRooms = RoomStore.listBuiltins().concat(RoomStore.listUserRooms());
    const roomOpts = allRooms.map((r) =>
      `<option value="${r.id}">${r.id}</option>`).join('');

    const body = `
      <div class="ed-form">
        <label>Tile
          <select id="mp-tile">
            <option value="none"${cfg.tile === 'none' ? ' selected' : ''}>None (leave tile)</option>
            <option value="solid"${cfg.tile === 'solid' ? ' selected' : ''}>Solid</option>
            <option value="oneway"${cfg.tile === 'oneway' ? ' selected' : ''}>One-way</option>
          </select>
        </label>
        <label><input type="checkbox" id="mp-player"${cfg.playerSpawn ? ' checked' : ''}> Player spawn</label>
        <label><input type="checkbox" id="mp-walker"${cfg.walker ? ' checked' : ''}> Walker</label>
        <label><input type="checkbox" id="mp-pickup"${cfg.pickup ? ' checked' : ''}> Pickup</label>
        <div id="mp-pickup-sub" style="padding-left:24px;display:${cfg.pickup ? '' : 'none'}">
          <label>Kind
            <select id="mp-pick-kind">
              <option value="weapon"${cfg.pickup && cfg.pickup.kind === 'weapon' ? ' selected' : ''}>Weapon</option>
              <option value="ammo"${cfg.pickup && cfg.pickup.kind === 'ammo' ? ' selected' : ''}>Ammo</option>
            </select>
          </label>
          <label id="mp-pick-weapon-row">Weapon
            <select id="mp-pick-weapon">${weaponOpts}</select>
          </label>
        </div>
        <label><input type="checkbox" id="mp-door"${cfg.door ? ' checked' : ''}> Door</label>
        <div id="mp-door-sub" style="padding-left:24px;display:${cfg.door ? '' : 'none'}">
          <label>To room
            <select id="mp-door-to">${roomOpts}</select>
          </label>
          <label>Side
            <select id="mp-door-side">
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </label>
        </div>
      </div>
    `;

    const buttons = [
      { label: 'CANCEL', onClick: () => this.ui.hideModal() },
      { label: 'APPLY', primary: true, onClick: (el) => {
        const tile = el.querySelector('#mp-tile').value;
        const playerSpawn = el.querySelector('#mp-player').checked;
        const walker = el.querySelector('#mp-walker').checked;
        const pickupChecked = el.querySelector('#mp-pickup').checked;
        const doorChecked = el.querySelector('#mp-door').checked;
        let pickup = null;
        if (pickupChecked) {
          pickup = {
            kind: el.querySelector('#mp-pick-kind').value,
            weaponId: el.querySelector('#mp-pick-weapon').value
          };
        }
        let door = null;
        if (doorChecked) {
          door = {
            to: el.querySelector('#mp-door-to').value,
            side: el.querySelector('#mp-door-side').value
          };
        }
        this.multiPlaceConfig = { tile, playerSpawn, walker, pickup, door };
        this._applyMultiPlace(firstCol, firstRow);
        this.gridDirty = true;
        this.scheduleSave();
        this.ui.hideModal();
        this.ui.showToast('STAMP READY - tap to place');
      }}
    ];

    this.ui.showModal({ title: 'MULTI-PLACE STAMP', bodyHtml: body, buttons });

    const pickCb = this.ui.modalEl.querySelector('#mp-pickup');
    const pickSub = this.ui.modalEl.querySelector('#mp-pickup-sub');
    if (pickCb && pickSub) {
      pickCb.addEventListener('change', () => {
        pickSub.style.display = pickCb.checked ? '' : 'none';
      });
    }
    const doorCb = this.ui.modalEl.querySelector('#mp-door');
    const doorSub = this.ui.modalEl.querySelector('#mp-door-sub');
    if (doorCb && doorSub) {
      doorCb.addEventListener('change', () => {
        doorSub.style.display = doorCb.checked ? '' : 'none';
      });
    }
    const pickKindSel = this.ui.modalEl.querySelector('#mp-pick-kind');
    const pickWeaponRow = this.ui.modalEl.querySelector('#mp-pick-weapon-row');
    if (pickKindSel && pickWeaponRow) {
      const syncVis = () => {
        pickWeaponRow.style.display = pickKindSel.value === 'weapon' ? '' : 'none';
      };
      pickKindSel.addEventListener('change', syncVis);
      syncVis();
    }
  }

  // --- pickup / door modals -----------------------------------------------

  _openPickupModal(col, row) {
    this.activePointerId = null;
    this.dragMode = null;
    const existing = (this.roomData.pickups || []).find(
      (p) => p.col === col && p.row === row);
    const weapons = Object.values(WEAPONS);
    const weaponOpts = weapons.map((w) =>
      `<option value="${w.id}"${existing && existing.weaponId === w.id ? ' selected' : ''}>${w.name}</option>`
    ).join('');
    const kind = existing ? existing.kind : 'weapon';
    const body = `
      <div class="ed-form">
        <label>Kind
          <select id="ed-pick-kind">
            <option value="weapon"${kind === 'weapon' ? ' selected' : ''}>Weapon</option>
            <option value="ammo"${kind === 'ammo' ? ' selected' : ''}>Ammo</option>
          </select>
        </label>
        <label id="ed-pick-weapon-row">Weapon
          <select id="ed-pick-weapon">${weaponOpts}</select>
        </label>
      </div>
    `;
    const buttons = [
      { label: 'CANCEL', onClick: () => this.ui.hideModal() }
    ];
    if (existing) {
      buttons.push({ label: 'REMOVE', danger: true, onClick: () => {
        this.roomData.pickups = this.roomData.pickups.filter(
          (p) => !(p.col === col && p.row === row));
        this.gridDirty = true; this.scheduleSave();
        this.ui.hideModal();
      }});
    }
    buttons.push({ label: 'SAVE', primary: true, onClick: (el) => {
      const k = el.querySelector('#ed-pick-kind').value;
      const weaponId = el.querySelector('#ed-pick-weapon').value;
      this.roomData.pickups = this.roomData.pickups.filter(
        (p) => !(p.col === col && p.row === row));
      const entry = { col, row, kind: k };
      if (k === 'weapon') entry.weaponId = weaponId;
      this.roomData.pickups.push(entry);
      this.gridDirty = true; this.scheduleSave();
      this.ui.hideModal();
    }});
    this.ui.showModal({ title: 'PICKUP', bodyHtml: body, buttons });

    // Ammo pickups refill ALL ranged weapons, so the weapon dropdown is
    // meaningless when kind === 'ammo'. Hide it in that case.
    const kindSel = this.ui.modalEl.querySelector('#ed-pick-kind');
    const weaponRow = this.ui.modalEl.querySelector('#ed-pick-weapon-row');
    if (kindSel && weaponRow) {
      const syncVisibility = () => {
        weaponRow.style.display = (kindSel.value === 'weapon') ? '' : 'none';
      };
      kindSel.addEventListener('change', syncVisibility);
      syncVisibility();
    }
  }

  _openDoorModal(col, row) {
    this.activePointerId = null;
    this.dragMode = null;
    const existing = (this.roomData.doors || []).find(
      (d) => d.col === col && d.row === row);
    const allRooms = RoomStore.listBuiltins().concat(RoomStore.listUserRooms());
    // Offer self-destination too (loops) but not required.
    const roomOpts = allRooms.map((r) =>
      `<option value="${r.id}"${existing && existing.to === r.id ? ' selected' : ''}>${r.id}</option>`
    ).join('');
    const side = existing ? existing.side : 'right';
    const entry = existing ? (existing.entry || 'auto') : 'auto';
    const entryVal = (typeof entry === 'string') ? entry : 'auto';
    const body = `
      <div class="ed-form">
        <label>To room
          <select id="ed-door-to">${roomOpts}</select>
        </label>
        <label>Side
          <select id="ed-door-side">
            <option value="left"${side === 'left' ? ' selected' : ''}>Left</option>
            <option value="right"${side === 'right' ? ' selected' : ''}>Right</option>
          </select>
        </label>
        <label>Entry
          <select id="ed-door-entry">
            <option value="auto"${entryVal === 'auto' ? ' selected' : ''}>Auto (dest spawn)</option>
            <option value="fromLeft"${entryVal === 'fromLeft' ? ' selected' : ''}>fromLeft</option>
            <option value="fromRight"${entryVal === 'fromRight' ? ' selected' : ''}>fromRight</option>
          </select>
        </label>
      </div>
    `;
    const buttons = [
      { label: 'CANCEL', onClick: () => this.ui.hideModal() }
    ];
    if (existing) {
      buttons.push({ label: 'REMOVE', danger: true, onClick: () => {
        this.roomData.doors = this.roomData.doors.filter(
          (d) => !(d.col === col && d.row === row));
        this.gridDirty = true; this.scheduleSave();
        this.ui.hideModal();
      }});
    }
    buttons.push({ label: 'SAVE', primary: true, onClick: (el) => {
      const to = el.querySelector('#ed-door-to').value;
      const s = el.querySelector('#ed-door-side').value;
      const e = el.querySelector('#ed-door-entry').value;
      this.roomData.doors = this.roomData.doors.filter(
        (d) => !(d.col === col && d.row === row));
      const entryVal = (e === 'auto') ? undefined : e;
      const door = { col, row, side: s, to };
      if (entryVal) door.entry = entryVal;
      this.roomData.doors.push(door);
      this.gridDirty = true; this.scheduleSave();
      this.ui.hideModal();
    }});
    this.ui.showModal({ title: 'DOOR', bodyHtml: body, buttons });
  }

  // --- validation ---------------------------------------------------------

  _hasCompleteBorder() {
    const W = this.roomData.tilesWide;
    const H = this.roomData.tilesTall;
    for (let c = 0; c < W; c++) {
      if (this.roomData.grid[0][c] !== TILE.SOLID) return false;
      if (this.roomData.grid[H - 1][c] !== TILE.SOLID) return false;
    }
    for (let r = 0; r < H; r++) {
      if (this.roomData.grid[r][0] !== TILE.SOLID) return false;
      if (this.roomData.grid[r][W - 1] !== TILE.SOLID) return false;
    }
    return true;
  }

  // --- rendering ----------------------------------------------------------

  rebuildRoomTexture() {
    const ts = this.roomData.tileSize;
    const W = this.roomData.tilesWide;
    const H = this.roomData.tilesTall;
    const pxW = W * ts;
    const pxH = H * ts;

    if (!this.roomRT || this.roomRT.width !== pxW || this.roomRT.height !== pxH) {
      if (this.roomRT) this.roomRT.destroy();
      this.roomRT = this.add.renderTexture(0, 0, pxW, pxH);
      this.roomRT.setOrigin(0, 0);
      this.roomRT.setDepth(0);
    }
    this.roomRT.clear();

    const g = this.make.graphics({ add: false });

    // Solid tiles
    g.fillStyle(COLOR_SOLID_TILE, 1);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (this.roomData.grid[r][c] === TILE.SOLID) {
          g.fillRect(c * ts, r * ts, ts, ts);
        }
      }
    }
    // One-way tiles
    g.fillStyle(COLOR_ONEWAY_TILE, 1);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (this.roomData.grid[r][c] === TILE.ONEWAY) {
          g.fillRect(c * ts, r * ts, ts, ts);
        }
      }
    }
    // Grid lines
    g.lineStyle(1, COLOR_GRID_LINE, COLOR_GRID_LINE_ALPHA);
    for (let c = 0; c <= W; c++) {
      g.beginPath(); g.moveTo(c * ts, 0); g.lineTo(c * ts, pxH); g.strokePath();
    }
    for (let r = 0; r <= H; r++) {
      g.beginPath(); g.moveTo(0, r * ts); g.lineTo(pxW, r * ts); g.strokePath();
    }
    // Pickup markers
    g.fillStyle(COLOR_PICKUP_MARK, 1);
    for (const p of (this.roomData.pickups || [])) {
      g.fillRect(p.col * ts + ts * 0.28, p.row * ts + ts * 0.28, ts * 0.44, ts * 0.44);
    }
    // Door markers
    g.fillStyle(COLOR_DOOR_MARK, 0.9);
    for (const d of (this.roomData.doors || [])) {
      g.fillRect(
        d.col * ts + (ts - DOOR_W) / 2,
        d.row * ts - DOOR_H,
        DOOR_W, DOOR_H
      );
    }
    // Walker markers
    g.fillStyle(COLOR_WALKER_MARK, 1);
    for (const w of (this.roomData.walkers || [])) {
      g.fillCircle(w.col * ts + ts / 2, w.row * ts + ts / 2, ts * 0.35);
    }
    // Player spawn marker
    if (this.roomData.playerSpawn) {
      const ps = this.roomData.playerSpawn;
      g.fillStyle(COLOR_PLAYER_MARK, 1);
      g.fillCircle(ps.col * ts + ts / 2, ps.row * ts + ts / 2, ts * 0.42);
    }

    this.roomRT.draw(g);
    g.destroy();
  }
}
