# Dungeon of Fate

Dungeon of Fate is a mobile-friendly procedural dungeon game prototype focused on risk/reward exploration, FATE, Scavenge, Fast Travel, dice encounters, and treasure.

## Status

Active prototype.

## Install and play

Serve this folder over HTTPS (or localhost for development), open the game, then use your browser's Install app or Add to Home Screen option. Launch the installed icon for fullscreen play where supported; other browsers fall back to their supported app display mode.

After the first successful online load and service worker installation, the game can launch offline. This caches the game files, not an in-progress run. New service worker versions activate after existing game windows close. Bump the cache version in `sw.js` when changing cached files.
