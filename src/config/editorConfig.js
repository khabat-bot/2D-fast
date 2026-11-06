// Editor config. Kept small on purpose - most UI is now HTML/CSS.
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2];

export const MIN_ROOM_W = 10;
export const MAX_ROOM_W = 200;
export const MIN_ROOM_H = 6;
export const MAX_ROOM_H = 100;

// Grid render colors (Phaser-side only).
export const COLOR_SOLID_TILE   = 0x5a5a5a;
export const COLOR_ONEWAY_TILE  = 0x8b6f47;
export const COLOR_GRID_LINE    = 0x1c1c1c;
export const COLOR_GRID_LINE_ALPHA = 0.7;
export const COLOR_PLAYER_MARK  = 0x44aaff;
export const COLOR_WALKER_MARK  = 0xe53935;
export const COLOR_PICKUP_MARK  = 0xffeb3b;
export const COLOR_DOOR_MARK    = 0x00cc66;
export const COLOR_BG           = 0x101018;

// Room size used when the user creates a blank room.
export const DEFAULT_NEW_W = 40;
export const DEFAULT_NEW_H = 16;
