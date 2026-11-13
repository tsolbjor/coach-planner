# 0004. Pure, framework-free scheduler module

Status: Accepted (reverse-engineered)

## Context
Rotation planning is the core of the product and has many edge cases (keepers, absences, bench limits, pins).

## Decision
Keep it in `src/scheduler` as plain TypeScript with one entry point, `generatePlan(input): { slots, warnings }`. It takes no React or store dependencies and is deterministic. Bad input and infeasible requests yield `warnings` (typed `SchedulerWarningKind`) rather than exceptions.

## Consequences
- Easy to unit test with fixtures (`src/scheduler/__tests__`).
- The UI can always render a result and show warnings.
- Callers must check warnings instead of catching errors.
