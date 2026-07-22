/**
 * Round-trip test for MemoryStoreRequest contract (MNEM-WS1 keystone, SCRUTINY §3 #15 / §4.1).
 * Validates that sample POST /store + POST /mobile/memory payloads conform to the
 * JSON schema, and that malformed payloads are rejected. Mirrors the pattern of
 * task-enqueue-request.test.js + session-store-request.test.js.
 *
 * This is the CORTEX-SIDE contract test; the consumer-side wire-in test
 * (loader extension + handler wire-up) lives in the mnemos repo as
 * test_store_keystone_boundary.py. Both are needed:
 *  - This test pins the contract surface (the schema file).
 *  - The mnemos test pins the runtime behavior (the loader reads the
 *    schema + the handler validates before store_payload).
 *
 * The keystone is `additionalProperties: false` — without it a producer
 * could inject rogue provenance fields or hidden container_tag / session_id
 * overrides and the memory-write audit log + the recall ranking would
 * silently pick them up.
 */

const { validate } = require('./validator.js');

// Sample valid MemoryStoreRequest payloads (the full surface a producer
// might send, including the `metadata` sub-object — the only
// `additionalProperties:true` relaxation in the entire schema).
const validRequests = [
  {
    // Minimal — only the required raw_text field. This is the common
    // case for backfill writes + simple CLI scripts.
    raw_text: "MNEM-WS1 keystone test — minimal memory write."
  },
  {
    // Full — every optional field set. Pins that the keystone accepts
    // the full surface a producer might send, including the
    // `metadata` sub-object (the only `additionalProperties:true`
    // relaxation in the entire schema) and the `valid_from`
    // date-time + the `memory_block_level` integer enum.
    raw_text: "MNEM-WS1 keystone test — maximal memory write.",
    container_tag: "hermes-test",
    memory_type: "episodic",
    actor_id: "test-actor",
    actor_class: "agent",
    confidence: 0.85,
    source_provider: "test",
    source_record_id: "ws1-test-001",
    source_container: "src-container",
    source_node: "test-node",
    source_surface: "pytest",
    metadata: { trace_id: "abc-123", span_id: "def-456" },
    valid_from: "2026-06-13T08:30:00Z",
    memory_block_level: 0,
    is_synthesized: false,
    parent_memory_id: "mem_parent_01",
    session_id: "sess_test_01",
    promoted: false
  },
  {
    // Optional nullable fields explicitly null (must be accepted). The
    // non-nullable string fields (memory_type, source_provider,
    // container_tag) are OMITTED — they have server-side defaults that
    // fill in when missing, but explicit null is NOT the same as
    // missing (the legacy Pydantic posture typed them as `str` not
    // `Optional[str]`, and the canonical schema preserves that).
    raw_text: "MNEM-WS1 keystone test — null-on-truly-optional.",
    actor_id: null,
    actor_class: null,
    confidence: null,
    source_record_id: null,
    source_container: null,
    source_node: null,
    source_surface: null,
    metadata: null,
    valid_from: null,
    parent_memory_id: null,
    session_id: null
  },
  {
    // Memory type = receipt (the fleet ships 'receipt' memories as
    // execution-receipt mirrors via the /store seam, not the
    // dedicated /receipts endpoint).
    raw_text: "MNEM-WS1 keystone test — receipt-type memory write.",
    memory_type: "receipt",
    source_provider: "agent-fabric"
  }
];

// Invalid payloads for negative testing.
const invalidRequests = [
  {
    // Missing required raw_text.
    memory_type: "episodic"
  },
  {
    // Empty raw_text (minLength:1 must reject).
    raw_text: ""
  },
  {
    // Unknown top-level field (additionalProperties: false must reject).
    raw_text: "rogue-field test",
    sneaky_undeclared_field: "injected-by-misbehaving-producer"
  },
  {
    // Bad memory_type enum value.
    raw_text: "bad-memory-type test",
    memory_type: "not_a_real_memory_type"
  },
  {
    // Bad memory_block_level enum value (must be 0, 1, or 2).
    raw_text: "bad-memory-block-level test",
    memory_block_level: 7
  },
  {
    // Bad memory_block_level type (string, not integer).
    raw_text: "bad-memory-block-level-type test",
    memory_block_level: "two"
  },
  {
    // Confidence out of range (maximum: 1).
    raw_text: "confidence-too-high test",
    confidence: 1.5
  },
  {
    // Confidence out of range (minimum: 0).
    raw_text: "confidence-too-low test",
    confidence: -0.1
  },
  {
    // Confidence non-finite (NaN slips through minimum/maximum both
    // returning false on NaN comparisons — validator must reject it
    // outright, not silently accept).
    raw_text: "confidence-nan test",
    confidence: NaN
  },
  {
    // Bad valid_from format (not a date-time).
    raw_text: "bad-valid-from test",
    valid_from: "not-a-timestamp"
  },
  {
    // Bad metadata type (string, not object).
    raw_text: "bad-metadata-type test",
    metadata: "not an object"
  },
  {
    // Explicit null on a non-nullable string field (memory_type).
    // The legacy Pydantic posture typed memory_type: str (not
    // Optional[str]); the canonical schema preserves that.
    raw_text: "memory-type-null test",
    memory_type: null
  },
  {
    // Explicit null on a non-nullable string field (source_provider).
    raw_text: "source-provider-null test",
    source_provider: null
  },
  {
    // Non-object body (the keystone must reject a scalar at the top
    // level — a producer that sent `null` or `"string"` must not
    // slip through).
    "not-an-object": "scalar-string test"
  }
];

let pass = 0, fail = 0;
const failures = [];

for (const body of validRequests) {
  const result = validate(body, 'memory-store-request');
  if (result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, errors: result.errors });
  }
}

for (const body of invalidRequests) {
  const result = validate(body, 'memory-store-request');
  if (!result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, note: 'expected INVALID but got VALID' });
  }
}

// Print individual case names for grep-ability + a final Results line.
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'memory-store-request');
  const caseName = `valid #${i + 1}: ${Object.keys(validRequests[i]).length} field(s)`;
  if (result.valid) {
    console.log(`  PASS: ${caseName}`);
  } else {
    console.log(`  FAIL: ${caseName} — ${JSON.stringify(result.errors)}`);
  }
}
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'memory-store-request');
  const firstKey = Object.keys(invalidRequests[i])[0];
  const firstVal = Object.values(invalidRequests[i])[0];
  const caseName = `invalid #${i + 1}: ${firstKey} = ${JSON.stringify(firstVal)}`;
  if (!result.valid) {
    console.log(`  PASS: ${caseName} rejected`);
  } else {
    console.log(`  FAIL: ${caseName} ACCEPTED (should be rejected)`);
  }
}

console.log(`Results: ${pass} passed, ${fail} failed`);

if (failures.length > 0) {
  console.error('Failures:', JSON.stringify(failures, null, 2));
  process.exit(1);
}
