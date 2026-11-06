# TODO

Mobile (iOS) first. Tick items when done: `- [x]`.

## 0. Project setup
- [x] Create Vite + Phaser 3 project
- [x] Phaser config: landscape, scale mode FIT, pixel-art settings, multi-touch pointers
- [x] index.html: viewport meta, disable zoom/scroll/pull-to-refresh, safe areas
- [x] Dev server reachable from iPhone over local Wi-Fi
- [x] Portrait "rotate your phone" overlay
- [ ] Handle app background and return (`visibilitychange`), reconnect if the connection dropped
- [x] Debug overlay (FPS counter, toggle)
- [x] Add-to-Home-Screen support (manifest + iOS meta tags)
- [x] Placeholder rendering: anything without art (players, enemies, projectiles, pickups, solid tiles) is drawn as a solid-color rectangle matching its hitbox
- [ ] Touch controls and HUD drawn with simple shapes when there is no UI art
- [ ] Optional `color` field on data entries, with a default color per category
- [ ] Art files are picked up automatically when added (no code change); missing files fall back to the placeholder

## 1. Touch controls and aiming
- [x] Movement mode 1: virtual movement joystick
- [x] Movement mode 2: left/right buttons
- [x] Switch movement mode in Settings, save choice in localStorage
- [x] Jump button
- [ ] Weapon switch button
- [x] `AimController` that outputs aim direction + fire state for all modes
- [x] Aim mode 1: aim-and-shoot stick (aims and shoots while held)
- [x] Aim mode 2: aim stick + separate fire button
- [x] Aim mode 3: tap on screen to shoot at that point
- [x] Switch aim mode in Settings, save choice in localStorage
- [ ] Multi-touch tested in every mode: move + jump + aim/shoot at the same time
- [ ] Controls respect safe areas and have large touch targets
- [ ] Keyboard/mouse input mapped to the same actions (desktop debug only)
- [ ] Control layout settings (size / position / opacity)

## 2. Player movement
- [x] Run with acceleration and deceleration
- [x] Jump with variable height
- [x] Coyote time and jump buffering
- [x] Wall slide
- [x] Wall jump
- [ ] Dash ability in code, only active when the Dash accessory is equipped (not available on a fresh run)
- [ ] Dash behavior like Terraria: dashes in the facing direction, small cooldown, invincible while dashing
- [ ] Dash button on touch controls (shown only when the accessory is equipped)
- [x] Camera follow with look-ahead
- [ ] Tune feel on the real iPhone

## 3. World: procedural rooms (roguelike)
- [ ] Room template format (Tiled JSON + metadata: size, entrance, exit, difficulty)
- [ ] Room loader (only current + neighboring rooms loaded)
- [ ] Room generator that connects templates into a run (exits must line up)
- [ ] Rule check: every room is completable with the player's movement (incl. wall jumps)
- [ ] Every room has an entrance (door/place) and an exit (door/place); no room types
- [ ] Difficulty scaling as the run goes on
- [ ] Seeded generation (for debugging and reproducing bugs)
- [x] Solid tiles, one-way platforms
- [ ] Parallax background
- [ ] First 5 to 10 hand-built room templates
- [ ] Run manager: start run, track progress, end run
- [x] Death resets everything, no checkpoints, no permanent unlocks
- [ ] Run is endless and ends only when every player is dead
- [ ] Next-room exit stays locked until every enemy in the room is dead
- [ ] Unlock feedback (exit opens, visible indicator of enemies remaining)
- [ ] Minimap or room indicator (decide with user)

## 4. Shooting and weapons
- [x] Projectile pool
- [x] Basic gun (fire rate, damage, speed)
- [x] Aiming and muzzle position (works with all 3 aim modes)
- [x] Weapon data format in `src/data/weapons.js`
- [x] Weapon types: pistol, shotgun, rifle, melee (decide list with user)
- [x] Reload / ammo / cooldown rules (decide with user)
- [ ] Hit effects, recoil, screen shake

## 5. Enemies
- [ ] Enemy base class and pool
- [x] Walker enemy
- [ ] Flyer enemy
- [ ] Shooter enemy
- [ ] Enemy spawning tied to room templates
- [x] Player damage, invincibility frames, death
- [ ] Each enemy type has its own size, hitbox and stats in `src/data/enemies.js` (sizes vary, not 16x16)
- [ ] Boss (optional, not planned)

## 6. Items, accessories and inventory
- [ ] Item data format (`src/data/accessories.js`)
- [ ] Stat modifier system (damage, speed, jumps, fire rate)
- [ ] Accessory slots on the player
- [ ] Drops and pickups from enemies and room rewards
- [ ] Equipment screen usable by touch
- [ ] First accessories (e.g. double jump, speed boots, damage charm)
- [ ] Dash accessory as a normal data entry in `src/data/accessories.js`, found like other accessories (cooldown, distance, duration, invincibility are editable values)
- [ ] Make sure no room requires a dash to be completed
- [ ] Rarity system (decide with user)
- [ ] Items reset when the run ends (no carry-over between runs)
- [ ] Respawned players lose floor(n/2) random items (rounded down: 5 items = lose 2, keep 3)
- [ ] Respawned player appears at the start of the room the group just entered

## 7. UI / HUD
- [ ] Health bar
- [ ] Ammo / weapon indicator
- [ ] Equipped accessories display
- [ ] Pause menu
- [ ] Main menu
- [ ] Create-lobby screen (public / private, lobby name, max players) and lobby browser screen
- [ ] Player name entry (first launch and Settings), 3 to 16 characters (English letters, numbers, spaces, underscores), saved in localStorage
- [ ] Show player names in the lobby and above players in game
- [ ] Settings screen (movement mode, aim mode, control layout, audio)
- [ ] Per-player stats tracking (kills, deaths, damage dealt, damage taken, rooms cleared, survive time)
- [ ] Results screen when every player is dead, showing each player's stats, then everyone returns to the lobby

## 8. Audio and polish
- [ ] Audio unlock on first touch
- [ ] Shoot, hit, jump, pickup sounds
- [ ] Music
- [ ] Particle effects (capped)
- [ ] Haptics where iOS allows it
- [x] Pixel art pipeline: PNG files, 16x16 tile grid for rooms, Aseprite atlas (PNG + JSON) loading
- [ ] Player and enemy sprites are not 16x16: hitboxes set separately from sprite size
- [ ] Decide the internal game resolution and use integer scaling
- [ ] Check on the iPhone that art is sharp (no blur, no tile seams)

## 9. Performance and release
- [ ] Texture atlases
- [ ] Verify 60 FPS on the iPhone in the heaviest room
- [ ] Memory check on long runs
- [ ] Save settings only (localStorage), no run saves
- [ ] Production build, served by the local server
- [ ] Optional: wrap as a native iOS app (decide with user)

## 10. Multiplayer (1 to 4 players, no anti-cheat)
- [ ] Game simulation runs on the Node server; phones send input and draw the state they receive
- [ ] Game logic is plain JavaScript in `src/shared/` (no Phaser/DOM) so it runs in Node
- [ ] Local Node.js server on the user's computer: serves the game files, keeps the lobby list, runs one game per lobby
- [ ] Phones connect over local Wi-Fi
- [ ] Phones connect through a Cloudflare Tunnel (`wss://`)
- [ ] Document how to start the server and the tunnel (no hosting service)
- [ ] Refactor gameplay to a list of players (no single global player)
- [ ] Per-player input, stats, weapons and accessories
- [ ] Start screen: choose public or private lobby
- [ ] Public lobby: appears in the lobby browser
- [ ] Private lobby: hidden from the browser, joined only with a code
- [ ] Lobby code generation and join-by-code
- [ ] Lobby browser: list public lobbies (name, player count, state), join by tapping
- [ ] Lobby custom name and custom max player count (1 to 4) set by the player who creates the lobby
- [ ] Handle full lobbies
- [ ] Join a lobby mid-run
- [ ] Mid-run joiner spawns at the start of the current room with no gear
- [ ] Show an "already in game" notice with how long the run has been going, in the browser and before joining
- [ ] Seeded run generated by the server, phones load the rooms the server sends
- [ ] Sync player positions, projectiles, enemies, pickups and room state
- [ ] Interpolation for remote players, tested on a mobile connection
- [ ] Client-side prediction of the local player using the shared movement code, corrected by the server state
- [ ] Enemy scaling by player count
- [ ] Co-op death: a dead player respawns when the group enters the next room, losing half their gear (random, rounded down)
- [ ] Co-op camera (decide with user)
- [ ] Disconnect / reconnect handling (a phone that drops can rejoin; the game keeps running)
- [ ] If the lobby creator leaves, the lobby passes to the player who joined first among those remaining
- [ ] Solo play runs locally in the phone's browser using `src/shared/` (no server); if that turns out to be a lot of work, solo goes through the server only

## Open questions for the user
- None right now. Add new questions here.
