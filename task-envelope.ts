// Cortex Task Envelope — the universal task contract (CANONICAL HOME).
//
// Per ADR-0014, shared contracts are authored once here in `cortex/contracts/`
// and imported by every module — agent-fabric (ADR-0023: engine supersedes n8n)
// must not redefine their own task shape. Adapters translate this envelope into
// whatever each agent expects; nothing downstream invents its own shape.
//
// Keep in sync with task-envelope.schema.json and the orchestration_tasks table
// in agent-fabric/orchestration/db/migrations/001_orchestration.sql.
//
// RECONCILIATION NOTE (resolve in Chunk-1, where the SQL + adapters are tested):
//   - `assigned_agent` here is the universal superset; agent-fabric's executor
//     currently supports a subset (openclaw | hermes | codex | claude). Adapters
//     own the name mapping (e.g. hermes-local→hermes, claude-code→claude).
//   - `project` maps to a Mnemos container root (cortex/* | personal/* | ...);
//     the enum below is the coarse routing label carried through decomposition.

export type CortexProject =
  | "cortex"
  | "agent-fabric"
  | "mnemos"
  | "forge"
  | "surfaces"
  | "personal-life-os"
  | "pocket-agent"
  | "fleet-terminal"
  | "maestro"
  | "nightcrew"
  | "life-os";

export type Complexity = "trivial" | "simple" | "standard" | "complex";

export type Capability =
  | "code"
  | "research"
  | "write"
  | "refactor"
  | "review"
  | "data"
  | "ops"
  | "chat";

export type AgentName =
  | "claude-code"
  | "codex"
  | "cursor"
  | "kimi"
  | "openclaw"
  | "hermes-local";

export type PreferredAgent = "auto" | AgentName;

export type TaskSource =
  | "personal-life-os"
  | "pocket-agent"
  | "fleet-terminal"
  | "cron"
  | "manual";

// Consolidated ≤8-state lifecycle (2026-06-10). Two pure substates were folded:
//   - the former "dispatched" is "running" with started_at unset (claimed-but-not-started)
//   - the former "needs_review" is "reviewing" with review.needs_human=true (human escalation)
export type TaskStatus =
  | "refining"
  | "clarifying"
  | "blocked"
  | "queued"
  | "running"
  | "reviewing"
  | "done"
  | "failed";

export interface TaskReview {
  score: number;
  passed: boolean;
  critique: string;
  // needs_human marks the escalation formerly carried by the "needs_review" status
  // (retries/grade exhausted -> a human, not the auto-grader).
  needs_human?: boolean;
  review_outcome?: "auto_grade" | "retries_exhausted" | "grade_failed";
}

export interface TaskClarification {
  question: string;
  answer: string | null;
}

export interface TaskConstraints {
  max_runtime_s?: number;
  needs_human_approval?: boolean;
}

// ── Dynamic-workflow-engine extensions (agent-fabric src/workflows/) ──
// Set only when an envelope is a node in a runtime-authored workflow DAG;
// null/absent for plain spine tasks. Authored here (canonical) per ADR-0014 —
// agent-fabric imports these, it does not redefine them.

export interface TaskCheckpoint {
  lastNode?: string;
  state?: Record<string, unknown>;
  savedAt?: string;
}

export interface TaskContext {
  workTreePath?: string;          // isolated fs root: AF_WORKSPACE_ROOT/{workflowId}/{nodeId}
  sessionId?: string;             // session-store session id (interim sqlite | mnemos)
  checkpoint?: TaskCheckpoint | null;
}

export interface TaskRouting {
  model?: string;                 // final executor model id (registry-pinned)
  provider?: string;              // transport: claude|codex|kimi|minimax|api|local
  reason?: string;                // why this model (task-class rule or fallback trigger)
  fallbackChain?: string[];       // ordered registry ids the router falls through
  decision_id?: string | null;    // joins to Maestro RouteDecision.decision_id
}

export interface TaskEnvelope {
  id: string;
  project: CortexProject;
  source: TaskSource;
  title: string;
  capability: Capability;
  prompt: string;
  context_refs: string[];
  preferred_agent: PreferredAgent;
  constraints: TaskConstraints;
  status: TaskStatus;

  // ── quality pipeline ──
  refined_prompt: string | null;        // punched-up spec (cortex.refine.punchup)
  acceptance_criteria: string[];        // definition-of-done the grader checks
  complexity: Complexity | null;        // Maestro auto-label
  confidence: number | null;            // refiner's clarity confidence 0..1
  model: string | null;                 // Maestro's executor model pick
  clarification: TaskClarification | null;
  review: TaskReview | null;            // grader output

  // ── decomposition ──
  parent_id: string | null;

  // ── execution ──
  assigned_agent: AgentName | null;
  node: string | null;                  // fleet node the agent-fabric worker runs on
  attempts: number;
  result: Record<string, unknown> | string | null;
  error: string | null;

  // ── dynamic workflow engine (agent-fabric src/workflows/) ──
  workflowId: string | null;            // DAG run id; null for plain spine tasks
  nodeId: string | null;                // DAG node id this envelope executes
  context: TaskContext | null;          // worktree + session + checkpoint pointer
  routing: TaskRouting | null;          // model-router decision (mirrored to receipt)

  created_at: string;
  updated_at: string;
}

export type AdapterKind = "execute_command" | "http" | "webhook";

export interface AgentRegistryEntry {
  agent: AgentName;
  adapter: AdapterKind;
  capabilities: Capability[];
  max_concurrency: number;
  endpoint_or_cmd: string;
  enabled: boolean;
}
