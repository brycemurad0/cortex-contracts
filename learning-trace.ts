// Cortex LearningTrace — captures a routing+outcome pair for training ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. LearningTrace records the relationship between a routing
// decision and its actual outcome, enabling feedback loops for model improvement.
//
// Keep paired with learning-trace.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-05-31.

export type LearningTraceOutcome = "succeeded" | "failed" | "cancelled" | "timed_out";

export type LearningTraceGrade = "excellent" | "good" | "acceptable" | "poor" | "ungraded";

export interface LearningTraceRoute {
  /** The model that was selected. */
  model: string;

  /** The complexity tier assigned. */
  tier: "trivial" | "simple" | "standard" | "complex";
}

export interface LearningTraceCost {
  /** Input tokens consumed. */
  input_tokens: number;

  /** Output tokens produced. */
  output_tokens: number;

  /** Cost in USD cents. */
  usd_cents: number;
}

export interface LearningTrace {
  /** Reference to the RouteDecision that made the routing choice. */
  decision_id: string;

  /** Reference to the task being executed. */
  task_id: string;

  /** The route that was taken (model and tier). */
  route: LearningTraceRoute;

  /** The actual outcome of execution. */
  outcome: LearningTraceOutcome;

  /** The quality grade assigned by the grader. */
  grade: LearningTraceGrade;

  /** Cost metrics for this execution. */
  cost: LearningTraceCost;

  /** When this trace was recorded (ISO-8601 UTC). */
  created_at: string;
}
