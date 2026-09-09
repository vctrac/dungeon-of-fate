# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.

## V2.15.1 — Fortune Refinement & Item UX

Room feedback uses a compact stack. Clues pulse at the identified room and retain a true tendency marker without revealing the exact event. Swipe anywhere on screen while a monster is waiting to begin its battle roll; gesture direction, speed, and distance do not change the outcome. Keyboard users can focus the card and press Enter or Space. Traps and shrines still roll automatically, and map holds retain their existing actions.

Monsters threaten different resources: Guardian 👹 attacks Health, Thief 🥷 steals Gold, and Spirit 👻 drains Fate. The large translucent gesture is an instruction; the bright slash is the player's attack. Empty rooms no longer produce a “ROOM SEARCHED” popup.

Equip at most three different Trinkets. Discovering a fourth opens its Item Card with replace-one or leave choices. Tapping an equipped icon opens the same card for inspection:

- 🪆 Voodoo Doll rescues only a lethal HP hit: stay at 1 HP, break FATE to ×1, and destroy the Doll. Works at ×1; ordinary damage never consumes it.
- 🩸 Vampire's Blood heals one heart on the first useful monster victory each floor.
- 🧿 Evil Eye confirms creatures only in already revealed, unsearched frontier rooms. It never identifies the archetype.
- 🍀 Golden Horseshoe grants 25 + 5 × floor bonus Gold on every perfect encounter roll.

The single Consumable slot uses **tap to inspect, hold for 550 ms to use**, with the established progress ring. This applies to every Consumable, including keyboard Enter/Space holds. Dragging/canceling does not activate; releasing a completed hold cannot open a second card. Flask/Charm are kept when unnecessary. Death's Bargain remains unchanged: HP becomes one; its next three new room entries block HP damage, including the third encounter. Revisits do not spend charges.

HP protection priority remains Death's Bargain → Divine Shield → Voodoo Doll (lethal only). Blood's once-per-floor state remains; the Doll no longer resets because it is destroyed. Effects and items reset on new runs. All essential state is serializable; this patch does not add saves.

### Item Cards and starters

`cardState` holds a serializable queue and one active card with kind, item ID, discovery/inspection mode, and decision flag. Acquisition commits once, or waits for an explicit replacement choice. Unresolved encounters retain control; important loot waits until encounter continuation. Closing advances queued cards, then returns to exploration. Current cards all wait for input; decision cards never auto-advance. Routine Gold/FATE/HP and passive item effects remain normal feedback, not cards. The shared renderer contains icon, name, visual effect summary, description and relevant state. It supports touch, mouse, keyboard focus trapping and a constrained, internally scrollable layout for short screens.

Every run starts with exactly one unused **Fortune Coin or Trap Ward**, chosen 50/50. No starter modal. The slot gently pulses until its first interaction; the existing learning mechanism remembers this. Both items join normal Consumable discoveries.

- **Fortune Coin:** activation arms five new-room entries; the activation room is excluded. Each new entry spends one charge, even without Gold. Only that entry's room rewards are doubled: Treasure, Rich, Key, encounter Gold, shrine overflow, Scavenge, guaranteed loot clues and the perfect-roll Horseshoe bonus. Ordinary Gold is rounded normally, then doubled once; feedback shows the calculation. The fifth room stays affected through its encounter and Scavenge until leaving. Revisits do not spend charges or regain the bonus. Remaining charges persist across floors; the previous room's eligibility does not. Score-only awards, theft and debug/global wallet changes are not doubled.
- **Trap Ward:** remains armed across rooms/floors until the next room or Scavenge Trap. It disarms the Trap before dice start, preventing both HP and FATE consequences, then expires. There is no perfect-roll reward because no die was rolled.


### Prototype balance

Depth scaling fills only empty rooms after base placement and before Fortune upgrades. For depth `d`, define `t = clamp((d − 2) / 18, 0, 1)`. Target Monster count is `round(eligibleRooms × (0.14 + 0.16t))`, counting active non-start/non-exit rooms. Existing Monsters remain; only the shortfall is added. Floor-one adjacent empty rooms are protected. Pressure rises from roughly 14% to 30% at floor 20, then plateaus; integer room counts cause small percentage deviations.

Floor 1 uses only Guardians. From floor 2, archetype weights are Guardian `0.80 − 0.40t`, Thief `0.20 + 0.10t`, Spirit `0.30t`. This gradually reaches 40% / 30% / 30% at floor 20. Fortune never replaces these Monsters or any Trap.

Thief rolls 1/2/3 steal floor(wallet × 25%/15%/7%), with no fixed minimum or upper cap; roll 4 escapes, rolls 5/6 award base 25/55 Gold. Historical Score is never reduced.

### FATE and fortune

Central helpers clamp FATE to at least ×1 and emit change/break hooks. Every existing gain passes through `effectiveGain = baseGain / (1 + ((max(1, FATE) − 1) / 5)²)`. The factor is 100% at ×1, 86.2% at ×3, 50% at ×6, 23.6% at ×10, 11.3% at ×15, and 6.5% at ×20. There is no hard cap. Sub-cent gains carry in serializable `fateGainRemainder` until they can add 0.01; damage, scaling, breaks and run resets clear the remainder. Feedback reports the resulting actual FATE value. A 100-event streak of base +0.5 reaches approximately ×14.99 instead of ×51. Guardian rolls 1/2 lose 1/0.5 FATE instead of resetting. Trap rolls 1–2 lose 1, rolls 3–4 lose 0.5. Fast Travel retains half (rounded to two decimals, minimum ×1). Spirit rolls 1/2/3 break/lose 2/lose 1; 4–5 preserve, 6 gains base 0.7 through the diminishing curve. Voodoo Doll still breaks FATE. Dice remain fair and independent of FATE.

Generation snapshots `floorFortune` before placing events. After normal placement, budget is stochastic rounding of `min(5, max(0, (floorFortune - 1) × 0.75))`. Spend at most 5 points on at most 3 distinct rooms. Choose an affordable eligible upgrade with weight `1 / (1 + 3 × priorUpgradesOfThatType)`, then a random eligible room: empty → shrine costs 1, empty → treasure costs 2, treasure → rich costs 3. Start, exit, danger, connectivity and already upgraded rooms are excluded. Snapshot, budget and selected upgrades are serializable state; later FATE changes cannot alter this floor. At most **one bonus Shrine** can be added; base generation still has one natural Shrine, for a total maximum of two. Repeat weights fall to 1/4 after the first selection and 1/7 after the second. Unusable points remain unspent. The upgrade registry supports future additions.

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

Set `window.__DOF_DEBUG__ = true` in the console to log generation and floor-end summaries. `__dofTest.state().floorEconomy` provides entering/leaving FATE, base/effective/applied FATE gains, budget/upgrades/unused budget, natural/bonus Shrines, Monster counts by archetype, and Gold entering/gained/lost/leaving. No run data is stored in localStorage.

After the guaranteed introductory find, Scavenge has a 4% item band, 6% clue band and the existing 5% trap band. Item finds choose an unowned trinket or a consumable. A loot clue marks a searched, unscavenged room with ⌁ 🪙 and stores guaranteed Gold there; the promised find cannot become Nothing or a Trap. Exploration clues retain their true-tendency behavior.

## Regression checks

`node tests/fortune-logic.cjs` runs the balance checks without browser dependencies; rendering, timers and gestures are deliberately stubbed and are not verified by this command.

With Node.js and Playwright available, run `node tests/regression.cjs`. Install Playwright's Chromium with `npx playwright install chromium`, or set `PWA_BROWSER` to an existing Chromium/Edge executable. The test starts its own local server and checks phone/landscape layout, feedback bounds, clues, pointer and touch combat, map holds, rewards, shields, and real offline launches.

Run `node tests/fortune.cjs` for 300 paired seeded floors, another 480 depth samples, Shrine limits, connectivity, diminishing gains/no hard cap, theft, frontier-only Eye and five-floor economy sweeps. The five-floor sweep wins all encounters and forces normal Scavenge Gold finds; it does not model survival or realistic mixed outcomes.

Also run `node tests/relics.cjs` for monster balance/identities, passive hooks, consumable holds/choices, Bargain entry accounting, guaranteed loot clues, and run/floor state resets.

Run `node tests/items.cjs` for starter randomness, touch inspection, hold ring and activation, three-slot replace/reject, queued battle loot, Coin entry accounting and all Gold paths, Ward roll bypass, Doll continuation, and phone/landscape card bounds.

V2.15.1 validation ran all four browser suites with headless Chromium, plus DOM-free logic, syntax and diff checks. Actual service-worker installation and offline file/directory launches passed. Sample Monster rates were ~14–15% early, ~17% at floor 5, ~21% at floor 10 and ~30% at floors 20/40; no sampled floor exceeded two Shrines. Winning five-floor sweeps with normal Scavenge finds ended around 6.8–7.5k Gold. Physical-phone emoji rendering, touch feel, item readability and survival/difficulty pacing still need playtesting.

## Install and play

Serve this folder over HTTPS (or localhost for development), open the game, then use your browser's Install app or Add to Home Screen option. Launch the installed icon for fullscreen play where supported; other browsers fall back to their supported app display mode.

After the first successful online load and service worker installation, the game can launch offline. This caches the game files, not an in-progress run. New service worker versions activate after existing game windows close. Bump the cache version in `sw.js` when changing cached files.

