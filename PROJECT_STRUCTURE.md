# PROJECT_STRUCTURE

Planned layout. Update this file whenever folders or files are added, moved or removed.

```
project-root/
├── AGENT.md                  # Rules for AI agents
├── TODO.md                   # Task list
├── PROJECT_STRUCTURE.md      # This file
├── .gitignore                # node_modules, dist, OS files
├── package.json
├── vite.config.js            # Dev server exposed on the local network
├── index.html                # Viewport meta, iOS meta tags, canvas mount
├── server/                   # Local multiplayer server (runs on the user's computer)
│   ├── server.js             # Serves game files + WebSocket connections
│   ├── GameServer.js         # Runs one game simulation per lobby (uses src/shared)
│   └── LobbyList.js          # Lobbies: name, max players, public/private, join code, start time, creator handover
├── public/
│   ├── manifest.webmanifest  # Add-to-Home-Screen
│   └── icons/                # App icons
├── assets/
│   ├── images/               # Pixel art PNGs and atlases (16x16 tile grid)
│   ├── rooms/                # Tiled JSON room templates and tilesets
│   ├── audio/                # Music and sound effects
│   ├── fonts/                # Bitmap fonts (BMFont .fnt + .png pairs)
│   └── ui/                   # Buttons, HUD graphics
└── src/
    ├── main.js               # Phaser game config and boot
    ├── config/
    │   ├── gameConfig.js     # Resolution, scale, physics settings
    │   ├── playerConfig.js   # Speeds, jump, wall jump values (dash values live in data/accessories.js)
    │   ├── controlsConfig.js # Touch layout defaults
    │   ├── pickupConfig.js   # Pickup collection distance
    │   └── runConfig.js      # Run length, difficulty scaling
    ├── shared/               # Plain JS game logic, no Phaser/DOM: runs on the server and in the phone's browser (solo, prediction)
    │   ├── Simulation.js     # Game loop, movement, collisions, enemies, rooms
    │   ├── Stats.js          # Per-player stats: kills, deaths, damage dealt, damage taken, rooms cleared, survive time
    │   └── protocol.js       # Message types between phone and server
    ├── scenes/
    │   ├── BootScene.js      # Load assets, audio unlock
    │   ├── MenuScene.js
    │   ├── SettingsScene.js  # Movement mode, aim mode, control layout, audio
    │   ├── LobbyScene.js     # Create a public/private lobby, join by code, lobby room (1 to 4 players)
    │   ├── LobbyBrowserScene.js # Public lobbies, with "in game" notice and run time
    │   ├── GameScene.js      # Main gameplay (current run)
    │   ├── UIScene.js        # HUD and touch controls (runs over GameScene)
    │   ├── InventoryScene.js # Equipment screen
    │   └── GameOverScene.js  # Results: each player's stats (kills, deaths, damage dealt, damage taken, rooms cleared, survive time), then back to the lobby
    ├── entities/
    │   ├── Player.js
    │   ├── Enemy.js          # Base class
    │   ├── enemies/          # Walker, Flyer, Shooter (different sizes)
    │   ├── Projectile.js
    │   └── Pickup.js
    ├── world/
    │   ├── RoomLoader.js     # Loads a room template into the scene
    │   ├── RoomGenerator.js  # Connects templates into a run (seeded)
    │   ├── RoomValidator.js  # Checks rooms are completable with player movement
    │   └── RunManager.js     # Start / track / end a run, room-clear lock, respawns on room change, ends when every player is dead
    ├── net/                  # Multiplayer client (the server runs the simulation)
    │   ├── NetworkManager.js # Connection, messages, shared run seed
    │   ├── LobbyClient.js    # Lobby list, create (public/private), join by code
    │   ├── InputSender.js    # Sends this phone's input to the server
    │   ├── Prediction.js     # Client-side prediction of the local player (shared movement code)
    │   └── RemotePlayer.js   # Interpolated remote players
    ├── systems/
    │   ├── TouchControls.js  # Movement modes (stick or left/right buttons), multi-touch handling
    │   ├── AimController.js  # 3 aim modes -> one aim direction + fire state
    │   ├── InputManager.js   # Maps touch/keyboard to game actions
    │   ├── WeaponSystem.js   # Firing, cooldowns, ammo
    │   ├── AccessorySystem.js# Applies stat modifiers
    │   ├── Pools.js          # Object pools
    │   ├── PlayerManager.js  # List of 1 to 4 players (no global player)
    │   ├── SettingsStore.js  # localStorage: settings and player name (no run saves)
    │   └── AudioManager.js
    ├── data/
    │   ├── weapons.js        # Weapon definitions
    │   ├── accessories.js    # Accessory definitions (including Dash, all values editable)
    │   ├── enemies.js        # Enemy definitions (each has its own size, hitbox, stats)
    │   └── rooms.js          # Room template list and metadata
    ├── ui/
    │   ├── HealthBar.js
    │   ├── Button.js         # Touch button component
    │   └── Joystick.js
    └── utils/
        ├── mobile.js         # Orientation, visibility, safe-area helpers
        ├── placeholders.js   # Solid-color rectangles for anything without art (sized to the hitbox)
        └── debug.js          # FPS overlay
```

## Responsibilities

- **scenes/**: flow of the game. `UIScene` runs in parallel with `GameScene` so HUD and controls are separate from gameplay.
- **entities/**: the phone-side visuals (sprites) of things in the world. Their logic lives in `shared/`.
- **shared/**: game logic that runs on the server and in the phone's browser (solo mode, prediction). No Phaser or browser code allowed here (same for `config/`, `data/`, `world/` and the logic systems).
- **world/**: everything about building and running a procedural run from room templates.
- **systems/**: logic that is not tied to one entity (input, aiming, weapons, accessories, pooling, settings).
- **data/**: pure data for items, enemies and rooms. Each entry can have an optional `color` used for the placeholder when there is no art. Adding a weapon or accessory should only need a data entry.
- **config/**: tunable numbers, separate from logic.
- **ui/**: reusable touch-friendly UI components.
- **net/**: multiplayer connection and remote players. Clients are trusted (no anti-cheat).
- **server/**: small Node.js server run locally by the user. Reached over local Wi-Fi or a Cloudflare Tunnel. It keeps the lobby list and runs each lobby's game; phones only send input and draw the state.

## Data flow

```
Touch/Keyboard -> InputManager -> actions -> Player / WeaponSystem
Touch -> AimController (mode from SettingsStore) -> aim direction + fire -> WeaponSystem
Accessories -> AccessorySystem -> stat modifiers -> Player / WeaponSystem
data/rooms.js + assets/rooms -> RoomGenerator -> RoomLoader -> GameScene
RunManager -> next-room exit unlocks when every enemy is dead; dead players respawn on room change; run ends when every player is dead, then stats are shown
Phones -> input -> server (GameServer + shared/Simulation) -> game state -> all phones (positions, projectiles, enemies, room state)
shared/Stats.js -> results screen (kills, deaths, damage dealt, damage taken, rooms cleared, survive time) -> back to the lobby
Solo: phone -> local shared/Simulation in the browser (no server)
Own movement: Prediction.js runs shared movement code locally, corrected by the server state
LobbyClient <-> server/LobbyList: public lobbies listed in the browser, private lobbies joined by code only
data/*.js -> systems and entities (definitions only, no logic)
```
