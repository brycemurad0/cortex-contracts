/**
 * Round-trip test for TaskEnqueueRequest contract (Suite Link §4.1).
 * Validates that sample surface->agent-fabric enqueue payloads conform to the
 * JSON schema, and that malformed payloads are rejected.
 */

const { validate } = require('./validator.js');

// Sample valid TaskEnqueueRequest payloads (the surface POSTs these to
// agent-fabric POST /cortex/enqueue).
const validRequests = [
  {
    // Minimal — only the five required fields.
    source: "pocket-agent",
    title: "Fix the flaky login test",
    description: "The auth integration test fails intermittently on CI. Find the race and stabilize it.",
    project: "agent-fabric",
    tier: "standard"
  },
  {
    // Full — every optional field set.
    source: "personal-life-os",
    title: "Refactor the dispatcher",
    description: "Extract the model-routing decision into its own module with tests.",
    project: "agent-fabric",
    tier: "complex",
    assigned_agent: "claude-code",
    priority: "high",
    due_at: "2026-06-12T17:00:00Z",
    context_url: "mnemos://cortex/agent-fabric/dispatcher-notes",
    idempotency_key: "01HV8J3K2M4N5P6Q7R8S9T0UV"
  },
  {
    source: "surfaces/voice",
    title: "Supervise three Crest workstreams",
    description: "Create three auditable children and synthesize verified results into the parent.",
    project: "crest",
    tier: "complex",
    idempotency_key: "voice-home-001",
    root_conversation_id: "home-2026-08-01",
    parent_session_id: "surface-session-001",
    parent_task_id: null,
    memory_scope: "thislive/crest/pilot",
    acceptance_criteria: ["Three children have terminal receipts", "Parent receives one synthesis"],
    artifact_refs: ["repo:///Users/jarvis/crest"],
    budget: { max_runtime_s: 1800, max_attempts: 3, max_total_tokens: 200000, max_usd_cents: 0 },
    policy_version: "2026-08-01.1",
    policy_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    // Optional nullable fields explicitly null (must be accepted).
    source: "fleet-terminal",
    title: "Summarize last week's receipts",
    description: "Produce a one-page rollup of all agent-fabric receipts from the last 7 days.",
    project: "cortex",
    tier: "simple",
    assigned_agent: null,
    due_at: null,
    context_url: null,
    idempotency_key: null
  }
];

// Invalid payloads for negative testing.
const invalidRequests = [
  {
    // Missing required fields (no description/project/tier).
    source: "pocket-agent",
    title: "incomplete"
  },
  {
    // Invalid source enum.
    source: "invalid source", // invalid identifier
    title: "x",
    description: "y",
    project: "cortex",
    tier: "standard"
  },
  {
    // Invalid project enum.
    source: "manual",
    title: "x",
    description: "y",
    project: "not a valid project", // invalid identifier
    tier: "standard"
  },
  {
    // Invalid tier enum.
    source: "manual",
    title: "x",
    description: "y",
    project: "cortex",
    tier: "epic" // invalid
  },
  {
    // Unknown top-level field (additionalProperties: false must reject).
    source: "manual",
    title: "x",
    description: "y",
    project: "cortex",
    tier: "standard",
    bogus_field: "nope" // invalid
  },
  {
    // Invalid assigned_agent enum value.
    source: "manual",
    title: "x",
    description: "y",
    project: "cortex",
    tier: "standard",
    assigned_agent: "gemini-cli" // invalid
  },
  {
    source: "surfaces/voice",
    title: "x",
    description: "y",
    project: "crest",
    tier: "standard",
    policy_hash: "not-a-sha256"
  }
];

console.log("Testing TaskEnqueueRequest contract...\n");

let passed = 0;
let failed = 0;

console.log("Valid payload tests:");
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'task-enqueue-request');
  if (result.valid) {
    console.log(`  PASS: valid #${i + 1} (${validRequests[i].title})`);
    passed++;
  } else {
    console.log(`  FAIL: valid #${i + 1} (${validRequests[i].title})`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

console.log("\nInvalid payload tests (expecting failures):");
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'task-enqueue-request');
  if (!result.valid) {
    console.log(`  PASS: invalid #${i + 1} correctly rejected`);
    passed++;
  } else {
    console.log(`  FAIL: invalid #${i + 1} should have been rejected`);
    failed++;
  }
}

// ADR-0023 guard: the in-process dynamic workflow engine — not n8n — is the
// orchestration spine. The top-level description must say AF runs the task on
// the engine and must not resurrect the retired n8n forward or the NAS :5678
// v0->v1 gate.
const schema = require('../task-enqueue-request.schema.json');
const desc = schema.description;

const descChecks = [
  ["describes the in-process dynamic workflow engine",
    /in-process/.test(desc) && /dynamic workflow engine/.test(desc)],
  ["does not say AF forwards into the n8n spine intake",
    !/forwards into the n8n spine/.test(desc)],
  ["v0->v1 gate is the supervisory child-to-receipt round-trip",
    /home-conversation/.test(desc) && /verified receipt round-trip/.test(desc)],
  ["v0->v1 gate no longer references NAS :5678",
    !/NAS :5678/.test(desc)]
];

console.log("\nDescription tests (ADR-0023 — engine supersedes n8n):");
for (let i = 0; i < descChecks.length; i++) {
  const [label, ok] = descChecks[i];
  if (ok) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
