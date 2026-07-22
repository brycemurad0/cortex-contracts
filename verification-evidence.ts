// Cortex VerificationEvidence — grader output for a completed task ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. VerificationEvidence captures the structured output of the
// grading process, including individual check results and evidence artifacts.
//
// Keep paired with verification-evidence.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-05-31.

export type VerificationCheckStatus = "pass" | "fail" | "skip";

export interface VerificationCheck {
  /** Human-readable description of what was checked. */
  description: string;

  /** The status of this individual check. */
  status: VerificationCheckStatus;

  /** Optional details or explanation of the result. */
  details?: string | null;
}

export interface VerificationEvidenceArtifact {
  /** Type of artifact (e.g., "log", "screenshot", "diff", "metric"). */
  kind: string;

  /** Reference to the artifact (URL, path, or identifier). */
  reference: string;

  /** Optional description of the artifact. */
  description?: string | null;
}

export interface VerificationEvidence {
  /** Reference to the ExecutionReceipt being graded. */
  receipt_id: string;

  /** Individual check results. */
  checks: VerificationCheck[];

  /** Overall pass/fail status. */
  status: "pass" | "fail";

  /** Evidence artifacts supporting the grading decision. */
  artifacts: VerificationEvidenceArtifact[];

  /** Identity of the grader (agent or system). */
  grader: string;

  /** When the grading was completed (ISO-8601 UTC). */
  graded_at: string;
}
