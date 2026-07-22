// Cortex WorkRequest — what a surface (PLO/pocket-agent) submits to be enqueued ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. WorkRequest is the initial submission from a surface before
// it becomes a TaskEnvelope in the system.
//
// Keep paired with work-request.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-05-31.

export type WorkRequestSource =
  | "personal-life-os"
  | "pocket-agent"
  | "fleet-terminal"
  | "cron"
  | "manual";

export type WorkRequestPriority = "low" | "normal" | "high" | "urgent";

export interface WorkRequest {
  /** ULID/UUID — client-generated idempotency key, stable across retries. */
  id: string;

  /** Originating surface. */
  source: WorkRequestSource;

  /** Coarse intent classification for routing. */
  intent: string;

  /** The refined/punched-up prompt ready for execution. */
  refined_prompt: string;

  /** Definition-of-done criteria the grader will check. */
  acceptance_criteria: string[];

  /** Business priority for queue ordering. */
  priority: WorkRequestPriority;

  /** Identity of the requesting user or system. */
  requested_by: string;

  /** When the request was created (ISO-8601 UTC). */
  created_at: string;
}
