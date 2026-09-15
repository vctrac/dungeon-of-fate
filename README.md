# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.
try it at:
https://vctrac.github.io/dungeon-of-fate/

## V2.16.2 — Discovery & Visual Language

Built as a delta on current HEAD. The normal economy, danger rates, Fortune Budget, FATE gains, items, starter cue/effects, Gate frequency/threshold/reward weights, Altar exchange and EXIT rules are preserved.

### Finite Scavenge discovery

V2.16.1's loot Clue created `{kind: "gold", base: 10 + floor × 2}` in a previously searched room and marked it. V2.16.2 removes that reward-manufacturing path. Every active non-EXIT room receives a serializable `scavengeOpportunity = {roll, resolved, passiveLead}` at floor generation, before any Clue or visit. Scavenging consumes it once; a Clue only reveals information about it.

The same uniform Scavenge table is now rolled in advance: **45% nothing, 30% ordinary Gold, 10% lucky Gold, 6% Clue, 4% item opportunity, 5% Trap**. Existing reward formulas, item selection/slot decisions and the first-ever Scavenge's safe ordinary-Gold result are unchanged. No additional Gold is assigned for a Clue. An item opportunity chooses its specific existing item through the existing discovery function when resolved.

**Lead eligibility:** an unresolved roll ≥ 0.75 (the lucky Gold, Clue, item and Trap bands: 25% of outcomes). It must be a visited, active, non-EXIT room and not already marked. Thus ❗ identifies something worth investigating, including possible danger, without guaranteeing Gold. Resolving Scavenge atomically clears the attention marker and marks its underlying opportunity resolved, even when the first-Scavenge safeguard applies.

**Normal exploration:** each floor has a **65% chance to preselect at most one** eligible non-START, non-EXIT, normal-dungeon room as a passive lead. If no eligible room exists, none is selected. Its first physical visit reveals ❗. Selection is fixed at generation; repeated walking/tapping/waiting never creates opportunities or new rolls. Gate branches have ordinary Scavenge opportunities but no additional passive-lead allocation.

**Clues:** the existing Scavenge Clue band keeps its **40% backward-lead choice when both backward and exploration targets exist**, or uses an eligible backward target if there is no exploration target. It selects an existing unmarked eligible opportunity in visited territory. Without one, it falls back to a truthful exploration Clue (or the existing no-new-clues feedback if all options are exhausted). Hidden Gate interiors are excluded until legitimately revealed. There is no repeat reveal of an active or consumed lead.

❗ remains optional, survives redraws, and clears with its opportunity. New information encountered during auto-walk receives the existing **400 ms total** room emphasis; other steps remain **150 ms**. Known markers never repeatedly delay travel. No automatic Scavenge, card, reroute or forced stop is added.

### Acquisition and shared gestures

Item discovery uses a reusable **source room → sparkle/actual item icon → Item Card** sequence lasting **650 ms**, with no extra tap. Cards retain the discovery/inspection distinction and source-room identity. Normal auto-equipping still commits once; a full slot/build presents the found candidate before the existing explicit replace/reject decision. Timer/overlay state is transient, tied to the active card and canceled on a new run. Inspection skips this sequence. Routine numeric effects still use feedback rather than cards.

Consumable cards demonstrate a press, ring fill, completion and reset in a **3.8-second CSS-only loop** around the primary icon. The ring uses the real HUD hold appearance and a small hand cue; it never invokes item logic. The existing secondary instruction identifies the HUD slot as the actual target. Reduced-motion settings retain a static gesture cue. Shared art sizing is 64 px, or 44 px on short screens; the existing card title/equation/category/decision layout remains intact. No Codex or card-game system is introduced.

Shared tap/hold controls track the press immediately but show their ring only after **200 ms**, already reflecting elapsed progress. Actual hold thresholds remain **320 ms for room Scavenge/auto-walk/EXIT, 550 ms for HUD Consumables, and 650 ms for the Altar exchange**. The hold-only Altar keeps its immediate ring. Quick taps show no ring. A pressed room node is retained across timed map redraws so the gesture and ring cannot disappear mid-hold; deferred rendering resumes afterward.

### Altar landmarks

Only a discovered (`altarCardSeen`) Altar gets the prominent central ✦ and persistent purple room identity, readable at a distance. It stays quiet at full Hearts or FATE ×1. An unused Altar with missing Hearts, positive HP and FATE > ×1 breathes gently every 3 seconds. Spent Altars retain a dim static icon. First-show, tap-to-reopen, hold-to-Scavenge, one-time healing and non-interrupting revisits/auto-walk remain unchanged.

### Small FATE branches

The original optional Gate entrance is extended after normal generation using previously inactive cells on the existing 9×9 grid. Desired size weights are **1 room: 20%; 2 rooms: 60%; 3 rooms: 20%**. Each new room links to one existing branch room, producing short paths or forks. There is exactly one connection to the normal dungeon. Existing normal corridors/rooms and START/EXIT remain untouched; normal reachability is validated with the entire branch excluded. If space runs out, growth stops at the smaller valid size. If the original entrance cannot fit, the existing no-Gate fallback applies. There are never four rooms, overlapping rooms, extra normal-dungeon connections or map rescaling.

The **30% eligible-floor Gate spawn attempt from floor 3**, frozen FATE threshold formula and guaranteed-reward weights remain unchanged: **55% Treasure, 35% Rich Treasure, 8% Shrine, 1.5% Consumable, 0.5% Trinket**. The existing two-Shrine safeguard converts the Shrine result to Treasure. Exactly one branch room, selected uniformly, receives that guaranteed opportunity. Additional rooms are ordinary: Monster probability is the existing `monsterRate(floorNo)`; Trap probability is the normal floor's Trap count divided by its non-START/non-EXIT room count; otherwise empty. Monsters use existing depth composition. Additional rooms do not roll extra premium primary rewards, Shrines or item drops; their normal finite Scavenge table remains available.

`fateGate.branchIds`, `rewardRoomId`, requested size and existing entry/requirement state are serializable. Outside-to-branch entry checks current FATE; auto-walk also requires a legitimate previous crossing and visited paths. Internal traversal and leaving never require FATE. Discovering the Gate reveals only its first frontier room; later branch rooms reveal through ordinary neighboring exploration. Clues cannot reveal hidden interiors; Evil Eye confirms only legitimately revealed frontier creatures and never archetype.

**Dimming condition:** the Gate is resolved only when **every branch room has been physically visited and its primary encounter has resolved**, with no pending item card/decision. Scavenging every room is not required. The entrance rune/connection then use the existing quiet resolved styling. An unopened branch is excluded from Perfect Floor counts; once entered, normal searched-room completion semantics apply to all its rooms. Descent remains unrestricted by optional content.

### Validation and next playtest

`tests/discovery.cjs` adds seeded opportunity bands/exposure, branch topology/content/fog/access/resolution, truthful Clue fallback, marked Trap risk, item acquisition timing, CSS-only hold demonstration, real pointer timing and Altar landmark checks. Existing active-fate, exploration, items, relics, regression, fortune and DOM-free fortune-logic suites are updated for pre-existing opportunities and branch membership. They cover combat, rewards, item protection, queue/replacement flows, mobile layouts, cause-of-death and actual service-worker offline launches. Cache version: `dungeon-of-fate-v2.16.2-1`.

In a 1,000-floor seeded sample: **294 Gates**; requested sizes **61/170/63**, actual fitted sizes **101/139/54**; **644 passive leads**, with **165 on the shortest normal START→EXIT route**. Across 29,930 pre-rolled opportunities, the six outcome bands counted **13,478 / 9,008 / 2,981 / 1,763 / 1,191 / 1,509**, consistent with the unchanged probabilities. This is generation exposure, not evidence that a player notices the marker or survives to reach it.

Physical phone playtesting still needs to establish whether ❗ is noticed without verbal teaching, the hold demonstration teaches the HUD action, acquisition feels satisfying, Altars are recognizable at a glance, and 1–3-room branches feel worth exploring without making the map crowded. Check emoji/hand rendering, gesture feel and installed-PWA updates on real Android/iOS devices.

## V2.16.1 foundation — Exploration & Feedback


This delta preserves V2.16 economy, danger, items, Fortune Budget, diminishing gains, Gate generation/rewards/requirements and Altar costs.

- **Auto-walk:** hold a different visited room for the existing 320 ms. BFS selects a path through physically visited rooms only. Each connection is rechecked while walking. One visible step every **150 ms**, with no FATE, Gold, HP or item cost. Adjacent taps still walk one room; distant taps do nothing. Traversal is deterministic and ignores additional movement input until arrival. It never reveals rooms, repeats encounters or awards rewards, consumes new-room effect charges, or automatically descends at EXIT. Current-room holds still Scavenge; current EXIT holds descend. A Gate still checks current FATE for entry and requires a previous legitimate visit for auto-walk; leaving always works.
- **Altars:** `altarCardSeen` records first presentation. Dismissal leaves the Altar available without reopening it during subsequent traversal. Tap the current unused Altar to reopen; hold still Scavenges. Successful sacrifice retains the existing one-use, full-health and minimum-FATE rules and spent-map appearance.
- **Gates:** `fateGate.resolved` becomes true after the primary opportunity resolves (item decisions wait for card completion). Resolved runes fade to 45% opacity; the connection fades to 35%, and its glow stops. Requirements, visibility and access checks remain intact. Optional completion semantics are unchanged; unused Altars, unresolved loot clues and unentered Gates do not block descent.
- **Room attention:** existing backward loot Clues now leave **❗** on a visited, unscavenged room. The marker represents the existing finite hidden reward, with source/active/emphasized/resolved state on the room. No movement RNG creates markers or rewards. Scavenging resolves the marker with the opportunity. New marker information encountered during auto-walk gets **400 ms total** room emphasis instead of 150 ms, then travel continues. Markers visible at departure do not slow travel. This patch does not change Clue or Scavenge rates.
- **Starter attention:** each run's uninspected starter has a restrained 4.5-second repeating cue: a brief glow and 2 px lift, quiet for most of the cycle. Inspection or successful use stops it; canceled gestures do not. State lives in `relicState.starterItem/starterInspected`. No automatic card or activation; tap inspection and hold use remain separate.
- **Lethal feedback:** after all HP protection hooks, an actual lethal result records `{type, icon, label}` in `causeOfDeath`. The event/result and ♥0 remain visible for **1,000 ms** before automatic Run Over. Early continuation taps cannot shorten this beat. Run Over shows **⚠ TRAP** or **👹 MONSTER**. Doll rescue records no death, creates no death timer, and preserves survival. Duplicate damage/finalization are guarded; new runs cancel old death/travel timers.

### Truthful hint semantics

| Color | Meaning |
| --- | --- |
| Green | Known non-hostile primary room: Shrine/Altar, or a Clue-confirmed safe empty room. Never Monster/Trap. Does not promise loot or a safe future Scavenge. |
| Yellow | Known valuable primary opportunity: Treasure/Rich Treasure, key, Trinket or Consumable. |
| Red | Actual primary danger: Monster (any archetype) or Trap. No false danger colors. |
| Neutral ? | Unknown information; may contain any event. |

The existing 68% hint-information chance is retained; its uncertain branch now produces neutral rather than a random false color. Existing RNG draw counts are preserved so this semantic change does not alter seeded floor generation. Clues use actual room contents. Evil Eye remains a separate frontier-only creature confirmation and hides archetype.

### V2.16.1 validation

`node tests/exploration.cjs` checks 300 floors for truthful hints; timed visited-only travel; no duplicate rewards/cost; finite backward loot clues and new-only emphasis; quiet Altars and tap/hold separation; lethal Trap/Monster timing/cause; Doll interception; restart safety; starter inspection and canceled gestures. Existing regression, relics, items, fortune, active-fate and DOM-free fortune-logic suites cover the remaining mechanics, mobile layouts and actual service-worker offline launches. The active-fate sample retains 287 Gates and 210 Altars across 1,000 seeded eligible floors. Cache is `dungeon-of-fate-v2.16.1-1`.

Physical phone playtesting remains necessary for auto-walk pacing/orientation, ❗ and starter-cue discoverability without verbal teaching, rune readability/dimming, Altar tap/hold feel, and whether the one-second lethal beat makes the cause immediately understandable. Browser emulation cannot establish those playtest outcomes.

## V2.16 foundation — Active FATE: Gates & Altars

### Active FATE

V2.16 adds optional access and voluntary healing without changing the existing reward, danger, item, Fortune Budget, diminishing-gain or Fast Travel balance constants.

**FATE Gates:** from floor 3, a 30% spawn attempt can add one room in a previously inactive adjacent map cell. Its parent is a normal non-start/non-exit room with fewer than four links. Only one reciprocal connection is added, making the new room a leaf. Existing corridors and rooms remain intact. Generation validates that every normal room, including EXIT, stays reachable with the gated room excluded; invalid additions are rolled back. If no legal attachment exists, no Gate spawns.

Let entering FATE be `F`, and let `D = 1 / (1 + ((F − 1) / 5)²)` (the existing gain factor). Choose stretch `S = 0.5 / 0.75 / 1.0` with probabilities `50% / 35% / 15%`. The frozen requirement is **`ceil((F + S × D) / step) × step`**, rounded to two decimals, where `step = 0.1` below entering FATE 20, otherwise `0.01`. For example, entering at ×3.4 gives thresholds ×3.9, ×4.1 or ×4.3. Small high-FATE steps avoid demanding gains the diminishing curve makes unrealistic.

The Gate is hidden until its room is revealed through exploration or an existing Clue. A rune displays its exact requirement. Outside-to-inside movement always checks current FATE; entry does not spend FATE and merely reaching the threshold elsewhere does not permanently unlock anything. Once inside, leaving is unrestricted. Fast Travel additionally requires a previous legitimate entry, so it cannot discover/open a Gate; revisiting still checks the current threshold. V2.16.1 auto-walk is free, as described above.

| Gate primary opportunity | Probability |
| --- | ---: |
| Treasure | 55% |
| Rich Treasure | 35% |
| Shrine | 8% |
| Consumable | 1.5% |
| Trinket | 0.5% |

If two Shrines already exist, the Shrine outcome becomes Treasure (63% Treasure, 0% additional Shrine). Normal and Fortune Shrine rules are unchanged. Items use existing definitions, slot choices and cards; a Trinket outcome selects an unowned Trinket or falls back to a Consumable if none remains. No ordinary Monster or empty primary reward is generated. The Gate room can be scavenged normally after entry.

**Altars:** an independent 22% spawn attempt from floor 3 places at most one Altar in a remaining normal empty room. It does not replace a reward or danger and uses no Fortune Budget. Entering opens an explicit exchange card with no die roll: **hold 650 ms to break current FATE to ×1 and restore exactly one heart**. Full health or FATE ×1 disables the offer. Tapping the offer never spends anything; tapping elsewhere leaves. A canceled/moved hold does nothing. Dismissed Altars remain available on later visits; successful use marks the room spent before applying its one-time reward. V2.16.1 revisits stay quiet; tap the current Altar to reopen it. The Doll is neither consumed nor consulted. This deliberately can remove access to a discovered Gate.

**Completion:** an unentered Gate room is excluded from normal active/searched completion counts and cannot block Perfect Floor or descent. Once entered it follows normal searched-room semantics; the existing Perfect Floor award remains one-time, so entering a bonus room after earning it cannot pay it again. Unused Altars count as explored when entered; spending FATE is never required for completion. Descending discards the floor, its Gate and its Altar. There is no upward travel or resource respawn.

Gate identity, fixed requirement, reward, discovery and legitimate-entry status are serializable in `fateGate`. Altar identity is `altarRoom`, with spent and before/after FATE fields on its room. `floorEconomy.activeFate` logs these through the existing debug switch. New discovery/crossing/denial and Altar-sacrifice effect hooks can support future presentation without adding audio now.

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

`cardState` holds a serializable queue and one active card with kind, item ID, discovery/inspection mode, and decision flag. Acquisition commits once, or waits for an explicit replacement choice. Unresolved encounters retain control; important loot waits until encounter continuation. Informational discovery/inspection cards have no confirmation button: tap anywhere to continue, without using the item. Pointer ownership and movement checks prevent opening gestures or scrolling from dismissing the next card. Replacement cards retain explicit replace/reject controls and ignore background taps. Altar cards share the queue and use their own hold action. Closing advances queued cards, then returns to exploration; no cards auto-advance. Routine Gold/FATE/HP and passive item effects remain normal feedback, not cards. The shared renderer contains icon, name, visual effect summary, description and relevant state. It supports touch, mouse, keyboard focus trapping and a constrained, internally scrollable layout for short screens.

Every run starts with exactly one unused **Fortune Coin or Trap Ward**, chosen 50/50. No starter modal. V2.16.1 gives each uninspected starter a periodic attention cue until inspection or use. Both items join normal Consumable discoveries.

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

Run `node tests/active-fate.cjs` for 1,000 seeded floors, exact reward weights, Gate topology/frozen requirements/entry/exit/Fast Travel restrictions, optional completion/descent, Altar hold/revisit/spent rules, Gate–Altar conflict, item dismissal and phone layouts. V2.16 checks passed with headless Chromium, including the existing combat, item, balance and actual service-worker offline-launch suites. The seeded sample produced 287 Gates and 210 Altars in 1,000 eligible floors.

Manual phone playtesting remains needed for rune readability in dense/dim maps, hold feel, perceived Gate reward value, threshold attainability during real runs, and whether the Altar/Gate trade-off makes FATE worth preserving.

## Install and play

Serve this folder over HTTPS (or localhost for development), open the game, then use your browser's Install app or Add to Home Screen option. Launch the installed icon for fullscreen play where supported; other browsers fall back to their supported app display mode.

After the first successful online load and service worker installation, the game can launch offline. This caches the game files, not an in-progress run. New service worker versions activate after existing game windows close. Bump the cache version in `sw.js` when changing cached files.
