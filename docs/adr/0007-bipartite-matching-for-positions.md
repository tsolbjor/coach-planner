# 0007. Separate rotation from position assignment, using bipartite matching

Status: Accepted (reverse-engineered)

## Context
Fairness (equal pitch time) and position suitability are different problems. Solving both at once would be complex.

## Decision
`rotationSolver` decides who is keeper, on the field or on the bench per interval. `positionOverlay` then maps field players to lineup slots with `maxMatch`, a maximum bipartite matching using augmenting paths. It accepts a preferred player per slot for continuity. `TimeSlot.positions` is a derived overlay for display.

## Consequences
- Each stage is simple to test and reason about.
- Positions can't influence who is selected, so a rotation may produce an `position-unavailable` warning.
- Input order determines tiebreaks, so results stay deterministic.
