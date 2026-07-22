// Cortex TaskEnqueueRequest — the canonical task-enqueue payload a surface POSTs
// to agent-fabric's POST /cortex/enqueue (Suite Link §4.1, $id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. This is the single stable intake shape for PLO / pocket-agent /
// fleet-terminal / desktop. agent-fabric validates it, builds a conforming
// TaskEnvelope from it (minting the id), returns a dispatch_id immediately, and
// runs the task in-process on the dynamic workflow engine (runWorkflow /
// runComplexWorkflowAsync; per ADR-0023 the engine supersedes the n8n spine).
// agent-fabric NEVER redefines this shape.
//
// Keep paired with task-enqueue-request.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-06-10 (AF-WS6, integrate-enqueue-maestro).

import type { WorkRequestPriority } from "./work-request";

/** Originating surface. Lifts the TaskEnvelope.source enum verbatim. */
export type TaskEnqueueSource =
  | "personal-life-os"
  | "pocket-agent"
  | "fleet-terminal"
  | "cron"
  | "manual";

/** Coarse routing label. Lifts the TaskEnvelope.project enum verbatim. */
export type TaskEnqueueProject =
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

/** Complexity tier. Mirrors RouteDecision.tier / TaskEnvelope.complexity. */
export type TaskEnqueueTier = "trivial" | "simple" | "standard" | "complex";

/** Optional explicit executor override. Lifts the TaskEnvelope.assigned_agent enum verbatim. */
export type TaskEnqueueAssignedAgent =
  | "claude-code"
  | "codex"
  | "cursor"
  | "kimi"
  | "openclaw"
  | "hermes-local"
  | null;

export interface TaskEnqueueRequest {
  /** Originating surface; clarifications route back here. */
  source: TaskEnqueueSource;

  /** Short human label. Becomes TaskEnvelope.title. */
  title: string;

  /** Full instruction for the executing agent. Becomes TaskEnvelope.prompt. */
  description: string;

  /** Coarse routing label; maps to a Mnemos container root. */
  project: TaskEnqueueProject;

  /** Complexity tier. 'complex' => the dynamic workflow engine; else single dispatch. */
  tier: TaskEnqueueTier;

  /** Optional explicit executor override. null => the spine/Maestro routes. */
  assigned_agent?: TaskEnqueueAssignedAgent;

  /** Business priority for queue ordering. */
  priority?: WorkRequestPriority;

  /** Optional ISO-8601 UTC deadline (advisory). */
  due_at?: string | null;

  /** Optional pointer to source context (mnemos://, repo://, file://, https://). */
  context_url?: string | null;

  /** Optional client-generated idempotency key, stable across retries. */
  idempotency_key?: string | null;
}

/** What POST /cortex/enqueue returns immediately (before execution). */
export interface TaskEnqueueResponse {
  /** The agent-fabric dispatch id (returned immediately, before execution). */
  dispatch_id: string;

  /** The minted TaskEnvelope.id (the spine's cortex_tasks.id once intake accepts it). */
  task_id: string;

  /** Whether a multi-step dynamic workflow was started (tier === 'complex'). */
  workflow_started: boolean;

  /** The dynamic-workflow run id when workflow_started; null otherwise. */
  workflow_id: string | null;

  /** ISO-8601 UTC accept timestamp. */
  accepted_at: string;
}
