// Cortex TrainingLabel — a raw quality label from the auto-labeling flywheel ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. TrainingLabel is the row Quorum/Maestro writes for a single
// routed request (the `quality_labels` table) and the row Forge's harvest reads.
// It is DISTINCT from:
//   - LearningTrace        — the route→outcome→grade→cost execution record.
//   - TrainingDataCandidate — the curated, lane-ready example produced downstream.
//
// `provenance` is optional and plumbed-through, never fabricated: a source-grounded
// task (e.g. a code dispatch with a known repo/commit) carries it so the label can
// survive Forge's curate grounding gate; an ungrounded request omits it and the
// label is correctly rejected as fuel.
//
// Keep paired with training-label.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-06-22.

import type { DataLicense } from "./training-data-candidate";

export interface LabelProvenance {
  /** URL of the source the routed work was grounded in (repo, PR, issue). */
  source_url: string;
  /** Git commit SHA at harvest time. */
  source_commit_sha: string;
  /** License of the source material. */
  license: DataLicense;
}

export interface TrainingLabel {
  /** RouteDecision.decision_id — join key to the route, Quorum label, Mnemos memory. */
  decision_id?: string | null;

  /** Unix epoch seconds when the label was written. */
  timestamp: number;

  /** sha256(prompt)[:16] — dedup/index key. */
  prompt_hash?: string;

  /** The input prompt. */
  prompt: string;

  /** Maestro task domain (code/reason/agent/...); maps to a Forge lane. */
  domain?: string;

  consensus_response: string;
  gold_response?: string;

  /** Per-voter raw responses (object, or its JSON-string form as persisted in sqlite). */
  voter_responses?: Record<string, unknown> | string;

  /** Per-model scores (object, or its JSON-string form). */
  model_votes?: Record<string, number> | string;

  winning_tier?: string;
  confidence?: number;
  dissent_score?: number;
  synthesized?: boolean | number;
  grounding_used?: boolean | number;

  /** Opus/Sonnet judge per-axis scores (1-5). */
  accuracy?: number;
  completeness?: number;
  reasoning?: number;
  clarity?: number;
  usefulness?: number;
  overall: number;

  judge_notes?: string;
  judge_model?: string;
  latency_ms?: number;

  /** Optional explicit Forge lane override; when absent, derived from `domain`. */
  lane?: string | null;

  /** Source-grounding metadata. Present only for grounded tasks; null/absent otherwise. */
  provenance?: LabelProvenance | null;
}
