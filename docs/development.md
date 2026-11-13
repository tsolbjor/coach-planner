# Development

```bash
npm install
npm run dev         # dev server
npm test            # vitest, once
npm run test:watch
npm run build       # tsc -b && vite build
npm run preview
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run build`, and `npm test` on Node 20 for pushes to `main` and for pull requests.

Tests sit in `__tests__` folders next to the code. The scheduler has the most coverage (`src/scheduler/__tests__`, with shared `fixtures.ts`).

Set `VITE_BASE` (e.g. `/coach-planner/`) when building for a subpath deployment.

## Writing ADRs

Copy [adr/0000-template.md](adr/0000-template.md), use the next number, and add it to the [index](adr/README.md). Don't edit accepted ADRs; supersede them with a new one.
