# 0003. Zustand with localStorage persistence

Status: Accepted (reverse-engineered)

## Context
Saved plans must survive reloads without a backend, and the state shape has evolved.

## Decision
Keep saved items in a Zustand store using `persist` (key `coach-saved-plans`). A custom `merge` runs every loaded item through `normalizeSavedItem`. Edits regenerate the plan's slots via `regenSlots`.

## Consequences
- Minimal boilerplate and no provider tree.
- Schema changes are handled by tolerant normalisation, not versioned migrations. Old shapes (such as legacy `midSwap` on slots) must keep being handled.
- localStorage size limits apply.
