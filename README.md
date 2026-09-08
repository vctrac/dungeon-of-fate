# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.

## V2.15 — Fortune & Economy

Room feedback uses a compact stack. Clues pulse at the identified room and retain a true tendency marker without revealing the exact event. Swipe anywhere on screen while a monster is waiting to begin its battle roll; gesture direction, speed, and distance do not change the outcome. Keyboard users can focus the card and press Enter or Space. Traps and shrines still roll automatically, and map holds retain their existing actions.

Monsters threaten different resources: Guardian 👹 attacks Health, Thief 🥷 steals Gold, and Spirit 👻 drains Fate. The large translucent gesture is an instruction; the bright slash is the player's attack. Empty rooms no longer produce a “ROOM SEARCHED” popup.

Trinkets last for one run, with no duplicate stacking:

- 🪆 Voodoo Doll prevents one heart of damage once per floor, resetting Fate.
- 🩸 Vampire's Blood heals one heart on the first useful monster victory each floor.
- 🧿 Evil Eye confirms creatures only in already revealed, unsearched frontier rooms. It never identifies the archetype.
- 🍀 Golden Horseshoe grants 25 + 5 × floor bonus Gold on every perfect encounter roll.

The single consumable slot is tappable: 🧪 restores one heart; 🛡 grants one Divine Shield. Neither is spent when unnecessary. Hold ☠ for 0.55 seconds to set health to one and protect the next three new room entries. Revisits do not spend charges; the third room's encounter is protected before expiry. This does not prevent Gold or Fate losses. When the slot is occupied, choose the item icon to keep.

HP protection priority is Death's Bargain → Divine Shield → Voodoo Doll, so passive protection is not wasted. Bargain charges persist between floors, while Doll/Blood availability resets each floor. All run items and effects reset on a new run. New essential state is plain serializable data; this update does not save runs.

### Prototype balance

Floor 1 uses Guardians. Floor 2 has 75% Guardians / 25% Thieves; floors 3–4 use 60% / 20% / 20%; floor 5 onward uses 40% / 30% / 30% Guardians / Thieves / Spirits. Thief rolls 1/2/3 steal floor(wallet × 25%/15%/7%), with no fixed minimum or upper cap; roll 4 escapes, rolls 5/6 award base 25/55 Gold. Historical Score is never reduced.

### FATE and fortune

Central helpers clamp FATE to at least ×1 and emit change/break hooks. Gains retain their existing increments but no longer have inconsistent ×5/×6 caps that could lower high FATE. Guardian rolls 1/2 lose 1/0.5 FATE instead of resetting. Trap rolls 1–2 lose 1, rolls 3–4 lose 0.5. Fast Travel retains half (rounded to two decimals, minimum ×1). Spirit rolls 1/2/3 break/lose 2/lose 1; 4–5 preserve, 6 gains 0.7. Voodoo Doll still breaks FATE. Dice remain fair and independent of FATE.

Generation snapshots `floorFortune` before placing events. After normal placement, budget is stochastic rounding of `min(5, max(0, (floorFortune - 1) × 0.75))`. Spend at most 5 points on at most 3 distinct rooms. Randomly choose an affordable eligible upgrade, then a random eligible room: empty → shrine costs 1, empty → treasure costs 2, treasure → rich costs 3. Start, exit, danger, connectivity and already upgraded rooms are excluded. Snapshot, budget and selected upgrades are serializable state; later FATE changes cannot alter this floor. The upgrade registry supports future additions.

HUD radiance grows continuously over ×1–7 with a subtle shimmer, distinct damage contraction and a stronger break flash/collapse. Reduced-motion preferences suppress animation. Theft pulls coins from the wallet toward the encounter and counts the wallet down, with intensity proportional to percentage lost.

### Gold formulas

All ordinary Gold rewards use `floor(base × M)`, where `M = round(100 × (1 + 0.35 × sqrt(max(0, FATE - 1)))) / 100`. Treasure feedback shows this exact multiplier alongside raw FATE. Perfect Floor, descent and empty-room Score formulas remain unchanged and grant no Gold.

| Source | Base Gold (f = floor) |
| --- | --- |
| Treasure | 30 + 3(f − 1), formerly 180 with stepped depth scaling |
| Rich Treasure | 90 + 9(f − 1), formerly 600 with stepped depth scaling |
| Ancient Key | 20 + 2f |
| Guardian escape / win / perfect | 8 / 35 / 70 |
| Thief win / perfect | 25 / 55 |
| Spirit win / perfect | 15 / 40 |
| Trap avoided | 15 |
| Shrine roll 5 / 6 while injured | 20 + 2f / 40 + 4f |
| Full-health shrine with shield | 10 + f |
| Scavenge normal / lucky | 5 + f / 15 + 2f |
| Guaranteed loot clue | 10 + 2f |
| Golden Horseshoe | Unchanged: 25 + 5f, without FATE multiplication |

Set `window.__DOF_DEBUG__ = true` in the console to log generation and floor-end summaries. `__dofTest.state().floorEconomy` provides entering FATE, budget/upgrades and Gold entering/gained/lost/leaving. No run data is stored in localStorage.

After the guaranteed introductory find, Scavenge has a 4% item band, 6% clue band and the existing 5% trap band. Item finds choose an unowned trinket or a consumable. A loot clue marks a searched, unscavenged room with ⌁ 🪙 and stores guaranteed Gold there; the promised find cannot become Nothing or a Trap. Exploration clues retain their true-tendency behavior.

## Regression checks

`node tests/fortune-logic.cjs` runs the balance checks without browser dependencies; rendering, timers and gestures are deliberately stubbed and are not verified by this command.

With Node.js and Playwright available, run `node tests/regression.cjs`. Install Playwright's Chromium with `npx playwright install chromium`, or set `PWA_BROWSER` to an existing Chromium/Edge executable. The test starts its own local server and checks phone/landscape layout, feedback bounds, clues, pointer and touch combat, map holds, rewards, shields, and real offline launches.

Run `node tests/fortune.cjs` for paired seeded generation, all theft bands, FATE consequences, frontier-only Eye and five-floor economy sweeps.

Also run `node tests/relics.cjs` for monster balance/identities, passive hooks, consumable holds/choices, Bargain entry accounting, guaranteed loot clues, and run/floor state resets.

## Install and play

Serve this folder over HTTPS (or localhost for development), open the game, then use your browser's Install app or Add to Home Screen option. Launch the installed icon for fullscreen play where supported; other browsers fall back to their supported app display mode.

After the first successful online load and service worker installation, the game can launch offline. This caches the game files, not an in-progress run. New service worker versions activate after existing game windows close. Bump the cache version in `sw.js` when changing cached files.

