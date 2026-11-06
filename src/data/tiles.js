// Tile cell values. Single source of truth.
//
// Tilemaps are stored as digit strings in data files ('1' solid, '2'
// one-way, '0' empty) so rooms.js stays readable but has no symbolic
// magic. All runtime comparisons use these constants.
export const TILE = Object.freeze({
  EMPTY:  0,
  SOLID:  1,
  ONEWAY: 2
});

// Digit char -> TILE constant. Accepts legacy '#'/'='/'.' too so rooms
// authored before the numeric migration still load.
export function charToTile(ch) {
  if (ch === '1' || ch === '#') return TILE.SOLID;
  if (ch === '2' || ch === '=') return TILE.ONEWAY;
  return TILE.EMPTY;
}

// TILE constant -> digit char, for serialization.
export function tileToChar(v) {
  if (v === TILE.SOLID)  return '1';
  if (v === TILE.ONEWAY) return '2';
  return '0';
}
