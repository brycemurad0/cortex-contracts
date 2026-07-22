# Cortex Contracts

This is the public, MIT-licensed distribution of the shared Cortex JSON Schema
contracts. Contracts are authored and reviewed in the canonical `cortex`
repository, then exported here as an exact, provenance-stamped release so every
box can install them without a private sibling checkout or a cross-repository
credential.

Install immutable v0.2.0 assets:

```sh
npm install https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-v0.2.0/cortex-contracts-0.2.0.tgz
pip install https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-v0.2.0/cortex_contracts-0.2.0-py3-none-any.whl
```

Schema identifiers use `https://schemas.this.live/cortex/`. Historical
`https://cortex.dev/schemas/` identifiers remain loader aliases only.

See [`PROVENANCE.md`](PROVENANCE.md) for the canonical source commit and
release verification. No consumer should redefine a canonical shape or depend
on a sibling checkout.

## Ratified

| Contract | Files | Consumed by |
|---|---|---|
| **TaskEnvelope** | `task-envelope.ts`, `task-envelope.schema.json` | Agent Fabric canonical task lifecycle and every task-producing surface |
| **ExecutionReceipt** (v1) | `execution-receipt.ts`, `execution-receipt.schema.json` | Agent Fabric receipt/event APIs, Maestro quality labels, Forge evidence harvest, and all surface consumers. Ratified to **v1** by ADR-0017 (see note below). |

The TaskEnvelope is the universal task contract: every task — regardless of executing agent —
is one of these. Adapters translate it per-agent; nothing downstream invents its own shape.
Keep the `.ts` and `.schema.json` in sync, and aligned with the `orchestration_tasks` table
in `agent-fabric/orchestration/db/migrations/`.

## Forge-owned (imported by Maestro + spine)

Per Cortex ADR-0019 §1-2, Forge
owns the discipline/domain registry. The schema lives in the Forge repo; Maestro and
Agent Fabric import it. **Cortex does not author or re-home it** — this README is the
one-line registration pointer. The lane (discipline) is the canonical routing axis
(ADR-0019 §3); persona verticals are expressed as compositions in
`forge/agents/verticals/vertical_composition.yaml`, NOT as competing keys in this registry.

| Schema | Source | Consumed by | Status |
|---|---|---|---|
| **AdapterRegistry** (v1) | `forge/adapter-factory/schemas/adapter-registry.v1.json` | Maestro `:8003` routing and Agent Fabric discipline assignment | v1 ratified 2026-06-03; Forge commit `cd5363d`; 8 adapters, 8 `routing.discipline_key` values matching `domain`; `adapter_alias: null` until promotion (enforced mechanically by the registry, not the schema); companion `vertical_composition.yaml` is the only place verticals appear as keys |

## Drafts (v0 — not yet binding)

Authored against the local backtest reconciliation. Stable enough for the
slimmed Agent Fabric and sibling boxes to consume; `$id` is `*.v0.json`, and changes
do **not** require an ADR until promoted to ratified. **Every Draft below is authored on
disk AND has a round-trip test** in `contracts/tests/` (registered in `run-all-tests.js`) —
the "Tests" column is the evidence. The 5 backtest contracts (WorkRequest …
NightCrewWorkPack) and the RefinePunchup pair were carried under "Planned" through
2026-06-04 despite being authored + tested (conformance-audit findings F-1/F-2); they are
moved here 2026-06-11 to make this table match disk reality.

| Contract | Files | Tests | Replaces / Closes |
|---|---|---|---|
| **RouteDecision** | `route-decision.ts`, `route-decision.schema.json` | `tests/route-decision.test.js` (23) | Today's ad-hoc `_maestro` block on Maestro `/v1/chat/completions` responses (`maestro/maestro/api/server.py`). Closes `docs/plans/maestro.md` §4 gap. Join target for `ExecutionReceipt.decision_id`. |
| **WorkRequest** | `work-request.ts`, `work-request.schema.json` | `tests/work-request.test.js` (6) | The Pocket-Agent `/cortex/enqueue` handoff shape (pre-`TaskEnqueueRequest`). |
| **VerificationEvidence** | `verification-evidence.ts`, `verification-evidence.schema.json` | `tests/verification-evidence.test.js` (6) | The grader's evidence shape on the spine grade step. |
| **LearningTrace** | `learning-trace.ts`, `learning-trace.schema.json` | `tests/learning-trace.test.js` (8) | The Maestro→Forge learning-loop record. |
| **TrainingDataCandidate** | `training-data-candidate.ts`, `training-data-candidate.schema.json` | `tests/training-data-candidate.test.js` (8) | The Forge label-harvest candidate row. |
| **NightCrewWorkPack** | `nightcrew-work-pack.ts`, `nightcrew-work-pack.schema.json` | `tests/nightcrew-work-pack.test.js` (7) | The NightCrew background read-only loop work unit (ADR-0010). |
| **RefinePunchupRequest / Response** | `refine-punchup-request.{ts,schema.json}`, `refine-punchup-response.{ts,schema.json}` | `tests/refine-punchup.test.js` (14) | The `cortex.refine.punchup` surface→spine punch-up call (W2 P0 lane). Consumed (not redefined) by surfaces `punchup-spine.mjs`. |
| **TaskEnqueueRequest** | `task-enqueue-request.ts`, `task-enqueue-request.schema.json` | `tests/task-enqueue-request.test.js` (9) | The surface→agent-fabric intake shape (Suite Link §4.1) consumed by `POST /cortex/enqueue`. Added 2026-06-10 (AF-WS6). |
| **TrainingLabel** | `training-label.ts`, `training-label.schema.json` | `tests/training-label.test.js` (17) | The raw `quality_labels` row the flywheel writes and Forge's harvest reads, with optional `provenance` so a grounded label survives Forge's curate gate. Added 2026-06-22 (ADR-0025). |
| **CortexModelRegistration** | `cortex-model-registration.ts`, `cortex-model-registration.schema.json` | `tests/cortex-model-registration.test.js` (15) | The Forge→Maestro egress: register a served, eval-beating adapter so Maestro routes it local-first (`POST /v1/models/register`). Added 2026-06-22 (ADR-0025). |

> **ExecutionReceipt promoted to v1 (2026-05-31, ADR-0017).** The v0 draft over-constrained the
> shape: every field `required` + `additionalProperties:false`, which forbade BOTH the optional
> `dispatch` block AND any Hermes tracked-bypass / surface-direct receipt (those have no
> `af_dispatch_id`/`af_worker_session_id`). v1 makes the orchestration-join fields optional so **one
> shape covers three producers** (spine-orchestrated, Hermes-bypass, surface-direct) and defines
> `receipt_id` as a **client-generated idempotency key** (stable across outbox retries) so
> dedupe-by-`receipt_id` is safe. The live `agent-fabric` `POST /receipts` still accepts a legacy
> 7-field body (`task_id, worker_session_id, status, summary, changed_files, commands_run,
> artifacts`); converging the handler to v1 is agent-fabric build step 1 (the "freeze the contract"
> gate). See `docs/handoff-followup/2026-05-31-cortex-audit-and-doc-reconciliation.md`.

## Planned (author here as each is needed)

ForgeExecutionPlan, SourceRecord, LabManifest, EvalManifest, ArtifactPointer,
NodeCapability, AgentCapability, ModelCapability, DeploymentHarnessManifest,
MorningBrief.

> WorkRequest, VerificationEvidence, LearningTrace, TrainingDataCandidate, and
> NightCrewWorkPack were moved out of this list to **Drafts (v0)** on 2026-06-11 — all
> five are authored on disk and have round-trip tests, so listing them as Planned was
> stale (conformance-audit F-1). The list above is the genuinely-unauthored remainder.

> **⚠️ Verify-on-LAN before authoring.** Some of the genuinely-unauthored names above (e.g.
> `SourceRecord`, the `*Capability` family, `DeploymentHarnessManifest`) may be referenced by
> NAS/Sparky/tailnet-only code that the local audit cannot see — a schema may already exist on
> the fleet. The rule (per `docs/handoff-followup/2026-05-31-cortex-audit-and-doc-reconciliation.md`):
> **confirm absence on LAN first, then author here once** (never redefine a shape that already exists
> on the fleet — that would re-introduce the drift this canon exists to prevent). The 5 contracts that
> *were* under this caveat (WorkRequest, VerificationEvidence, LearningTrace, TrainingDataCandidate)
> are now authored + tested and live in **Drafts (v0)** above.

## Conventions

- Every contract ships both a TypeScript type and a JSON Schema (draft-07) with the same shape.
- Every contract has a round-trip test in `contracts/tests/`, registered in
  `run-all-tests.js`. The runner also verifies package metadata, owned-domain
  identifiers, loader compatibility, and release cleanliness; run it with
  `npm test` from `contracts/`.
- The `$id` carries an explicit version suffix (`<name>.vN.json`); breaking changes bump the major
  and require a new ADR or explicit amendment. Cortex ADR-0022
  (TaskEnvelope `$id` versioning) for the rule and the one historical exception (TaskEnvelope's
  unsuffixed `$id`, treated as `v1` pending the next breaking change).
- Reconciliation deltas between this canon and downstream code are recorded as comments in the
  contract file and resolved where the consuming code is tested (e.g. Chunk-1 for TaskEnvelope).
