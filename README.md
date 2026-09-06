# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.

## V2.13 — Interaction & Visual Language

Room feedback uses a compact stack. Clues pulse at the identified room and retain a true tendency marker without revealing the exact event. Swipe across a monster card to begin its battle roll; gesture direction, speed, and distance do not change the outcome. Keyboard users can focus the card and press Enter or Space. Traps and shrines still roll automatically, and map holds retain their existing actions.

## Regression checks

With Node.js and Playwright available, run `node tests/regression.cjs`. Install Playwright's Chromium with `npx playwright install chromium`, or set `PWA_BROWSER` to an existing Chromium/Edge executable. The test starts its own local server and checks phone/landscape layout, feedback bounds, clues, pointer and touch combat, map holds, rewards, shields, and real offline launches.

## Install and play

Serve this folder over HTTPS (or localhost for development), open the game, then use your browser's Install app or Add to Home Screen option. Launch the installed icon for fullscreen play where supported; other browsers fall back to their supported app display mode.

After the first successful online load and service worker installation, the game can launch offline. This caches the game files, not an in-progress run. New service worker versions activate after existing game windows close. Bump the cache version in `sw.js` when changing cached files.
