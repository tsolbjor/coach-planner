# 0001. Client-only PWA with no backend

Status: Accepted (reverse-engineered)

## Context
Coaches use the app on a phone at the pitch, often with poor connectivity. Plans contain no data that needs server-side processing.

## Decision
Ship a static React + Vite app as an installable PWA (`vite-plugin-pwa`, `registerType: 'autoUpdate'`, standalone display). No server, accounts or database.

## Consequences
- Works offline and is trivial to host statically (`VITE_BASE` supports subpaths).
- No cross-device sync; sharing is handled by [0005](0005-share-via-compressed-url.md).
- Data is per browser; clearing storage loses plans.
