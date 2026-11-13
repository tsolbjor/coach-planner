# 0006. Locked history and pins constrain regeneration

Status: Accepted (reverse-engineered)

## Context
Coaches adjust plans mid-match: players go absent, substitutions are overridden. Already-played time must not change.

## Decision
Plans are regenerated from inputs. User overrides are stored as `pins` per interval; played intervals are stored as `lockedSlots`, an exact contiguous prefix that the scheduler copies through unchanged and rejects (with an `invalid-input` warning) if its timing no longer matches the configuration. When players become absent after history exists, `regenSlots` converts future pins into required field/bench constraints.

## Consequences
- Plans stay consistent with what actually happened.
- Changing period or stint configuration after play starts is not allowed.
- Pins and locks add validation and conflict-warning logic (`lock-conflict`).
