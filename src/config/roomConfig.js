// Room layout constants. Tile size is a gameplay value: changing it scales
// the whole level grid and all tile collision math. Must stay integer so
// pixel art stays crisp.
export const TILE_SIZE = 16;
// Door block size. Doors are the only room transition mechanism.
// Width 16 = one tile. Height 32 = two tiles (matches the player).
// Designers place doors at any position in room-local pixels.
export const DOOR_W = 16;
export const DOOR_H = 32;
