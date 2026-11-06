// localStorage-backed room store. User rooms live here; built-in rooms
// from src/data/rooms.js stay read-only templates that can be copied.
//
// Storage format (game-shape rooms, grid as string[]):
//   {
//     rooms: { [id]: room },
//     lastId: "user_1699_abc"
//   }
import { ROOMS } from '../data/rooms.js';
import { TILE_SIZE } from '../config/roomConfig.js';
import { TILE, charToTile, tileToChar } from '../data/tiles.js';

const KEY = '2dfast.rooms.v1';

function newId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { rooms: {}, lastId: null };
    const parsed = JSON.parse(raw);
    return {
      rooms: parsed.rooms || {},
      lastId: parsed.lastId || null
    };
  } catch (e) {
    console.warn('[RoomStore] load failed:', e);
    return { rooms: {}, lastId: null };
  }
}

function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[RoomStore] save failed:', e);
  }
}

// --- working/game shape conversion -------------------------------------
// Working: grid as string[][] (cheap cell mutation).
// Game:    grid as string[]  (matches rooms.js, compact in storage).

export function toWorking(gameRoom) {
  // Working grid is number[][] (TILE constants). Accepts digit strings
  // OR legacy '#'/'='/'.' strings so pre-migration rooms load cleanly.
  return {
    id: gameRoom.id,
    tilesWide: gameRoom.tilesWide,
    tilesTall: gameRoom.tilesTall,
    tileSize: gameRoom.tileSize || TILE_SIZE,
    grid: (gameRoom.grid || []).map((row) => {
      if (Array.isArray(row)) return row.slice();
      const cells = [];
      for (let i = 0; i < row.length; i++) cells.push(charToTile(row[i]));
      return cells;
    }),
    playerSpawn: gameRoom.playerSpawn ? { ...gameRoom.playerSpawn } : null,
    walkers: (gameRoom.walkers || []).map((w) => ({ ...w })),
    pickups: (gameRoom.pickups || []).map((p) => ({ ...p })),
    doors: (gameRoom.doors || []).map((d) => ({ ...d }))
  };
}

export function toGame(workingRoom) {
  // Number grid -> digit strings for storage / rooms.js compatibility.
  return {
    id: workingRoom.id,
    tilesWide: workingRoom.tilesWide,
    tilesTall: workingRoom.tilesTall,
    tileSize: workingRoom.tileSize,
    grid: workingRoom.grid.map((row) => row.map(tileToChar).join('')),
    playerSpawn: workingRoom.playerSpawn ? { ...workingRoom.playerSpawn } : null,
    walkers: (workingRoom.walkers || []).map((w) => ({ ...w })),
    pickups: (workingRoom.pickups || []).map((p) => ({ ...p })),
    doors: (workingRoom.doors || []).map((d) => ({ ...d }))
  };
}

// --- CRUD --------------------------------------------------------------

export function listBuiltins() {
  return Object.keys(ROOMS).map((id) => ({
    id,
    name: ROOMS[id].id || id,
    tilesWide: ROOMS[id].tilesWide,
    tilesTall: ROOMS[id].tilesTall
  }));
}

export function listUserRooms() {
  const store = load();
  return Object.values(store.rooms).map((room) => ({
    id: room.id,
    tilesWide: room.tilesWide,
    tilesTall: room.tilesTall
  }));
}

export function getWorkingById(id) {
  if (ROOMS[id]) return toWorking(ROOMS[id]);
  const store = load();
  if (store.rooms[id]) return toWorking(store.rooms[id]);
  return null;
}

export function saveRoom(workingRoom) {
  const store = load();
  store.rooms[workingRoom.id] = toGame(workingRoom);
  store.lastId = workingRoom.id;
  save(store);
}

export function setLastId(id) {
  const store = load();
  store.lastId = id;
  save(store);
}

export function deleteRoom(id) {
  const store = load();
  if (!store.rooms[id]) return false;
  delete store.rooms[id];
  if (store.lastId === id) store.lastId = null;
  save(store);
  return true;
}

export function createBlank(w, h) {
  const grid = [];
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) {
      const onBorder = r === 0 || r === h - 1 || c === 0 || c === w - 1;
      row.push(onBorder ? TILE.SOLID : TILE.EMPTY);
    }
    grid.push(row);
  }
  return {
    id: newId(),
    tilesWide: w,
    tilesTall: h,
    tileSize: TILE_SIZE,
    grid,
    playerSpawn: { col: 1, row: h - 2 },
    walkers: [],
    pickups: [],
    doors: []
  };
}

export function duplicateRoom(sourceId) {
  const source = getWorkingById(sourceId);
  if (!source) return null;
  source.id = newId();
  // If the source had a door pointing to itself, drop it.
  source.doors = source.doors.filter((d) => d.to !== sourceId);
  return source;
}

// Ensure at least one user room exists (seeds from test_room on first open).
export function ensureSeedRoom() {
  const store = load();
  if (Object.keys(store.rooms).length > 0) return store;
  const seedSrc = ROOMS.test_room;
  if (!seedSrc) return store;
  const seed = toWorking(seedSrc);
  seed.id = newId();
  store.rooms[seed.id] = toGame(seed);
  store.lastId = seed.id;
  save(store);
  return store;
}

export function toExportJson(workingRoom) {
  const game = toGame(workingRoom);
  // Strip the runtime id key so it matches the shape users paste into
  // src/data/rooms.js. `id` field is kept inside the object.
  return JSON.stringify(game, null, 2);
}
