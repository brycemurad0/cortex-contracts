/**
 * Round-trip test for RefinePunchupRequest + RefinePunchupResponse.
 *
 * Validates that sample payloads conform to the v0 JSON schemas. The
 * custom validator (./validator.js) is a smoke test — it does NOT
 * dereference $ref and does NOT validate nested TaskEnvelope fields
 * beyond what's inlined in the schema. The schema is the contract
 * (valid JSON Schema draft-07 for real consumers); this test confirms
 * the top-level shape holds.
 *
 * The v0→v1 promotion gate is a real end-to-end round-trip through
 * NAS :5678 (the n8n spine's `cortex.refine.punchup` workflow), gated
 * on a live producer+consumer test. That is W3 work, not W2.
 *
 * Per the 30-day plan Stream B W2, the v0 contracts are authored with
 * a self-rolled round-trip test (this file). The W2 plan caps new
 * contracts in cortex/contracts/ at 2; these two (request + response)
 * count as 1.
 *
 * v0 patch (DELTA 1, 2026-06-03, per Surfaces' W1.1 review): the inlined
 * envelope inside both schemas is now `additionalProperties: true`. Real
 * envelopes from surfaces' normalizeSurfaceIntent have ~26 fields beyond
 * the canonical TaskEnvelope's 25; pre-patch, strict validators would
 * reject the extras. Post-patch, the schema accepts real-shape envelopes
 * and the inlined subset is the minimum the gate needs to do its work.
 * The 4th valid request and 4th valid response in this file are the
 * real-shape envelope fixtures (26 fields incl. metadata, created_at,
 * updated_at, attempts, result, error).
 *
 * Remaining v0 known limitations (to address in v1):
 * - Schema is permissive on (status, clarification) and (status,
 *   parent_id) coupling — the spine enforces semantics, not the schema.
 *   Conditional validation (if/then/else) is draft-07 valid but the
 *   custom test validator doesn't support it.
 * - The custom test validator doesn't support $ref; new schemas inline
 *   the TaskEnvelope minimum-subset shape. v1: either extend the
 *   validator with $ref support OR add a real consumer round-trip test
 *   against the live n8n workflow. (Using $ref to the canonical
 *   TaskEnvelope would inherit its own additionalProperties: false,
 *   which has the same surface-area problem; v1 needs the canonical
 *   loosened too — separate ADR conversation.)
 * - The response schema has no `children` field on `decompose` (DELTA 3
 *   from Surfaces). v1 design call: add `children?: TaskEnvelope[]` so
 *   Surfaces UI can render the decomposed children without a separate
 *   query. W1.1 adapter handles missing children gracefully (default
 *   null) so v0 is fine; v1 makes the field explicit.
 */

const { validate } = require('./validator.js');

const baseEnvelope = {
  id: "0192b1c0-1234-7abc-9def-0123456789ab",
  project: "cortex",
  source: "pocket-agent",
  title: "Refactor auth module",
  capability: "refactor",
  prompt: "Refactor the authentication module to use async/await.",
  context_refs: ["mnemos://cortex/agent-fabric/block_abc123"],
  preferred_agent: "auto",
  status: "refining"
};

// 3 success outcomes for the response (per punch-up standard §0.7)

const validReadyResponse = {
  status: "ready",
  envelope: {
    ...baseEnvelope,
    status: "refining",
    refined_prompt: "Refactor the authentication module (auth.py) to use async/await. Replace the sync DB calls in `authenticate()` and `validate_token()` with the async pool. Tests must pass; no new dependency.",
    acceptance_criteria: [
      "All existing tests pass",
      "No new third-party dependencies added",
      "No sync DB calls remain in auth.py"
    ],
    confidence: 0.85,
    complexity: "standard"
  }
};

const validClarifyResponse = {
  status: "clarify",
  envelope: {
    ...baseEnvelope,
    status: "clarifying",
    clarification: { question: "Which database driver are you targeting — psycopg2 sync or psycopg3 async?" }
  },
  clarification: {
    question: "Which database driver are you targeting — psycopg2 sync or psycopg3 async?",
    clarification_id: "01HV8J3K2M4N5P6Q7R8S9T0U1"
  }
};

const validDecomposeResponse = {
  status: "decompose",
  envelope: {
    ...baseEnvelope,
    status: "refining"
  },
  parent_id: "0192b1c0-1234-7abc-9def-0123456789cd"
};

// 3 valid request payloads (one per surface) + 1 real-shape envelope
// (per DELTA 4 from Surfaces' W1.1 review: a 26-field envelope including
// metadata + created_at + updated_at + attempts + result + error that
// would have been rejected pre-DELTA-1-fix).

const realShapeEnvelope = {
  // Required fields
  id: "0192b1c0-1234-7abc-9def-0123456789ab",
  project: "cortex",
  source: "pocket-agent",
  title: "Refactor auth module",
  capability: "refactor",
  prompt: "Refactor the authentication module to use async/await.",
  status: "refining",
  // Common optional fields
  context_refs: ["mnemos://cortex/agent-fabric/block_abc123"],
  preferred_agent: "auto",
  constraints: { max_runtime_s: 600, needs_human_approval: false },
  // Post-punchup fields (null on intake but present in normalized envelopes)
  refined_prompt: null,
  acceptance_criteria: [],
  complexity: null,
  confidence: null,
  model: null,
  clarification: null,
  review: null,
  parent_id: null,
  assigned_agent: null,
  node: null,
  attempts: 0,
  result: null,
  error: null,
  created_at: "2026-06-03T15:00:00.000Z",
  updated_at: "2026-06-03T15:00:00.000Z",
  // Adapter-specific field not in the canonical TaskEnvelope schema
  metadata: { trace_id: "abc123", source_version: "1.0.0" }
};

const validRequests = [
  {
    id: "01HV8REQ00000000000000001",
    envelope: baseEnvelope,
    surface: "pocket-agent"
  },
  {
    id: "01HV8REQ00000000000000002",
    envelope: { ...baseEnvelope, source: "personal-life-os", title: "Plan weekend trip" },
    surface: "personal-life-os"
  },
  {
    id: "01HV8REQ00000000000000003",
    envelope: { ...baseEnvelope, source: "fleet-terminal", title: "Diagnose deploy failure" },
    surface: "fleet-terminal",
    request_id: "caller-supplied-trace-id-789"
  },
  {
    // DELTA 4: real-shape envelope (26 fields incl. metadata). Pre-DELTA-1
    // this would be rejected; post-DELTA-1 it MUST be accepted.
    id: "01HV8REQ-REAL-SHAPE-01",
    envelope: realShapeEnvelope,
    surface: "pocket-agent"
  }
];

// Invalid payloads for negative testing

const invalidRequests = [
  {
    // Missing required 'surface' field
    id: "01HV8REQ000000000000000FF",
    envelope: baseEnvelope
  },
  {
    // Invalid surface enum
    id: "01HV8REQ000000000000000FE",
    envelope: baseEnvelope,
    surface: "unknown-surface"
  },
  {
    // Empty id
    id: "",
    envelope: baseEnvelope,
    surface: "pocket-agent"
  },
  {
    // Envelope missing required 'prompt'
    id: "01HV8REQ000000000000000FD",
    envelope: { ...baseEnvelope, prompt: undefined },
    surface: "pocket-agent"
  }
];

const invalidResponses = [
  {
    // Missing required 'envelope'
    status: "ready"
  },
  {
    // Invalid status enum (4th outcome — error — is OUT-OF-BAND, not in this body)
    status: "error",
    envelope: baseEnvelope
  }
];

console.log("Testing RefinePunchupRequest contract...\n");

let passed = 0;
let failed = 0;

console.log("Valid request tests:");
for (const payload of validRequests) {
  const result = validate(payload, 'refine-punchup-request');
  if (result.valid) {
    console.log(`  PASS: ${payload.id} (surface=${payload.surface})`);
    passed++;
  } else {
    console.log(`  FAIL: ${payload.id}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

console.log("\nInvalid request tests (expecting failures):");
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'refine-punchup-request');
  if (!result.valid) {
    console.log(`  PASS: Test ${i + 1} correctly rejected`);
    passed++;
  } else {
    console.log(`  FAIL: Test ${i + 1} should have been rejected`);
    failed++;
  }
}

console.log("\n\nTesting RefinePunchupResponse contract...\n");

console.log("Valid response tests (3 success outcomes):");
const validResponses = [
  { label: "ready", payload: validReadyResponse },
  { label: "clarify", payload: validClarifyResponse },
  { label: "decompose", payload: validDecomposeResponse },
  { label: "ready+real-shape-envelope", payload: { status: "ready", envelope: realShapeEnvelope } }
];
for (const { label, payload } of validResponses) {
  const result = validate(payload, 'refine-punchup-response');
  if (result.valid) {
    console.log(`  PASS: status=${label}`);
    passed++;
  } else {
    console.log(`  FAIL: status=${label}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

console.log("\nInvalid response tests (expecting failures):");
for (let i = 0; i < invalidResponses.length; i++) {
  const result = validate(invalidResponses[i], 'refine-punchup-response');
  if (!result.valid) {
    console.log(`  PASS: Test ${i + 1} correctly rejected`);
    passed++;
  } else {
    console.log(`  FAIL: Test ${i + 1} should have been rejected`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
