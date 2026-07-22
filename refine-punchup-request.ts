// Cortex RefinePunchupRequest — what a surface (PLO/pocket-agent/fleet-terminal)
// sends to the n8n spine's `cortex.refine.punchup` workflow to get a raw
// prompt punched up into a refined spec (or a clarify question back, or a
// decomposition into children).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported
// by every consumer. Surfaces-Builder is the named consumer (per the W1.1
// staged adapter in /Users/jarvis/code/surfaces); the n8n spine is the named
// producer (per docs/hld/lld-orchestration-spine-wiring.md + standards/punch-up-standard.md).
//
// Authored 2026-06-03 (W2 of the 30-day plan, Stream B). Status: DRAFT v0.
// v0→v1 promotion gated on a real end-to-end round-trip through NAS :5678.
//
// Keep paired with refine-punchup-request.schema.json. Bump $id on breaking changes.

import type { TaskEnvelope, WorkRequestSource } from "./work-request";

/**
 * What a surface sends to the punch-up gate. The surface injects the raw
 * TaskEnvelope (with `refined_prompt` null) plus a client-generated
 * idempotency key and the originating surface. The spine hydrates context
 * from Mnemos, runs the LLM punch-up, gates on confidence, and either
 * refines (status: 'ready'), asks a clarifying question (status: 'clarify'),
 * or splits the work into discipline-scoped children (status: 'decompose').
 *
 * Per the punch-up standard §0.7, the gate emits THREE success outcomes
 * (ready / clarify / decompose). Transport errors (4xx/5xx/timeout) are
 * OUT-OF-BAND — they do not appear in this body. See
 * refine-punchup-response for the success shape.
 */
export interface RefinePunchupRequest {
  /**
   * Client-generated idempotency key, ULID/UUID. Stable across retries;
   * matches the WorkRequest.id convention ("ULID/UUID — client-generated
   * idempotency key, stable across retries", per work-request.ts). The
   * server SHOULD return the cached prior response if this id was seen
   * within the last 5 minutes; otherwise re-refine. (The n8n spine does
   * NOT cache today; client-side dedupe is the only safety until the v0
   * contract's server-side cache lands.)
   */
  id: string;

  /**
   * The raw TaskEnvelope. At intake, `refined_prompt` is null; the
   * spine writes the punched-up spec back. The envelope's `id` MUST
   * equal the top-level `id` (consistency check on the server side).
   */
  envelope: TaskEnvelope;

  /**
   * The originating surface. Lifts the WorkRequestSource enum verbatim;
   * NOT redefined. Used to route clarifications back to the right
   * surface and to scope the Mnemos container.
   */
  surface: WorkRequestSource;

  /**
   * Optional caller-supplied tracing key, distinct from the idempotency
   * key. Used for logging/observability only; the spine does NOT use
   * this for dedup. If unset, the spine generates one.
   */
  request_id?: string;
}
