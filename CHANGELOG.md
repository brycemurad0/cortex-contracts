# Changelog

All notable changes to the public Cortex Contracts distribution are recorded
here. Canonical authoring history remains in the Cortex repository.

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
