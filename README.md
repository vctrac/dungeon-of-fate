# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.

## V2.14 — Monsters & Relics

Room feedback uses a compact stack. Clues pulse at the identified room and retain a true tendency marker without revealing the exact event. Swipe anywhere on screen while a monster is waiting to begin its battle roll; gesture direction, speed, and distance do not change the outcome. Keyboard users can focus the card and press Enter or Space. Traps and shrines still roll automatically, and map holds retain their existing actions.

Monsters threaten different resources: Guardian 👹 attacks Health, Thief 🥷 steals Gold, and Spirit 👻 drains Fate. The large translucent gesture is an instruction; the bright slash is the player's attack. Empty rooms no longer produce a “ROOM SEARCHED” popup.

Trinkets last for one run, with no duplicate stacking:

- 🪆 Voodoo Doll prevents one heart of damage once per floor, resetting Fate.
- 🩸 Vampire's Blood heals one heart on the first useful monster victory each floor.
- 🧿 Evil Eye identifies only monster rooms, including on future floors.
- 🍀 Golden Horseshoe grants 25 + 5 × floor bonus Gold on every perfect encounter roll.

The single consumable slot is tappable: 🧪 restores one heart; 🛡 grants one Divine Shield. Neither is spent when unnecessary. Hold ☠ for 0.55 seconds to set health to one and protect the next three new room entries. Revisits do not spend charges; the third room's encounter is protected before expiry. This does not prevent Gold or Fate losses. When the slot is occupied, choose the item icon to keep.

HP protection priority is Death's Bargain → Divine Shield → Voodoo Doll, so passive protection is not wasted. Bargain charges persist between floors, while Doll/Blood availability resets each floor. All run items and effects reset on a new run. New essential state is plain serializable data; this update does not save runs.

### Prototype balance

Floor 1 uses Guardians. Floor 2 has 75% Guardians / 25% Thieves; floors 3–4 use 60% / 20% / 20%; floor 5 onward uses 40% / 30% / 30% Guardians / Thieves / Spirits. A bad Thief roll steals 20% of carried Gold, capped at 250 + 50 × floor, without affecting historical Score. Spirit rolls 1–2 reset Fate and 3–4 retain 55%, with a minimum of ×1.

After the guaranteed introductory find, Scavenge has a 4% item band, 6% clue band and the existing 5% trap band. Item finds choose an unowned trinket or a consumable. A loot clue marks a searched, unscavenged room with ⌁ 🪙 and stores guaranteed Gold there; the promised find cannot become Nothing or a Trap. Exploration clues retain their true-tendency behavior.

## Regression checks

With Node.js and Playwright available, run `node tests/regression.cjs`. Install Playwright's Chromium with `npx playwright install chromium`, or set `PWA_BROWSER` to an existing Chromium/Edge executable. The test starts its own local server and checks phone/landscape layout, feedback bounds, clues, pointer and touch combat, map holds, rewards, shields, and real offline launches.

Also run `node tests/relics.cjs` for monster balance/identities, passive hooks, consumable holds/choices, Bargain entry accounting, guaranteed loot clues, and run/floor state resets.

## Install and play

Serve this folder over HTTPS (or localhost for development), open the game, then use your browser's Install app or Add to Home Screen option. Launch the installed icon for fullscreen play where supported; other browsers fall back to their supported app display mode.

After the first successful online load and service worker installation, the game can launch offline. This caches the game files, not an in-progress run. New service worker versions activate after existing game windows close. Bump the cache version in `sw.js` when changing cached files.
