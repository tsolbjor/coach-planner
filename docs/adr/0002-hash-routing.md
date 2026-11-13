# 0002. Hash-based routing

Status: Accepted (reverse-engineered)

## Context
The app is hosted statically, possibly under a subpath, with no server rewrite rules.

## Decision
Use `createHashRouter`. Routes are `#/`, `#/import`, `#/plan/:id`. The help modal is driven by a `?help=1` query parameter.

## Consequences
- Deep links and reloads work on any static host.
- Share links can carry data in the hash fragment, which is never sent to a server.
- URLs are less pretty.
