# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.
try it at:
https://vctrac.github.io/dungeon-of-fate/

## V2.19.1 — Layer Transition Performance & Polish

Delta from HEAD `0c1f387`. No generation, encounter, movement-cost or save-schema changes.

**Diagnosis:** V2.19 cloned the complete active map, rebuilt destination plus static background synchronously, and animated scale, opacity and full-container blur for 420 ms. It had no JS animation-frame loop or repeated geometry measurements in the transition itself. However, the stair-entry **340 ms arrival timer** called `update()` during that animation. `render()` removed/recreated all map children, replacing the animated nodes mid-flight. Other delayed UI updates could do the same. Its completion timer also unconditionally rebuilt the maps. Animated blur and independently animated room decorations added paint/compositing work on top of these rebuilds.

**Changes:** retain/detach the actual source map rather than deep-cloning it; clear the obsolete arrival timer; build destination once during PREPARE; establish both surfaces over two requestAnimationFrame callbacks; animate only transform and opacity for the existing 420 ms/ease-out. There are no per-frame JS style updates or geometry reads. Temporary `will-change: transform, opacity` is scoped to the two map containers and removed at cleanup. Their descendant animations are paused during motion. The duplicate inactive background is hidden during travel; its existing static 3 px blur / 14% opacity / 86% scale returns afterward. Animated blur is removed.

Flow: IDLE → gameplay destination/entry-effects commit + PREPARE → READY → ANIMATING → CLEANUP → IDLE. `update()/render()` requests during READY/ANIMATING coalesce into one deferred refresh after motion. Normal completion keeps the prepared destination DOM and removes the source; a deferred refresh is performed only if needed. Animation-end drives completion, backed by a 540 ms running timeout and 1,200 ms preparation watchdog. Callback identity checks, cancellation and cleanup prevent overlap/stale work. Map and item input are locked during travel. Lifecycle backgrounding cleans up visuals before flushing the existing safe snapshot. Restore/new floor cancel transient work. Reduced motion bypasses preparation/animation immediately.

**Measured browser result:** `tests/layer-performance.cjs` compares all four directions with densely revealed maps, including immediate stair-entry traversal. In a headless Chromium run, baseline sampling observed 99–229 added/removed nodes and one layout pass during the transition. The optimized run observed **zero child-node mutations, zero layouts, stable source/destination identity and retained input locks** in the same interval. Main-thread task time samples were 23–52 ms baseline versus 17–32 ms optimized; these are development diagnostics, not physical-phone FPS claims. Instrumentation lives only in the test. Set `LAYER_BASELINE=/path/to/old/index.html` to run the comparison against another build.

Focused tests also cover deferred redraws, rapid taps, repeated traversal, all four directions, item-input locking, lifecycle cleanup/reload and reduced motion. Existing layers, persistence, auto-walk, gameplay/offline and Reroll suites are rerun. Build/footer is V2.19.1 and asset cache is `dungeon-of-fate-v2.19.1-1`; `dof.activeRun` is untouched.

Physical Android/PWA follow-up remains necessary: test both directions on UPPER and LOWER, immediately tap stairs on arrival, repeatedly switch between densely explored maps, check small/large map transitions, alignment/z-order/cleanup, rapid tapping, background/reopen and reduced motion. Confirm actual smoothness on the two devices that reproduced the issue; desktop/headless measurements cannot establish mobile GPU performance.

## V2.19 — Dungeon Layers & Stairs

Delta from current HEAD `c8c6736`. A floor now owns one or two 9×9 layer grids. A layer change is ordinary traversal within the floor, never `newFloor()`.

### Model and generation

The existing flat room registry stays authoritative, with unique IDs `layerIndex * 81 + y * 9 + x`. Each room stores `layerId`; each layer stores `{id,type,height}`. BASE has height 0, UPPER +1, LOWER −1. `activeLayer` determines which map receives input. START/current/EXIT, history, room effects, cards and Gate references retain unique numeric room IDs. Horizontal `links` never cross layers; paired `stairTo` references represent the vertical edges. Generation/reachability uses both, while auto-walk uses horizontal links only.

Central configuration:

| Setting | Value |
| --- | --- |
| Maximum layers | 2 |
| Floors 1–2 | 0% multilayer |
| Floors 3–5 | 20% |
| Floors 6–10 | 30% |
| Floors 11+ | 40% |
| Secondary direction | 50% UPPER / 50% LOWER |
| Secondary size | Uniform 12–18 ordinary rooms |
| Multilayer EXIT | 65% BASE / 35% secondary |
| Transition duration | 420 ms; skipped with reduced motion |

`growLayer()` is the extracted existing room-growth/spanning-tree/extra-corridor algorithm, reused for both maps. BASE keeps its existing room count. Choose an active BASE coordinate excluding START and its initially selected EXIT; grow the secondary from that exact coordinate, then reserve both cells as stairs. If EXIT moves to secondary, select among its five farthest rooms from the stairs, following the existing endpoint convention. The former BASE EXIT becomes an ordinary eligible room. No special reward is guaranteed on secondary. Optional Gate expansion may add its existing 1–3 rooms on either layer.

Ordinary event placement, Monster scaling, Fortune, Gate, Altar, Chest and finite Scavenge generation each run **once over the complete floor**. Stairs are excluded from encounter/upgrade placement and Gate attachment. START stays BASE. Validation walks horizontal plus vertical connections and separately checks reachability without Gate branch rooms. A Chest remains a non-endpoint empty horizontal leaf (not a stair), outside Gate ownership, with the existing 20% single floor roll and farthest-distance ranking; it cannot become a required progression room.

### Traversal, presentation and scope

Entering stairs stays on that layer. Tap the current stair room to traverse; holding retains Scavenge. The destination stair becomes current/visited/searched, normal neighbor reveal runs, and room-entry effects run once. A fresh destination consumes a Coin/Bargain room charge normally; revisits do not. Hearts, Gold, FATE, Score, Shield, Ward, inventory, Vampire's Blood usage, Gate state, floor damage and Fortune remain shared. Only EXIT advances the floor and runs floor-start/end behavior.

Stair rooms have a stone-step fill, prominent ▲/▼, a quiet current-room pulse and attached GO UP/GO DOWN hint. Active map dimensions stay unchanged. Previously revealed inactive rooms/corridors are dimmed to 14%, blurred 3 px and scaled to 86%, aligned around the stair coordinate. Backgrounds are inert, aria-hidden, pointer-disabled and have no room listeners. Upward travel shrinks/fades the old map into the background; downward travel enlarges/fades it toward the viewer while the destination sharpens. Reduced motion skips transition animation and input delay.

Clues only target their active layer; Evil Eye remains derived from legitimate frontier reveal. Scavenge opportunities, markers and all room-owned state persist in either map. Perfect Floor still means all eligible generated rooms explored, now across both layers; locked/unentered Gate branches remain excluded. EXIT never requires Perfect Floor or optional interactions.

### Persistence and compatibility

Schema remains `saveVersion: 1`, key `dof.activeRun`. New fields are `floor.layers`, `floor.activeLayer`, room `layerId` and optional `stairTo`. Whole-floor serialization contains both grids, including inactive cells, generated content, fog and special states. EXIT layer is derived from `exitId`; stair direction is derived from destination height. Legacy 81-cell saves without layer metadata restore as one BASE without regeneration, rewards or room-entry hooks. Validation is independent of the currently loaded room count and checks layer identity, unique room identity, local links, paired coordinate-aligned stairs, active position and combined reachability.

Stair traversal uses the existing synchronous commit wrapper: destination identity and matching entry consequences commit together; then its safe snapshot is published. Closing during the CSS animation restores that destination, with no transition/gesture/route resumed. Auto-walk retains its per-hop checkpoints. Cache `dungeon-of-fate-v2.19-1` only updates assets; saves/learned flags are untouched.

### Tests and playtest risks

New `tests/layers-logic.cjs`: 4,000 seeded floors, generation probabilities, both directions/EXIT placements, 12–18-room secondary size, max two layers, aligned stairs, unique IDs, fog, caps, Gate-free reachability, horizontal-only paths and malformed-save rejection. Sample multilayer rates were 21.2–21.8% / 31.0–32.2% / 40.8–42.4%; 52.0% UPPER and 35.6% secondary EXIT.

New `tests/layers.cjs`: real pointer taps, both travel directions, no automatic traversal, transition interruption/reload, exact maps/effects, local Clues/Evil Eye, marker resolution, legacy save migration, secondary EXIT, inactive input, reduced motion and phone/landscape bounds. Existing Chest, persistence, auto-walk, Reroll, discovery, Fortune and gameplay/PWA suites are rerun. Existing graph tests now include vertical edges where testing whole-floor reachability.

**Balance observation:** normal floor event generation uses two Traps once per floor after the early-floor special case, not a per-room Trap chance. It is not doubled. Existing Gate branch risk still uses its normal Trap rule. Extra rooms do increase total Monster count under the unchanged density formula, and add 12–18 finite Scavenge rolls: at the unchanged 5% Trap band, approximately 0.6–0.9 additional potential Scavenge Traps if every added room is searched. Ordinary Treasure/Shrine budgets are shared, so rewards are spread across a larger area. No encounter/reward table was rebalanced.

Manual Android checks: update without reinstalling and Continue an old run; discover stairs without instructions; verify both vertical animations, legible hints, quiet background, reliable taps/holds and smooth device performance; close during either direction and Continue; revisit an Altar/Chest/Gate/marker across layers; verify item charges and once-per-floor effects; descend from secondary; repeat offline. Browser automation cannot establish real-device blur performance or whether uninstructed players understand the vertical imagery.

## V2.18.1 — Chest Placement Refinement

V2.18 already used one 30% spawn roll per eligible floor, not repeated rolls per terminal. Its uniform candidate selection included START-adjacent dead ends, making Chests feel like nearby free loot.

- One centralized **20%** roll after candidate filtering; maximum one Chest. No suitable terminal means no attempt.
- Candidates remain empty degree-one rooms, excluding START, EXIT, Gate branch rooms and the Gate parent. START-adjacent terminals are now excluded too. A non-endpoint leaf cannot lie on the required START-to-EXIT path.
- Existing BFS distance from START ranks candidates. Choose uniformly among terminals at the greatest distance or one edge closer. No corridors, room count, map bounds, or minimum three-room branch requirement changes.
- Loot remains 45% Consumable / 35% Trinket / 20% Mimic. Acquisition, combat and persistence are unchanged.
- Placement applies only to new floors. Schema remains 1; existing V2.18 floors, including nearby Chests, restore unchanged. Cache is `dungeon-of-fate-v2.18.1-1`; active-run storage is untouched.

Focused checks: `node tests/chest-placement.cjs` verifies single-roll semantics, filters, randomized top-distance selection, no-candidate fallback and unchanged topology on 300 floors. `tests/chests.cjs` exercises 1,500 seeded floors (268 Chests / 1,455 eligible floors = 18.4%), unchanged loot weights, interactions, Mimic Rerolls, replacement, and legacy nearby-Chest restore. Persistence, general/PWA, Reroll and Fortune logic suites are also run for this patch.

Manual phone checks: update the installed PWA without reinstalling, verify V2.18.1 and Continue preserves the old floor, then explore newly generated floors. Observe whether farther terminal placement feels worth the detour and assess frequency over many floors.

## V2.18 — Treasure Chests

Delta from current HEAD `b53939c` (V2.17.1). One optional Chest may be placed **after Fortune/Gate/Altar generation**, before finite Scavenge opportunities. `chestCandidates()` selects active **empty, degree-one rooms** excluding START, EXIT, Gate branch members and Gate attachment parents. A non-endpoint leaf cannot lie on a simple START → EXIT route. No topology is added or altered, and no Monster, Trap, reward, Altar or Gate room is overwritten. No eligible room means no Chest. `CHEST_SPAWN_CHANCE = 0.30` is applied once on eligible floors, including Floor 1; there is a hard one-Chest guard.

`CHEST_LOOT_WEIGHTS = {consumable: .45, trinket: .35, mimic: .20}`. Contents are selected during generation, never on OPEN. Items are uniform within the authoritative current registry: five Consumables/four Trinkets. For a Trinket Chest, a Consumable fallback is also preselected then; if the player already owns that Trinket when opening, the stored fallback is offered instead. No duplicate stacking, silent lost reward, new opening RNG, or ordinary Chest Gold. Mimic combat can still grant its existing normal Monster rewards.

Each Chest room stores:

```js
room.event = "chest";
room.chest = {
  kind: "consumable" | "trinket" | "mimic",
  itemId: /* registered item ID, null for Mimic */,
  fallbackItemId: /* registered Consumable for Trinket, otherwise null */,
  opened: false,
  cardSeen: false
};
```

First physical entry marks `cardSeen` and presents a Chest decision using the existing Item Card shell. OPEN is a dedicated accessible button; tapping outside leaves. Dismissal/revisit/auto-walk does not reopen it automatically. Tap the current room to reopen; hold retains Scavenge. Unopened discovered Chests use a central 🧰 container marker; opened markers dim. Hidden/frontier Chest content stays unknown and its hint is neutral, not a promise of safety. Evil Eye does not identify hidden Mimics.

OPEN sets `opened` once, closes the Chest card, and invokes the existing acquisition or Monster flow **within one persistence transaction**. Item rewards use the existing source-room sparkle/item reveal, Item Card and capacity/replacement choices. Mimics use `monsterKind: "basic"`, with a brief animated `🧰 → 👹` reveal and MIMIC title; they retain normal swipe, die, Heart damage, Shield/Doll/Blood/Horseshoe effects and hold-to-reroll. Room-entry protection stays active through the Chest decision and Mimic resolution (including the last Death's Bargain charge); dismissing an unopened Chest or taking its item ends that room-effect resolution normally. No new archetype, combat table or combat system is added. Mimic identity is derived from its opened Chest room when an encounter is restored.

Persistence schema remains **saveVersion 1**. Whole-room serialization already captures Chest state/content; validation now recognizes the event and validates placement, maximum count, content IDs, fallback and boolean state. `opened` means the Chest is consumed even when a reward choice or Mimic is still pending. Existing semantic item decisions/encounter saves retain the rest: restart cannot duplicate the item or select different content. An unopened Chest card itself is transient like Altar inspection: reopening the app restores the seen/unopened room, where tapping deliberately reopens it. Old active runs without Chest fields remain compatible and are not regenerated or given retroactive Chests. Normal completion/Perfect Floor semantics remain based on existing exploration rules, not opening optional content. Asset cache is `dungeon-of-fate-v2.18-1`; localStorage is untouched; Continue footer shows V2.18.

Added `tests/chests.cjs`: 1,500 generated floors validated (1,460 eligible; 405 Chests, 27.74% of eligible in this seeded sample), no required-path obstruction, fixed 45/35/20 selector boundaries, no-eligible fallback, first-show/dismiss/reopen, item source reveal and single-use rewards, both replacement flows, duplicate fallback, predetermined content reload, invalid IDs, and Mimic original/second-roll persistence plus hold reroll. Existing persistence, auto-walk, reroll and gameplay/PWA checks are rerun. Phone/landscape bounds are checked automatically.

Manual Android checks: update without reinstalling and Continue an older run; find a Chest naturally and assess terminal-branch temptation/frequency; dismiss, leave, return and reopen; confirm the container marker reads as a Chest and opened state is quiet; OPEN with a full inventory, close during the reveal/choice and resume; OPEN a Mimic, verify the chest-to-creature reveal, swipe and hold reroll, then close during either die animation. Check Shield/Doll protection and that neither reward nor Chest can repeat. Real-device icon appearance, touch comfort and OS termination remain manual checks.

## V2.17.1 — Reroll UX Refinement

Small UX-only delta from current HEAD `2060c16`. Reroll now requires a **650 ms hold**, matching the existing Altar's deliberate hold convention and sharing its `--charge` conic progress-ring CSS. Pointer capture keeps the whole gesture on the button. Early release, cancellation, blur, leaving its bounds or moving more than 14 px cancels; secondary contact cancels the active hold. Clicks are swallowed rather than activating or accepting. Enter/Space also requires holding. Tap outside still accepts through the existing continuation surface.

Reroll sits in a reserved **62 px slot below the consequence preview**, outside the die renderer. Appearing/hiding does not move the die or cover its face/result. FATE minimum/cost, 350 ms reveal delay, outcome tables, one-reroll/final rule and animation are unchanged.

Partial progress is runtime-only: hiding the control, restore/new run, window blur, hidden visibility or pagehide cancels it. Completion invokes the unchanged atomic reroll transaction; only then are FATE and the final reserved face committed. Save schema remains **1**, existing saves remain compatible, and no active-run storage is cleared. Build/footer is **V2.17.1**, asset cache `dungeon-of-fate-v2.17.1-1`.

Updated `tests/rerolls.cjs` exercises hold activation across all encounter paths, quick taps, early release, mouse/touch drag, multitouch, keyboard hold/cancel, interrupted-hold reload, layout separation/stability and existing protection/persistence cases. `tests/regression.cjs` expects the new cache. Persistence, auto-walk persistence, general gameplay/PWA regression and logic/syntax checks are rerun. On a real Android PWA, still check accidental taps, comfortable hold timing/ring readability, drag-out cancellation, portrait/landscape result visibility, and close/reopen both before and after hold completion. Verify V2.17.1 after updating without reinstalling.

## V2.17 — FATE Rerolls

Delta from current HEAD `6587ebb` (merged V2.16.3.1). Existing dice architecture reserves one d6 result in `pendingEncounter` before animation, waits for a screen-wide Monster swipe (Trap/Shrine animate automatically), then previously committed consequences on landing through `resolveDiceCore` plus the existing archetype/protection/reward wrapper. V2.17 changes the animation's completion to a **saved read-only preview**. The original resolution tables, Gold/FATE formulas, hooks, generation and auto-walk are unchanged.

### Rules and input

- Eligible: Guardian/basic Monster, Thief, Spirit, Trap and Shrine. Scavenge's hidden opportunity/random selection is **not** rerollable. A visible Trap die caused by Scavenge **is** eligible through the normal Trap encounter. Trap Ward disarms before a die/choice exists.
- `REROLL_MIN_FATE = 2`; no disabled control below the threshold.
- `REROLL_FATE_BURN = 0.25`: `after = max(1, round((1 + (before - 1) * 0.75) * 100) / 100)`. This is the existing two-decimal FATE rounding convention. `setFate(after, "sacrifice")` clears the hidden gain remainder according to the existing non-gain rule and uses reduction feedback, not FATE BREAK. Examples: 2 → 1.75; 3 → 2.50; 5 → 4.00; 10 → 7.75; 20 → 15.25.
- `REROLL_REVEAL_DELAY = 350` ms after consequence preview. The real button is absolutely centered over the existing die in a relative wrapper, so it does not reflow the card. It shows `REROLL` and `🎲 ✦×before → ×after` with two decimals matching the actual payment. The separate `ROLLED N` line and consequence remain readable.
- Tap anywhere outside Reroll accepts using the existing continuation surface; no Accept button. Acceptance calls the existing resolver once and returns through its normal continuation, or preserves the existing lethal-feedback beat.
- The button stops pointer/click propagation and keyboard bubbling. It hides/disables immediately, and semantic phase/used checks reject repeated activation. Keyboard Enter/Space works through native button activation. No gesture or animation progress is saved.
- Pressing Reroll reserves a new fair d6 in the same synchronous transaction as payment and rejecting the first outcome. The existing die animation plays again, without another combat swipe. The second preview is labeled FINAL and never offers another reroll, even for an identical or worse face. FATE never biases either roll.

### Preview and commit safety

`previewOutcome(type, roll, kind)` is a read-only projection of the existing tables and protections. It records projected HP, Shield, Gold, Score, FATE/remainder and a compact symbolic consequence. It does not run effect hooks or mutate gameplay. `revealOutcome`, `canReroll`, `rerollFateAfterCost`, `rerollOutcome` and `acceptOutcome` keep semantic decisions separate from the die renderer. Regression tests compare projected resources against the untouched resolver across every face, archetype and protection configuration; future table changes must keep this projection test passing.

Original results first become persistent at the existing encounter reservation checkpoint, before any dice animation/swipe. On reveal, `phase: "preview"`, the consequence and frozen cost offer are checkpointed. Tap acceptance commits through the existing synchronous transaction: consequence, Gold/FATE, protection, victory/perfect hooks, room resolution and continuation are saved together. No apply-and-undo rollback exists.

Golden Horseshoe and Vampire's Blood trigger only for an accepted result. Shield, Death's Bargain and Voodoo Doll are not consumed or invoked in preview. Rejected perfect results grant nothing. Accepted lethal results use normal protection/death handling; Doll rescue remains resumable. The final Spirit preview is calculated after the reroll cost, and acceptance uses that same post-payment current state.

### Persistence and compatibility

Storage stays `dof.activeRun`, **saveVersion 1**. This is a backward-compatible extension to `pending.encounter`, not a persistence rewrite:

```js
{
  type, roomId, monsterKind, roll,
  phase: "ready" | "preview" | "resolved",
  rerollUsed: false | true,                  // absent in old saves = unused
  preview: {after: {hp, shield, gold, score, combo, fateGainRemainder}, text},
  offer: null | {before, after},             // original preview only
  originalRoll, paid: {before, after}        // reserved/revealed second roll only
}
```

Preview/offer fields apply only to a preview. Already committed legacy `resolved` records retain their existing `result`/`detail` fields and do not gain a new decision. New fields are structurally/range validated; old `ready` and `resolved` records remain accepted. The offer's `before` must equal saved current FATE; payment also checks this at activation to avoid a stale displayed cost.

- Close during first animation: retain its reserved face.
- Close at original preview: restore the same face, consequence, resources and frozen offer; the visual 350ms entrance delay restarts.
- Close during second animation: payment and second face already exist together in the safe snapshot; Continue cannot refund payment, return to the original choice or reroll again.
- Close after acceptance: no consequence or item hook is replayed.

Continue reconstructs semantic UI, not timers. Existing V2.16.3/V2.16.3.1 schema-1 runs continue, including already committed encounter results. As before, storage-unavailable sessions cannot promise durable writes. No cache operation deletes localStorage or learned UX flags.

`GAME_VERSION = "2.17"` drives save build metadata, document title and the subtle `V2.17` Continue/New Run footer. Asset cache is `dungeon-of-fate-v2.17-1`. With existing `window.__DOF_DEBUG__` enabled, one console record at reroll payment reports encounter/archetype, original/final face and FATE before/after; no player analytics system is added.

### Verification and Android checklist

New `tests/rerolls.cjs` checks 180 table/protection projections, unchanged state during preview, original acceptance, exact minimum/cost examples, reveal delay, repeated activation prevention, each encounter's preview reload and second-animation reload, final acceptance once, rejected perfect effects, lethal Doll behavior, Ward bypass, old ready/resolved saves, keyboard activation, and phone/landscape button bounds/layout stability. Existing `tests/regression.cjs` updates version/cache assertions and checks that FATE gain waits for acceptance; `tests/exploration.cjs` accepts the Trap preview before asserting death. Existing persistence/auto-walk, item/relic and gameplay/PWA suites are rerun. No die art or animation assets are replaced.

Real installed Android PWA tests remain required; they have **not** been performed by this automated browser run:

1. Before deployment, leave an active V2.16.3.1 run saved. Deploy V2.17, reopen **without reinstalling**, verify footer V2.17 and exact run state. Find a new eligible encounter naturally.
2. Close/background during the original animation. Continue must retain that face.
3. At an original preview with Reroll visible, record face/consequence/FATE/cost, close/remove from recents, then Continue. All must match with no consequence applied.
4. Press Reroll, close during the second animation, reopen. FATE must stay spent, the second face must match, and no Reroll may return. Repeat after a worse/identical final result.
5. Rapid/double/multi-touch the control; confirm one payment and one roll, with no original acceptance or map input leak. Check native keyboard if used, portrait/landscape readability, and the 350ms beat without verbal instructions.
6. Accept original/final outcomes for all five paths, including Shield/Doll protection, rejected/accepted perfect rolls and Blood healing. Check Trap Ward bypass and a Scavenge-triggered Trap.
7. Recheck auto-walk/background checkpoints, Gate/Altar/❗, active Coin/Ward/Bargain state, death invalidation and offline restart. In-place deployment and OS process termination cannot be established by desktop Chromium alone.

## V2.16.3.1 — Auto-Walk Persistence Hotfix

Inspected current HEAD `a8b6982` (V2.16.3). Its hop callback already saved each visited room. The lifecycle handlers only flushed that snapshot: they left the route timer alive. If the browser kept running after background/pagehide, further hops could silently advance and overwrite the save. The eventual resume room depended on when the process actually stopped. A deterministic background test fails on V2.16.3 because auto-walk remains active.

The hotfix cancels the hop timer and increments its serial on hidden `visibilitychange` or `pagehide`, invalidating even callbacks already queued. It clears only transient auto-walk state, flushes the existing safe snapshot, and refreshes controls/context. Returning to the same live page also leaves travel stopped. The hop callback checks visibility before any movement in case notification delivery is delayed; travel cannot start while hidden.

Each hop remains a synchronous transition: verify visited connectivity/Gate access → assign `currentId` → notice finite room information → apply existing revisit effects → update history/move count and attention state → `saveRun()` refreshes the detached snapshot and writes it → arrival/map feedback → schedule the next hop. The checkpoint is now before arrival/render presentation. JavaScript lifecycle events cannot interleave this synchronous mutation; an event during the interval between hops flushes the previous completed hop. No visual position, target or remaining route is saved. Ordinary visited rooms and EXIT use exactly the same checkpoint boundary. EXIT arrival never descends.

No manual-movement, dice-result, balance, pathfinding, or save-schema changes. `saveVersion` remains **1**; existing V2.16.3 saves remain compatible. The active key remains `dof.activeRun`. Cache `dungeon-of-fate-v2.16.3.1-1` updates assets without clearing run storage. Timing remains **150 ms per room**, **400 ms for newly noticed ❗**. Auto-walk is visited-only, so Fortune Coin/Bargain new-entry charges do not decrement during it; per-room effect references and position still checkpoint together.

Tests: new `tests/auto-walk-persistence.cjs` controls only hop callbacks while exercising real gameplay/storage/rendering. It checks every boundary on a generated route, both lifecycle hooks, stale callbacks, exact save/restore including move/effect counters, normal completion, before/after EXIT, hidden timers, finite new/known ❗, Gate entry/low-FATE exit, and old-build compatibility. `tests/regression.cjs` updates its cache assertion. Existing persistence, exploration and general gameplay/PWA suites are rerun alongside script/manifest checks.

Android verification (still required on the real installed PWA): choose a visited route with several rooms ending at EXIT; activate Coin or Bargain if available. At different visible hops, press Home or remove the PWA from recents, wait, reopen and Continue. Verify the last committed room, matching move/effect state, no automatic continuation and no descent. Repeat before the first hop, immediately before/after EXIT, inside an entered Gate branch, and during a new ❗ emphasis. Also background and return without killing the process: the route must stay stopped and controls must work. Confirm a completed route resumes at its destination. A process killed without lifecycle delivery still relies on the existing per-hop synchronous autosaves; storage denial remains the existing platform limitation.

## V2.16.3 — Run Persistence

Local active-run persistence, with no gameplay balance changes. A valid save opens a primary **Continue** action and a **New Run** action requiring confirmation. No save starts immediately. Canceling New Run preserves the existing run and learned UX flags.

### Storage and authoritative schema

`dof.activeRun` contains readable JSON with `saveVersion: 1`; `gameVersion: "2.16.3"` is metadata, not a compatibility gate. Typical generated saves measured approximately **20–21 KB UTF-8** (roughly 40 KB as UTF-16 text). `__dofTest.serializeRun()` exposes the snapshot for diagnostics.

```js
{
  saveVersion: 1, gameVersion: "2.16.3", savedAt: /* epoch milliseconds */,
  status: "active",
  run: {
    hp, shield, gold, score, combo, fateGainRemainder, floorNo,
    totalMoves, perfectFloors, searched
  },
  floor: {
    rooms, startId, exitId, currentId, history, floorDamage,
    floorPerfectAwarded, floorFortune, fortuneBudget, fortuneUpgrades,
    floorEconomy, altarRoom
  },
  relicState: {
    trinkets, capacity, consumable, starterItem, starterInspected, floorUsed,
    bargainCharges, bargainRoom, coinCharges, coinRoom, wardArmed
  },
  fateGate: /* null or complete generated Gate object */,
  pending: {
    encounter: /* null or {type, roomId, monsterKind, roll, phase,
                            result?, detail?} */,
    cards: {active: /* discovery/decision item card or null */, queue: []}
  }
}
```

`rooms` retains the actual 81-cell floor, all generated coordinates/links/events/archetypes, reveal/visit/search/resolution flags, hints/Clues/Evil Eye flags, finite Scavenge opportunities and attention state, and Altar discovery/cardSeen/used state. Gate data retains `parentId`, `roomId`, `requirement`, `branchIds`, `reward`, `rewardRoomId`, `discovered`, `entered`, and `resolved`. No floor or branch regeneration occurs during Continue. `floorEconomy` and Fortune diagnostics are retained to preserve telemetry continuity. FATE and its fractional gain remainder retain their original numeric precision.

Ended runs use a small `{saveVersion, gameVersion, savedAt, status: "ended"}` tombstone. Existing learned `dof.*` flags remain separate. No profile, Codex, account, cloud, or meta-progression storage is added.

### Commit and randomness policy

A small persistence API (`serializeRun`, `saveRun`, `loadRun`, `restoreRun`, `clearRun`, `validateSave`, `migrateSave`) owns storage. Nested synchronous transactions publish one detached safe snapshot only after the outer action completes.

Autosave checkpoints cover:

- New Run and fully initialized new floors/descent.
- Manual room entry/search and each committed auto-walk hop.
- Simple events, Treasure/key rewards, Scavenge and consumed opportunities.
- Clue target/reveal commitment, before its delayed presentation.
- Encounter creation/result reservation, resolved consequences, and continuation.
- Trap Ward disarming, Consumable activation, and Altar opening/sacrifice.
- Item acquisition/card queue activation, replacement/rejection, inspection learning, and card dismissal.
- Perfect Floor award and finalized death.

Room-entry effects now commit synchronously instead of waiting for the former arrival timeout. Arrival/reward visuals remain presentation. Clue information likewise commits before its visual delay. These changes close restart windows without changing reward formulas or probabilities.

Each Monster/Thief/Ghost/Trap/Shrine reserves one fair die result when the encounter opens, before swipe/roll animation. Reload before resolution reconstructs the encounter with **that same reserved result**; visual dice frames are never saved. Once consequences finish, the safe save contains their final resources and a semantic resolved-result card. Continue displays that result without applying it again. Scavenge retains its generated opportunity roll, commits secondary outcome/item choice and consequences in one synchronous transaction, and cannot reroll a committed result. Before an encounter is entered/reserved, there is no die outcome to preserve.

Pending item replacement decisions and queued discovery descriptors are saved. An already acquired item restores directly to its information card without repeating acquisition hooks or its reveal animation. Fourth-Trinket and occupied-Consumable decisions reopen unchanged. `pendingItem` is derived from the active decision; capacity and duplicate rules stay intact. Altar inspection UI is omitted, while its discovered/cardSeen/used state is exact.

An interrupted auto-walk resumes at the latest committed room, with no destination jump or continuing animation. Real death writes the ended marker after protection resolution, before the visual lethal beat finishes. Voodoo Doll rescue instead saves the surviving run at one Heart, FATE ×1, with the Doll removed.

### Restore, validation, failures and lifecycle

Restore validates first, resets runtime input/animation state, assigns the saved run/floor/items/Gate directly, renders derived HUD/map/context, and reconstructs a pending encounter or item decision. It does not generate a floor, award resources, run acquisition/floor-start hooks, or consume room charges.

Not persisted: DOM, timers, gestures/pointer IDs, partial Hold rings, auto-walk paths, dice animation frames, particles, focus, CSS state, score animation, item acquisition animation, inspection-only cards, Altar card presentation, or `clueRevealUntil` (a performance-clock visual deadline). These are intentionally reset/rebuilt. No authoritative V2.16.2 gameplay state is intentionally discarded.

Validation checks schema/header, finite run values and valid ranges, floor number, 81 room identities, active positions, unique reciprocal adjacent links, graph connectivity and optional Gate reachability, registered events/archetypes/items, inventory capacity/uniqueness, effect charges/current-room references, opportunity/attention consistency, Gate boundary and 1–3 branch IDs, floor metadata, and semantic encounter/card fields. JSON is size-bounded before parsing. Compatibility flows through `migrateSave` then validation; only schema 1 currently exists, independent of compatible future game-version strings.

Invalid data is quarantined at `dof.activeRun.invalid` with raw bytes, time and reason before the active key is removed; startup remains usable. If quarantine cannot be written, persistence is blocked for that session to avoid overwriting the unbacked data. Storage exceptions produce at most one console warning and do not stop gameplay. Failed ended-marker writes attempt active-key removal. Device storage denial/clearing can still prevent recovery; this is local saving.

`visibilitychange` (hidden) and `pagehide` flush the **cached safe snapshot**, never an arbitrary live mutation. Autosaving does not depend on lifecycle delivery. Cache `dungeon-of-fate-v2.16.3-1` updates assets independently; service-worker updates never clear localStorage.

### Verification

Added `tests/persistence.cjs`: exact reload comparison, startup confirmation/cancel, reserved and resolved outcomes for all encounter types, finite Clues/Scavenge, pending replacements, inside-Gate restore/directional exit, unused/spent Altars, interrupted auto-walk, detached lifecycle flush, Doll/death, current-room effects/per-floor usage, duplicate Perfect Floor prevention, compatible build metadata, malformed/unsupported saves, invalid IDs, quota failure, and browser runtime errors. The phone Continue layout is screenshot-inspected.

Existing suites: `fortune-logic.cjs`, `fortune.cjs`, `active-fate.cjs`, `discovery.cjs`, `exploration.cjs`, `items.cjs`, `relics.cjs`, `regression.cjs`. Timing-dependent assertions now reflect synchronous committed entry and early die reservation; offline reloads choose Continue. Run browser suites with `PWA_BROWSER=/path/to/chromium node tests/<suite>.cjs`; the logic suite only needs Node.

Real Android installed-PWA testing remains required: Home/background, removal from recents, process termination/reopen, later restart, compatible deployment while a run exists, and offline launch. Repeat inside a Gate, during a roll/auto-walk, and during item replacement. Confirm the saved location/effects and no reroll/duplicate award; verify actual touch/focus behavior. Automated Chromium checks do not substitute for Android process-lifecycle testing.

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

## V2.20 — Card Framework & Codex

Presentation-only migration from current V2.19.1 gameplay. No encounter tables,
generation rules, inventory effects, movement checkpoints or reroll costs changed.

### UI audit and migration

| Existing presentation | V2.20 treatment |
| --- | --- |
| Trinket/Consumable discovery and inspection | Shared information card; existing source → item reveal retained |
| Guardian, Thief, Spirit, Mimic | Shared persistent dice card; intro/swipe → rolling → preview → optional held Reroll |
| Trap and Shrine | Same dice template, existing automatic roll and Ward handling |
| Altar and Chest | Choice template; one hold exchange / OPEN action; backdrop leaves |
| Fourth Trinket | Choice template; inventory radio selection + one REPLACE action; backdrop rejects |
| Held Consumable replacement | Choice template; one replacement action; backdrop keeps current item |
| Scavenge item discovery | Existing acquisition queue into shared item card |
| Scavenge numeric results, Treasure, Clues, Gold/HP/FATE, protection procs | Existing lightweight feedback; no new cards |
| Gate, stairs, attention markers, layers | Existing map interactions and transitions |
| Startup/run-over | Existing utility panels; small Codex access added |

`frameCard()` provides the shared outer frame, category crest, first-discovery badge
and `data-template` (`info`, `dice`, `choice`). CSS centrally lays out regions;
existing semantic card/encounter state and event handlers remain authoritative.
The same encounter DOM remains throughout rolling, preview and reroll. The die
renderer has its own region; the single Reroll control remains below the result.
Card interiors do not dismiss. Backdrop gestures dismiss/decline or accept the
pending result. Existing keyboard continuation and hold-to-Reroll remain.

`card_frame.png` is the supplied **unchanged 880×1214 asset** (Git blob
`3964fda67017706fbcc287183e2e5c130e5314b5`). It is a responsive portrait background,
not baked text/art. The artwork safe window is **80% width × 48% height**, approximately
**704×583 px (1.21:1)** at source resolution, starting at 10% x / 21% y.
Current icons are centered inside it. Dice/action templates reclaim some artwork
space for interaction; final artwork is not introduced. Cards use no backdrop blur.
The frame is in the offline shell cache, now `dungeon-of-fate-v2.20-1`.

### Registry and discovery

`CARD_REGISTRY` records stable ID, category, display name, icon, description and
symbolic effect. Item metadata references current item definitions rather than
copying gameplay implementation. It contains **15 current playable entries**:

- Creatures: Guardian, Thief, Spirit, Mimic.
- Items: Voodoo Doll, Vampire's Blood, Evil Eye, Golden Horseshoe; Fortune Coin,
  Trap Ward, Healing Flask, Divine Charm, Death's Bargain.
- Hazards: Trap.
- Discoveries: Shrine.

Chest/Altar use shared presentation but do not inflate collection completion.
Neither EXIT, stairs nor Gates are collectible entries.

Discoveries occur at actual encounter presentation, item acquisition/presentation,
or owned-item inspection. Starter Consumables count as acquired. Mimic unlocks
only after opening its Chest. Generation never unlocks entries. Restoring an older
save imports only its held/equipped items and the current pending encounter, not
unexplored generated contents. NEW is a presentation badge, never another modal.

Codex uses **`dof.codex`**, independent of `dof.activeRun` and learned UX flags:
`{version:1, discovered:{"category:id": firstDiscoveryTimestamp}}`.
Loading validates the container, known IDs and finite timestamps. Storage errors
are caught with one console warning; the session collection remains usable.
Death, New Run, save invalidation and service-worker updates never clear Codex.
Active-run saveVersion remains **1**, without additional visual state.

Access is in the existing footer and startup/result panels. Category filters and
2–3-column miniatures keep full text out of the browser. Unknown tiles expose only
`? / ???` and cannot open. Details are read-only, use the same frame and close via
backdrop/Escape; no item activation or gameplay hook runs from Codex.

### Verification and phone follow-up

`tests/cards-codex.cjs` covers current-entry count, generation privacy, discovery,
unknown/detail behavior, one action, card/backdrop isolation, replacement,
meta survival across death/New Run/reload, frame asset and mobile bounds.
Existing input assertions now use the specified backdrop acceptance/dismissal;
Trinket replacement tests select a radio then confirm. Existing pending-result,
held Reroll, item, Chest/Mimic, layer and movement persistence checks remain.

Physical Android/PWA testing is still needed for real emoji rendering, the supplied
frame's visual weight, outside-tap comfort, long descriptions, and repeated
encounter → roll → result flow. Small landscape is the densest layout: descriptions
and replacement slots merit particular review there. It keeps the die at least
72px and action targets at least 44px, with no ordinary gameplay page scroll.
Also test updating an installed older build without reinstalling, then force-close
at original/final dice results and pending item replacement; verify the same run
and independent Codex discoveries return. No device-performance claim is made
from desktop Chromium alone.

Automated verification for this patch passed: `cards-codex`, `rerolls`,
`persistence`, `auto-walk-persistence`, `items`, `relics`, `chests`,
`chest-placement`, `active-fate`, `discovery`, `exploration`, `layers`,
`layers-logic`, `layer-performance`, `fortune-logic`, and `regression`.
This includes 180 preview/commit table cases, 4,000 layer-generation cases,
real service-worker offline reloads, and zero mid-transition DOM mutations/layout
in the existing Chromium layer-performance probe. Browser suites use Playwright;
set `PWA_BROWSER` to an installed Chromium executable when needed.

## V2.20.1 — Dynamic modular card frame

Rendering-only follow-up to V2.20. Registry, Codex, discovery, one-action and
backdrop rules, hold-to-Reroll, pending decisions, and save schemas are unchanged.

### Supplied assets audited

| Asset in `assets/` | Dimensions | Use |
| --- | --- | --- |
| `card_outer_frame.png` | 1038×1536 RGBA | Fixed outer overlay including its existing crest |
| `card_artwork_frame_9slice.png` | 884×740 RGBA | Resizable aperture's CSS border-image |
| `card_interior_texture.png` | 504×240 opaque | Textured card surface and artwork placeholder background |
| `card_crest.png` | 264×220 RGBA | Inspected, not layered again: outer already includes crest |
| `card_reference_transparent.png` | 1038×1536 RGBA | Reference only, not a second gameplay layer |
| `README.txt` | — | Supplied assembly/transparency instructions |

All supplied files are unchanged. Inspection found that the named outer asset
still includes the old inner aperture border and surface. A fixed CSS polygon
clips its center (7–93% x, 15–94% y), preserving the crest and perimeter while
preventing a second, immovable aperture from appearing. Near-black transparency
was derived in the supplied exports; desktop browser inspection showed no obvious
exterior halo requiring repainting. Physical-device edge checks remain necessary.

`frameCard()` creates one `.cardArtwork > .cardArtClip` pair per card and reparents
its existing icon once. Reusing/transitioning the card never rebuilds this pair.
The texture is behind it; a pointer-transparent outer overlay is above content.
Cards match the new outer asset's native **1038:1536** silhouette without stretching.
Codex miniatures retain the cheaper V2.20 flattened image; full details use modules.

- Large aperture: **80% card width × 46% height**, x=10%, y=21%; used by information,
  item, Codex detail and Monster introduction. At source scale: ~830×707 (~1.17:1).
- Dice compact aperture: **80% × 13%**, same origin. Existing removal of
  `awaiting-swipe` contracts it as the roll starts; Trap/Shrine start compact.
- Choice aperture: **80% × 22%**. At viewport heights ≤480px it uses **14% height**,
  y=19%, to prioritize replacement options.
- Border-image: **80 source pixels per side**, no center fill, `stretch` edges;
  displayed corner/border thickness `clamp(12px,5cqw,21px)` (12px in short layouts,
  10px for short dice layouts). Thickness is independent of aperture height.
- Only aperture height transitions, **180ms ease-out**, with contained local
  layout. No JS animation loop, geometry reads, filters or full-card reflow.
  Reduced motion disables this transition. Image/video art uses `object-fit:cover`
  and clipping; current icons retain their proportions.
- The existing die stays at least 72px. Reroll is anchored 7% above the card bottom;
  no second action is introduced. Short-landscape choices get ≥60px selection
  rows, a distinct selected border and a separate ≥44px confirmation target.

New `tests/modular-cards.cjs` verifies stable outer bounds, large/compact sizes,
unchanged slice/corner width and DOM nodes, die space, information/Codex art,
landscape selection/confirmation separation and reduced motion at 320×568,
390×844 and 844×390. V2.20 tests only change build/cache and frame assertions.
The three runtime modules are precached in `dungeon-of-fate-v2.20.1-1`;
`dof.activeRun` and `dof.codex` are never cleared.

Phone follow-up: inspect large item/intro art, swipe contraction, result/Reroll,
Codex detail and landscape replacements; watch for texture seams, transparency
halos, corner distortion, cropping and frame clipping. Confirm installed-PWA
update/offline behavior and retained run/Codex data. Desktop checks cannot certify
physical-device animation smoothness.

Verification: all 16 V2.20 targeted suites plus `modular-cards` passed (17 suites),
including 180 preview/commit encounter cases, 4,000 generated multilayer floors,
Codex discovery/storage, replacement decisions, pending dice and movement saves,
real offline service-worker launch and the unchanged layer-performance probe.
Screenshot review covered portrait and landscape; no ordinary card scrolling or
runtime errors were observed in these checks.

## V2.20.2 — Encounter resolution layout & hold-to-open

The V2.20.1 aperture was being compressed to fit the die, preview and action
inside the same physical card. Encounter resolution now occupies a separate
sibling region, while the modular card remains intact.

- `#encounterTransform` wraps the existing physical `.encounterPanel`;
  `#encounterResolution` owns the existing die, result, consequence, Reroll and
  continuation hint. These nodes are not reconstructed on phase changes.
- Every new dice encounter reveals a full centered card with a **46%-height**
  artwork aperture. Monsters retain swipe initiation. Trap/Shrine keep this
  reveal for **600 ms** before their automatic roll; Ward still disarms before
  a die decision. Reserved gameplay outcomes are generated/saved exactly as before.
- Resolution translates/scales the entire wrapper upward over **220 ms ease-out**.
  Only transform animates; resolution opacity takes **160 ms**. There is no blur
  or frame-by-frame layout code. Reduced motion disables both transitions.
- Layout samples viewport, safe-area padding, HUD bottom and resolution height on
  showing/resizing the encounter and presenting a preview. Top clearance is the
  greater of safe-area padding and HUD bottom +8px. Reduced card height is capped
  at 62% of its full height and 280px, then limited by available resolution space.
  It leaves 10px between card and resolution, reserving at least 300px in portrait
  or 210px on short screens, or measured resolution height +16px if larger.
- Die size is **104px**, **80px** at viewport heights ≤480px, and **72px** at
  heights ≤360px. Actions stay ≥44px. At the shortest landscape size the card
  becomes a small identity thumbnail so resolution remains readable and reachable.
- Pending previews and final rerolls restore directly in resolution presentation.
  Rerolls keep the reduced card in place. Card touches remain isolated; tapping
  the surrounding resolution/backdrop accepts the shown pending result. The held
  Reroll control consumes its own input and never accepts the rejected outcome.
- Item, discovery, Codex and action templates keep their existing centered modular
  composition and type-specific dynamic artwork sizes. No tilt is implemented;
  the whole-card wrapper leaves a clean transform boundary for future rotation.

Chest OPEN now requires **650 ms**, using the same `animateDecisionHold` progress
helper, `--charge` ring styling and duration as Reroll. Tap, early release, movement
outside the button or >14px, cancellation, focus loss, multi-touch, backgrounding
and reset cancel progress. Enter/Space support the same held interaction. The
existing `openChest()` committed transaction is called only on completion; content,
loot, inventory and Mimic behavior are unchanged. Canceled input does not dismiss
or reach the backdrop. No partial hold is saved. Existing reload semantics remain:
an unopened discovered Chest stays available on the map for intentional reopening.

Focused tests in `modular-cards` and `chests` cover full Trap/Shrine reveal,
proportional upward transforms, stable artwork/frame nodes, separate resolution,
320×568 / 390×844 / 844×390 / 568×320 layouts, hold cancellation, multi-touch,
keyboard activation, lifecycle interruption, one-time rewards and Mimic rerolls.
Existing Codex/Reroll tests use the relocated resolution surface and current build.
Cache is `dungeon-of-fate-v2.20.2-1`; active-run schema 1 and `dof.codex` are unchanged.

Physical phone follow-up: full reveal → upward movement, Trap/Shrine recognition,
long consequence wrapping, Reroll reachability, short-landscape thumbnail clarity,
rapid Chest touch/cancel/hold, installed-PWA update, and force-close before/after
opening or rerolling. Desktop screenshots/tests cannot certify device smoothness.

Automated result: all 17 targeted suites passed, including 180 encounter
preview/commit cases, 4,000 generated multilayer floors, pending dice and Reroll
reloads, inventory decisions, Codex storage, per-hop auto-walk persistence, Chest
hold/reward safety, layer performance and actual service-worker offline launch.
No runtime errors were observed in these runs.

### V2.20.3 — Shrine distribution and Death screen

- `shrineAllowed` enforces one Shrine per layer during ordinary assignment,
  Fortune candidate selection, and Gate reward selection. Previously a natural
  Shrine, a Fortune bonus, and a separate Gate floor limit could overlap on one
  layer. Fortune still has its existing one-bonus-per-floor limit and budget;
  blocked Gate Shrine rewards use the existing Treasure fallback.
- Fortune candidates and Gate reward-room candidates prefer a different x/y
  from the other layer's Shrine, with a fallback when no alternative exists.
- This is a cap, with no new fill pass or spawn roll. Audit caveat: the existing
  ordinary event list includes one Shrine whenever enough candidates exist.
  Normal generated floors therefore still have that natural Shrine; making
  zero-Shrine normal floors probabilistic would require a separate spawn-rule
  change. Empty layers and undersized candidate sets receive no forced Shrine.
- Removed only the Death-screen Codex entry. Footer/start access and meta storage
  remain intact. V2.20.2 encounter layout and hold interactions are untouched.
- Save schema remains 1. Previously generated floors (including multiple Shrines
  on a layer) remain valid and are never normalized on restore. Cache updates
  affect assets only, not active-run or Codex storage.
- Focused coverage: 4,000 seeded floors across eight depths at low/high FATE,
  layer caps, Fortune/Gate fallback, coordinate preference/fallback, no fill
  quota, legacy save validation, Death → New Run and Codex survival.
- Physical-device follow-up: update without reinstalling, Continue an old run,
  explore new single/multilayer floors, then verify Death → New Run and normal
  Codex access. Confirm encounter/Reroll and Chest hold presentation remains as
  in V2.20.2.
- Validation result: all 19 suites passed (the 17 existing targeted suites,
  browser Fortune checks, and the new Shrine fixture suite). Discovery's
  timing-sensitive 240 ms hold-ring assertion failed once under concurrent
  browser load and passed unchanged on retry. `git diff --check` passed.
