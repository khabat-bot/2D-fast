// Room templates. Each entry is a hand-authored room in a text grid.
//
// Grid characters:
//   '#'  solid tile (all sides collide)
//   '='  one-way platform (only collides from above while falling)
//   '.'  empty
//
// Coordinates are room-local pixels from the top-left tile. The loader adds
// the room offset, so playerSpawn / walkerSpawns / pickupSpawns are all
// relative to the room's own origin.
//
// test_room: 40x16 tiles = 640x256. Bigger than the 390x180 viewport so the
// camera has range both horizontally (250px pan) and vertically (76px pan).
// Platform layout gives the player vertical exploration to test the camera.
export const ROOMS = {
  test_room: {
    id: 'test_room',
    tilesWide: 40,
    tilesTall: 16,
    tileSize: 16,
    grid: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.........===..............===.........#',
      '#......................................#',
      '#......................................#',
      '#..............===........===..........#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#...................===................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '########################################'
    ],
    // Room-local feet position. Floor top = row 15 * 16 = 240.
    playerSpawn: { x: 40, y: 240 },
    // Sprite centers. Walker height 20, floor top 240 -> center 230.
    walkerSpawns: [
      { x: 150, y: 230 },
      { x: 350, y: 230 },
      { x: 500, y: 230 }
    ],
    // Pickup world positions, room-local. Sprite centers:
    //   weapon 14x14 -> floor top - 7
    //   ammo   12x12 -> floor top - 6
    pickupSpawns: [
      { type: 'weapon', weaponId: 'shotgun', x: 200, y: 233 },
      { type: 'ammo',                       x: 350, y: 234 },
      { type: 'weapon', weaponId: 'sniper',  x: 520, y: 233 }
    ]
  }
};

export const DEFAULT_ROOM = 'test_room';
