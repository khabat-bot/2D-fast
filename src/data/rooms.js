// Room templates. Each entry is a hand-authored room in a text grid.
//
// Grid characters:
//   '#'  solid tile (all sides collide)
//   '='  one-way platform (only collides from above while falling)
//   '.'  empty
//
// Coordinates below are in room-local pixels (tile cols/rows * tileSize),
// measured from the top-left tile. The loader adds the room offset.
//
// playerSpawn is the FEET position (player sprite bottom). The loader
// returns this as-is; the caller converts to sprite-center Y.
//
// walkerSpawns are sprite centers. Walkers do not do tile collision yet
// (their patrol logic has not been updated), so their positions must be on
// the floor manually - which is fine for a hand-authored test room.
//
// The Tiled JSON import path in PROJECT_STRUCTURE.md ("assets/rooms/"
// Tiled JSON room templates") is a later step. Hand-authored JS keeps the
// room templates in data/, which is where all game data lives per AGENT.md.
export const ROOMS = {
  test_room: {
    id: 'test_room',
    tilesWide: 24,
    tilesTall: 11,
    tileSize: 16,
    grid: [
      '########################',
      '#......................#',
      '#......................#',
      '#....===........===....#',
      '#......................#',
      '#..........===.........#',
      '#......................#',
      '#...........=..........#',
      '#......................#',
      '#......................#',
      '########################'
    ],
    // Feet position, room-local pixels. Floor row 10 top = 160.
    playerSpawn: { x: 40, y: 160 },
    // Sprite centers. Bottom of walker touches floor (160).
    walkerSpawns: [
      { x: 120, y: 150 },
      { x: 280, y: 150 }
    ]
  }
};

export const DEFAULT_ROOM = 'test_room';
