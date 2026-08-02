// Cortex ExecutionReceipt — the single wire shape for a finished dispatched
// task ($id v1). Posted to agent-fabric POST /receipts and broadcast on
// GET /events as receipt.created.
//
// Per ADR-0014 this lives in cortex/contracts/ once and is imported by
// agent-fabric's /receipts ingest path, the n8n spine's grade step, Maestro
// (cost/quality labels), Forge (training candidates), and all surface consumers.
//
// v1 (ADR-0017) supersedes the v0 draft. v0 marked every field required with
// additionalProperties:false, which forbade BOTH the optional `dispatch` block
// AND any Hermes tracked-bypass / surface-direct receipt (no af_dispatch_id).
// v1 makes the orchestration-join fields optional so ONE shape covers three
// producers — spine-orchestrated, Hermes-bypass, surface-direct — and defines
// receipt_id as a client-generated idempotency key so dedup-by-receipt_id is safe
// across outbox retries.
//
// Keep paired with execution-receipt.schema.json. Bump $id on breaking changes.
//
// Status: v1. The live agent-fabric POST /receipts handler is CONVERGED to this
// shape as of 2026-06-01 (server.mjs): receipt_id is accepted as the client
// idempotency key and stored as the primary key (never regenerated); re-POST is a
// safe no-op (duplicate:true). The legacy v0 body (status/summary/changed_files/
// commands_run/artifacts) is still accepted and mapped onto v1 columns for
// back-compat with surfaces not yet migrated. The "freeze the contract" gate is met.

export interface ExecutionReceiptCost {
  /** Tokens consumed (best-effort; null if executor doesn't report). */
  input_tokens: number | null;
  output_tokens: number | null;
  /** USD cents (provider-reported or derived). */
  usd_cents: number | null;
}

/** Optional block for surface-originated work; absorbs pocket-agent dispatch fields. */
export interface ExecutionReceiptDispatch {
  source: "pocket-agent" | "personal-life-os" | "fleet-terminal" | "hermes" | "cron" | "manual";
  intent?: "task" | "calendar" | "save" | "decision" | null;
  response_mode?: "async-orchestrated" | "direct" | "planning" | null;
  project_scope?: string | null;
  /** Mnemos container_tag. */
  memory_scope?: string | null;
}

export interface ExecutionReceipt {
  /**
   * Client-generated idempotency key (ULID/UUID), created ONCE by the producer
   * before the first POST and reused on every retry/outbox replay. Consumers
   * dedupe on this; servers MUST NOT regenerate it.
   */
  receipt_id: string;

  /**
   * The spine task this receipt closes. UUID for spine-orchestrated tasks; for
   * bypass/direct producers with no spine task, a producer-scoped id.
   */
  task_id: string;

  /** Set by agent-fabric for spine-orchestrated work; null for bypass/direct. */
  af_dispatch_id?: string | null;
  af_worker_session_id?: string | null;
  /** Joins with RouteDecision.decision_id when routed through Maestro; else null. */
  decision_id?: string | null;
  /** Supervisory home-conversation lineage. */
  root_conversation_id?: string | null;
  parent_session_id?: string | null;
  parent_task_id?: string | null;
  /** Canonical Mnemos scope used for the result. */
  memory_scope?: string | null;
  /** Second-brain policy identity applied to this execution. */
  policy_version?: string | null;
  policy_hash?: string | null;

  /** Where this ran. */
  node: string;
  assigned_agent: string;        // matches TaskEnvelope.assigned_agent

  /** Final state of the worker session. */
  outcome: "succeeded" | "failed" | "cancelled" | "timed_out";
  exit_code?: number | null;

  /** Wall-clock + cost. */
  started_at: string;            // ISO-8601 UTC
  ended_at: string;              // ISO-8601 UTC
  duration_ms: number;
  cost?: ExecutionReceiptCost | null;

  /** Output. Either inline (small) or a pointer (large/structured). */
  result_summary?: string | null;
  result_pointer?: string | null; // e.g. "mnemos://<container>/<memory_id>", "s3://...", "file:///..."
  artifact_refs?: string[];

  /** For graders / training candidates. */
  acceptance_criteria_evaluated?: boolean | null;
  acceptance_criteria_passed?: boolean | null;
  reviewer_critique?: string | null;

  /** Free-form error string when outcome ∈ {failed, timed_out}. */
  error?: string | null;

  /** Present for surface-originated work; absent for pure spine-orchestrated receipts. */
  dispatch?: ExecutionReceiptDispatch | null;
}
