# AGENT.md

Instructions for any AI agent working on this project. Read this file, `TODO.md` and `PROJECT_STRUCTURE.md` before changing anything.

## Project

A fast-paced 2D side-scrolling pixel art roguelike shooter with Terraria-style weapons and accessories, wall jumps, mobile-first controls, and online co-op for 1 to 4 players (friends playing together).

- **Tech:** Phaser 3 + JavaScript (ES modules), bundled with Vite
- **Target:** iOS (Safari / home-screen web app). Testing is done on a real iPhone.
- **Controls:** touch first. Movement controls and aiming are both player settings. Keyboard/gamepad are secondary and only for desktop debugging.

## Rules

1. **Mobile first.** Every feature must work with touch controls on an iPhone screen before anything else. If a feature needs a keyboard, it is not done.
2. **Do not guess.** If a requirement is unclear, ask the user before building it. State what you are unsure about first.
3. **Do not create files or code unless the user asks for it.** Planning, discussion and answers do not need files.
4. **Keep the structure.** Put files where `PROJECT_STRUCTURE.md` says. If a new folder or file is needed, update that document in the same change.
5. **Keep `TODO.md` current.** Tick items when done, add new items when discovered. Do not delete finished items.
6. **Small changes.** One feature or fix at a time, so it can be tested on the phone.
7. **Performance matters.** Target 60 FPS on a mid-range iPhone. Details below.

## iOS / mobile constraints

- Use multi-touch (at least 3 simultaneous pointers: move, aim/shoot, jump). Set `input.addPointers(3)` or more in the Phaser config.
- Prevent page scroll, pull-to-refresh, pinch zoom and double-tap zoom (`touch-action: none`, `user-scalable=no`, `overscroll-behavior: none`).
- Respect safe areas (notch, home indicator) with `env(safe-area-inset-*)` for HUD and buttons.
- Audio only starts after a user tap. Unlock the audio context on the first touch.
- iOS Safari has no true fullscreen API for pages; support "Add to Home Screen" (manifest + meta tags) for fullscreen play.
- Handle orientation: game is landscape. Show a "rotate your phone" message in portrait.
- Handle app backgrounding: on `visibilitychange`, reconnect to the server if the connection dropped when the tab returns. The game keeps running on the server meanwhile.
- Buttons must be large (minimum about 48 px touch targets) and not hidden under fingers. Controls must be remappable in position/size later.

## Performance rules

- Use object pools for bullets, enemies, particles and pickups. Do not create/destroy per shot.
- Use texture atlases, not many single images.
- Use tilemaps for rooms, and cull off-screen objects. Only keep the current room and neighbors loaded.
- Fixed-timestep physics, avoid per-frame allocations in `update()`.
- Cap particle counts and keep the number of active physics bodies low.
- Test with a visible FPS counter during development (toggle in debug).

## Code style

- ES modules, no globals. One class per file where possible.
- Game data (weapons, accessories, enemies, rooms) lives in data files under `src/data/`, not hard-coded in scenes.
- Gameplay values (speeds, damage, cooldowns) go in `src/config/` so they can be tuned without touching logic.
- Names: `PascalCase` for classes/files containing a class, `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants.
- Comment the why, not the what.

## Game design summary

- **Genre:** roguelike. Death resets everything. No checkpoints, no numbered levels, no permanent unlocks between runs.
- **World:** procedurally generated from connected, hand-built room templates (Dead Cells / Spelunky style). Rooms are designed so wall jumps are always fair and reachable. A run is a chain of rooms with rising difficulty. There are no room types: every room just has an entrance (door/place) and an exit (door/place).
- **Movement:** run, jump, variable jump height, wall slide, wall jump. Movement must feel snappy (coyote time and jump buffering). **Dash is not a base ability**: it comes only from a Dash accessory, so a fresh run starts without it and rooms must never require it. The dash works like Terraria's: it goes in the direction the player is facing, has a small cooldown, and the player is invincible while dashing.
- **Movement controls have 2 modes, switchable in Settings:** a movement joystick, or left/right buttons. Both feed the same move actions through `InputManager`, and the chosen mode is saved in localStorage.
- **Combat:** fast, constant shooting. Weapons have different fire rate, damage, spread, projectile type.
- **Room rule:** the exit to the next room stays locked until every enemy in the room is killed.
- **Co-op death:** a player who dies respawns when the group moves to the next room, losing half of their gear at random. They lose floor(n/2) random items (rounded down), so with 5 items they lose 2 and keep 3. They appear at the start of the room the group just entered.
- **Run end:** the run is endless and ends only when every player is dead. Then a results screen shows each player's stats (kills, deaths, damage dealt, damage taken, rooms cleared, survive time). After the results screen, everyone returns to the lobby.
- **Touch aiming has 3 modes, switchable in Settings:**
  1. **Aim-and-shoot stick:** one joystick aims, and shooting happens while it is held.
  2. **Aim stick + fire button:** a joystick aims, a separate button shoots.
  3. **Tap to shoot:** tap a point on the screen to shoot toward it.
  All three modes must produce the same game actions through `AimController`, so weapons do not care which mode is active. The chosen mode is saved in localStorage.
- **Items:** weapons and accessories (Terraria-like). Accessories give passive modifiers (e.g. extra jump, faster reload, more damage) and can unlock abilities (e.g. the Dash accessory). Several accessory slots. Every accessory, including Dash, is a plain data entry in `src/data/accessories.js`, so the user can change values like dash cooldown, distance, duration and invincibility without touching code logic. Dash is found like any other accessory.
- **Progression (within a run only):** drops and pickups from enemies and room rewards, equipment screen usable by touch.
- **Art:** pixel art made by the user, with a 16x16 tile grid for rooms. Players, enemies and weapons are NOT 16x16 and sizes vary: players and enemies are different sizes from each other, and each has its own size defined in data, and hitboxes are set separately from the sprite size. Files are PNG with transparency (sprite sheets or Aseprite atlas PNG + JSON). Use nearest-neighbor filtering (no smoothing) and integer scaling where possible. Never resize or blur art in code.
- **Placeholders:** art does not exist yet, so the game must be fully playable without any art files. Any entity without art (players, enemies, projectiles, pickups, solid tiles) is drawn as a solid-color rectangle matching its hitbox. Touch controls and HUD are drawn with simple shapes when no UI art exists. This is the fallback whenever a sprite file is missing, and also the way to test. Each entry in the data files can have an optional `color`, with a default color per category. When an art file is added for something, it is used automatically with no code change.
- **Multiplayer:** 1 to 4 players play together (solo is just 1 player). No anti-cheat is needed, so clients are trusted and no effort goes into cheat validation.
- **Lobbies:** when starting, the player chooses a **public** or **private** lobby. Public lobbies appear in a lobby browser. Private lobbies are hidden from the browser and can only be joined with a code. The player who creates the lobby sets a custom lobby name and the max player count (1 to 4). Players can join mid-run; the browser and join screen show that the lobby is already in game and for how long it has been running. If the player who created the lobby leaves, the lobby is handed to the player who joined first among those remaining.
- **Player name:** each player chooses a custom name of 3 to 16 characters: English letters (A-Z, a-z), numbers, spaces and underscores, saved in localStorage, shown in lobbies and above the player in game.

## Multiplayer rules

- Write gameplay for multiple players from the start: no single global `player`. Use a list of players, with input, stats, weapons and accessories per player.
- World generation is seeded. The server generates the run and tells the phones which rooms to load.
- Keep network messages small and infrequent (mobile connections). Interpolate remote players.
- Solo play runs locally in the phone's browser using the same `src/shared/` code (no server needed), as long as that stays easy. If it turns out to need a lot of work, solo goes through the server only.
- **No paid hosting.** The user runs a Node.js server on their own computer. It serves the game files, keeps the lobby list, and **runs the game itself** (one simulation per lobby). Friends connect over the local Wi-Fi, or through a Cloudflare Tunnel when not on the same network (so connections must work over `wss://` behind the tunnel).
- **The server runs the game simulation** (players, enemies, projectiles, rooms, stats). Phones only send their input and draw the state they receive. A phone going to the background or dropping does not stop the game for the others.
- **Game logic must be plain JavaScript with no Phaser and no browser/DOM code**, so it runs in Node.js. Put it in `src/shared/` (and keep `config/`, `data/`, `world/` and the logic systems free of Phaser imports). Phaser on the phone only handles touch input, rendering and UI.
- Touch movement must feel instant over the network: use client-side prediction of the local player. The phone runs the same `src/shared/` movement code and corrects itself from the server's state.
- Late joining: players can join a lobby that is already in a run. They must be told it is already in game and how long it has been running. A late joiner spawns at the start of the current room and starts with nothing, like a fresh lobby.

## Running the project

```
npm install
npm run dev       # dev server, reachable on the local network for phone testing
npm run build     # production build
```

Test on the iPhone by opening the dev server's local network address in Safari (phone and computer on the same Wi-Fi).

## Definition of done

A task is done when it works with touch on an iPhone, holds its target frame rate, does not break existing features, and `TODO.md` / `PROJECT_STRUCTURE.md` are updated.
