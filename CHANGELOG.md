# Changelog

All notable changes to the public Cortex Contracts distribution are recorded
here. Canonical authoring history remains in the Cortex repository.

## 0.4.0 - 2026-08-13

- Added `parity-operands.schema.json`: the two values a box compared to decide
  `deploy_parity.match`, published under the health payload's `extra`. Three
  boxes had grown this object independently with six `basis` strings for two
  concepts, three meanings for `complete`, a `verdict` that folded in working
  tree cleanliness in one box but not the others, and one box comparing commit
  SHAs by prefix. The schema is normative on all four, and its test carries the
  cross-field rules the schema language cannot state so a producer that
  regresses fails CI instead of publishing a boolean nobody can trust.
- Working tree cleanliness moves to its own `tree_clean` field; a verdict now
  means operand equality and nothing else.

## 0.3.0 - 2026-08-01

- Added canonical root-conversation, parent-session, memory-scope, dynamic
  project, budget, artifact, and policy-attestation fields to task intake.
- Preserved policy identity and artifact references on execution receipts.
- Aligned TaskEnvelope with supervisory lineage and policy metadata.
- Updated package loaders and integrity tests for the 0.3.0 surface.
- Exported the reviewed contract tree from Cortex commit
  `091cd2532f8f462b68fd986fdbcbc444dbdb44c2`.

## 0.2.0 - 2026-07-21

- Moved all canonical schema identifiers to the owned
  `https://schemas.this.live/cortex/` domain.
- Preserved the historical `https://cortex.dev/schemas/` strings as loader
  aliases while always returning canonical identifiers.
- Published zero-runtime-dependency JavaScript and Python loaders.
- Added MIT licensing, package-integrity tests, clean-install release probes,
  and SHA-256 manifests.
- Exported the reviewed contract tree from Cortex commit
  `896e69256cf94d601214c5daf6d388623703652a`.
