// Room templates. Digit-string grids + tile-coord metadata.
//
// Grid tiles: '1' solid, '2' one-way, '0' empty.
//
// All positions below are in TILE coords (col, row), not pixels:
//   - `row` means "bottom edge of the entity on TOP of that tile row"
//   - `col` means the tile column; entity is centered on it
// The loader computes sprite centers from these + each entity's own
// height, so changing entity sizes or floor layout never breaks spawns.
//
// Doors are the ONLY room transition mechanism. Player walks INTO a door
// (AABB overlap) and transitions to the destination room.
//
// Door fields:
//   col, row  - position (see above); door is DOOR_W x DOOR_H, centered
//               on col, bottom on top of row
//   side      - 'left' or 'right' (metadata; used to resolve
//               entry: 'fromLeft'|'fromRight' from linked rooms)
//   to        - destination room id
//   entry     - where the player appears in the DESTINATION room:
//                 { col, row }  - explicit tile position
//                 'fromLeft'    - destination's left door, else playerSpawn
//                 'fromRight'   - destination's right door, else playerSpawn
//                 missing       - use the destination's playerSpawn
//
// All rooms 40x16 tiles = 640x256. Chains:
//   test_room -> room_a -> room_b, and back through the other door.
export const ROOMS = {
  test_room: {
    id: 'test_room',
    tilesWide: 40,
    tilesTall: 16,
    tileSize: 16,
    grid: [
      '1111111111111111111111111111111111111111',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000222000000000000002220000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000002220000000022200000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000022200000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1111111111111111111111111111111111111111'
    ],
    playerSpawn: { col: 2, row: 15 },
    walkers: [
      { col: 9,  row: 15 },
      { col: 22, row: 15 },
      { col: 31, row: 15 }
    ],
    pickups: [
      { col: 12, row: 15, kind: 'weapon', weaponId: 'shotgun' },
      { col: 22, row: 15, kind: 'ammo' },
      { col: 32, row: 15, kind: 'weapon', weaponId: 'sniper' }
    ],
    doors: [
      { col: 36, row: 15, side: 'right', to: 'room_a', entry: 'fromLeft' }
    ]
  },

  room_a: {
    id: 'room_a',
    tilesWide: 40,
    tilesTall: 16,
    tileSize: 16,
    grid: [
      '1111111111111111111111111111111111111111',
      '1000000000000000000000000000000000000001',
      '1000002220000000000000000000022200000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000022200000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000022200000000002220000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000002220000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1111111111111111111111111111111111111111'
    ],
    playerSpawn: { col: 2, row: 15 },
    walkers: [
      { col: 12, row: 15 },
      { col: 24, row: 15 },
      { col: 34, row: 15 }
    ],
    pickups: [
      { col: 15, row: 15, kind: 'weapon', weaponId: 'smg' },
      { col: 28, row: 15, kind: 'ammo' }
    ],
    doors: [
      { col: 2,  row: 15, side: 'left',  to: 'test_room', entry: 'fromRight' },
      { col: 36, row: 15, side: 'right', to: 'room_b',    entry: 'fromLeft' }
    ]
  },

  room_b: {
    id: 'room_b',
    tilesWide: 40,
    tilesTall: 16,
    tileSize: 16,
    grid: [
      '1111111111111111111111111111111111111111',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000022200000000000000000000000022200001',
      '1000000000000000000000000000000000000001',
      '1000000000000000002220000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000022200002220000222000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000022200000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1000000000000000000000000000000000000001',
      '1111111111111111111111111111111111111111'
    ],
    playerSpawn: { col: 2, row: 15 },
    walkers: [
      { col: 11, row: 15 },
      { col: 22, row: 15 },
      { col: 30, row: 15 },
      { col: 37, row: 15 }
    ],
    pickups: [
      { col: 18, row: 15, kind: 'weapon', weaponId: 'rocket' },
      { col: 34, row: 15, kind: 'ammo' }
    ],
    doors: [
      { col: 2, row: 15, side: 'left', to: 'room_a', entry: 'fromRight' }
    ]
  }
};

export const DEFAULT_ROOM = 'test_room';
