// Cortex RefinePunchupResponse — what the n8n spine's `cortex.refine.punchup`
// workflow returns to a surface on a 2xx response.
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported
// by every consumer. Surfaces-Builder is the named consumer (per the W1.1
// staged adapter in /Users/jarvis/code/surfaces); the n8n spine is the named
// producer (per docs/hld/lld-orchestration-spine-wiring.md + standards/punch-up-standard.md).
//
// Authored 2026-06-03 (W2 of the 30-day plan, Stream B). Status: DRAFT v0.
// v0→v1 promotion gated on a real end-to-end round-trip through NAS :5678.
//
// Keep paired with refine-punchup-response.schema.json. Bump $id on breaking changes.

import type { TaskEnvelope } from "./task-envelope";

/**
 * The success outcomes of the punch-up gate. Per punch-up standard §0.7
 * (and docs/hld/lld-orchestration-spine-wiring.md §"Current state"):
 *   - ready: clean + small + verifiable; envelope.refined_prompt +
 *     envelope.acceptance_criteria are populated.
 *   - clarify: low confidence or unresolved architecture concern; the
 *     gate emits a clarifying question that the originating surface
 *     (per envelope.source) answers via the clarify bus.
 *   - decompose: multi-deliverable; the spine creates discipline-scoped
 *     children that re-enter the punch-up gate with project scope
 *     inherited. `parent_id` is set on the response so the caller
 *     can track the parent.
 *
 * Note: `decompose` is a happy-path outcome, NOT a variant of error.
 * Transport errors (4xx/5xx/timeout) are OUT-OF-BAND and do not appear
 * in this body. They use a separate shape: { error: string, detail?: object }
 * with 4xx including detail.field, 5xx no detail, and timeout = { error: 'spine_timeout' }.
 */
export type RefinePunchupStatus = "ready" | "clarify" | "decompose";

/**
 * The clarifying question emitted on `status: 'clarify'`. The
 * `clarification_id` is optional; if present, it is the AF `:3333`
 * clarifications row id the surface POSTs the answer back to.
 */
export interface RefinePunchupClarification {
  question: string;
  clarification_id?: string;
}

/**
 * The success body of a 2xx response from the punch-up endpoint.
 */
export interface RefinePunchupResponse {
  status: RefinePunchupStatus;
  envelope: TaskEnvelope;

  /**
   * Present on `status: 'clarify'`. The question the gate wants
   * answered before it can refine. The surface (per envelope.source)
   * posts the answer to the clarify bus; the gate re-runs.
   */
  clarification?: RefinePunchupClarification;

  /**
   * Present on `status: 'decompose'`. The new parent id of the
   * children the spine has just created. The children re-enter the
   * punch-up gate with project scope inherited. The original
   * envelope's `id` becomes the `parent_id` of the children.
   */
  parent_id?: string;
}
