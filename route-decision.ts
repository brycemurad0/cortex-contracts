// Cortex RouteDecision — Maestro's per-request routing record (DRAFT, $id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. RouteDecision is what Maestro emits to a caller (the n8n spine
// or a surface) so the caller can record which model+route was actually used.
//
// Today this is encoded ad-hoc as the `_maestro` block on the
// /v1/chat/completions response (see maestro/maestro/api/server.py). This contract
// gives it a stable, versioned wire shape.
//
// Keep paired with route-decision.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-05-28 to unblock the n8n spine's
// "route → execute" step under HANDOFF.md §3 item 3.

export type RoutingMode =
  | "sonnet-anchored"     // gate 0–3 default
  | "vega-direct"         // gate 4+ when Vega is ready in the domain
  | "vega-blocking-quorum" // gate 4+ requesting consensus
  | "passthrough"         // model:"direct/<name>" forces this
  | "fallback-sql";       // Maestro down → cortex_route_model() SQL fallback

export type RouteTier = "trivial" | "simple" | "standard" | "complex";

export interface RouteDecision {
  /** ULID/UUID — the routing record id; can be used as a join key in Quorum labels. */
  decision_id: string;
  /** TaskEnvelope.id when called from the spine; null for direct callers. */
  task_id: string | null;
  /** Coarse complexity classification used by the gate ladder. */
  tier: RouteTier;
  /** Which path of the gate ladder fired. */
  routing_mode: RoutingMode;
  /** Final model the executor was given. */
  model: string;
  /** Vega confidence (0..1) if Vega participated; null otherwise. */
  vega_confidence: number | null;
  /** Whether Quorum consensus was triggered (and a label was written). */
  consensus_fired: boolean;
  /** Ordered fallback chain that would have been attempted on failure. */
  fallback_chain: string[];
  /** Session id when the request was pinned (model continuity). */
  session_id: string | null;
  /** When the decision was made (ISO-8601 UTC). */
  decided_at: string;
}
