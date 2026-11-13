# 0005. Share plans via compressed URL

Status: Accepted (reverse-engineered)

## Context
With no backend ([0001](0001-client-only-pwa.md)), coaches still need to send a plan to another person.

## Decision
Serialise the `MatchPlan` to JSON, compress it with `lz-string` (`compressToEncodedURIComponent`) and embed it as `#/import?plan=...`. `ImportPage` decodes it and saves a new plan. Player names are stripped or handled separately from the stored shape where applicable.

## Consequences
- No infrastructure and no stored data to protect.
- Very large plans produce long URLs.
- Imported data is untrusted input; decoding failures are reported as an invalid link.
