// Cortex ModelRegistration — Forge → Maestro cortex_models egress ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. Forge POSTs this to Maestro on a gate-pass (an eval-beating
// adapter served on the local GPU) so Maestro routes that discipline local-first.
// This is the missing tooth in the recursive flywheel: serve → register → route.
//
// `artifact_sha256` is the idempotency key — re-registering the same
// (discipline_key, artifact_sha256) is a no-op, so a retried POST never
// double-registers a lane.
//
// Keep paired with cortex-model-registration.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-06-22.

export interface CortexModelRegistration {
  /** The Forge discipline/lane this adapter serves (e.g. "code_review"). */
  discipline_key: string;

  /** Served-model id / SGLang --lora-paths name, or base URL + alias the router can call. */
  location: string;

  /** Path/URL to the held-out eval result that justifies routing here. */
  eval_pointer: string;

  /** sha256 of the served adapter artifact — idempotency key. */
  artifact_sha256: string;

  /** Whether the adapter is currently served and routable. Defaults true on a gate-pass. */
  served?: boolean;

  /** The base model's score on the same eval suite. */
  base_score?: number | null;

  /** The served adapter's score on the held-out eval (must beat base by the margin). */
  adapter_score?: number | null;

  /** When Forge fired the registration (ISO-8601 UTC). */
  registered_at?: string;
}
