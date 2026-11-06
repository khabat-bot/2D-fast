// Enemy definitions. Data only - no logic. Enemy subclasses read these.
//
// Adding an enemy = one entry here plus a subclass under src/entities/
// enemies/. The subclass handles behavior (patrol, fly, shoot); this file
// handles stats and shape.
//
// Fields:
//   id, name        identity
//   hp              hit points
//   speed           px/s for movement (walkers patrol at this)
//   width, height   hitbox, separate from any future sprite size
//   color           placeholder tint
export const ENEMIES = {
  walker: {
    id: 'walker',
    name: 'Walker',
    hp: 30,
    speed: 40,
    width: 20,
    height: 20,
    color: 0xe53935,
    contactDamage: 10
  }
};
