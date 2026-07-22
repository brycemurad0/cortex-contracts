// Cortex TrainingDataCandidate — a normalized example for a forge lane ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. TrainingDataCandidate represents a curated example ready for
// inclusion in a training dataset for a specific forge lane.
//
// Keep paired with training-data-candidate.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-05-31.

export type TrainingLane =
  | "code-generation"
  | "code-review"
  | "refactoring"
  | "documentation"
  | "test-generation"
  | "bug-fix"
  | "architecture"
  | "general";

export type DataLicense =
  | "MIT"
  | "Apache-2.0"
  | "BSD-3-Clause"
  | "GPL-3.0"
  | "proprietary"
  | "unknown"
  | "CC0-1.0"
  | "CC-BY-4.0";

export interface TrainingDataCandidate {
  /** The forge lane this example is intended for. */
  lane: TrainingLane;

  /** The input prompt or instruction. */
  prompt: string;

  /** The expected/correct response. */
  response: string;

  /** URL to the source of this example (repo, issue, PR, etc.). */
  source_url: string;

  /** Git commit SHA when this example was harvested. */
  source_commit_sha: string;

  /** Whether this example is grounded in verified/correct information. */
  grounded: boolean;

  /** License of the source material. */
  license: DataLicense;

  /** Quality score assigned by the harvester (0-100). */
  quality_score: number;

  /** When this candidate was created (ISO-8601 UTC). */
  created_at: string;
}
