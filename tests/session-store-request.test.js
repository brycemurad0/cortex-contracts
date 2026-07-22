/**
 * Round-trip test for SessionStoreRequest contract (MNEM-WS4 keystone, SCRUTINY §3 #15 / §4.1).
 * Validates that sample /sessions/{session_id}/store payloads conform to the
 * JSON schema, and that malformed payloads are rejected. Mirrors the
 * pattern of task-enqueue-request.test.js.
 *
 * This is the CORTEX-SIDE contract test; the consumer-side wire-in test
 * (loader extension + handler wire-up) lives in the mnemos repo as
 * test_session_store_keystone_boundary.py. Both are needed:
 *  - This test pins the contract surface (the schema file).
 *  - The mnemos test pins the runtime behavior (the loader reads the
 *    schema + the handler validates before store_payload).
 *
 * The keystone is `additionalProperties: false` — without it a producer
 * could inject rogue provenance fields or hidden session_id /
 * container_tag overrides and the session-run audit log + the
 * session-scoped working-memory container would silently pick them up.
 */

const { validate } = require('./validator.js');

// Sample valid SessionStoreRequest payloads (the
// agent-fabric dynamic-workflow engine per-turn writes look exactly
// like the minimal case — raw_text only).
const validRequests = [
  {
    // Minimal — only the required raw_text field. This is the
    // agent-fabric dynamic-workflow engine's per-turn write shape.
    raw_text: "MNEM-WS4 keystone test — session working-memory write."
  },
  {
    // Full — every optional field set. Pins that the keystone
    // accepts the full surface a producer might send, including
    // the `metadata` sub-object (the only `additionalProperties:true`
    // relaxation in the entire schema).
    raw_text: "MNEM-WS4 keystone test — maximal session working-memory write.",
    memory_type: "episodic",
    actor_id: "test-actor",
    actor_class: "agent",
    confidence: 0.85,
    source_provider: "test",
    source_record_id: "ws4-test-001",
    source_node: "test-node",
    source_surface: "pytest",
    metadata: { trace_id: "abc-123", span_id: "def-456" }
  },
  {
    // Optional nullable fields explicitly null (must be accepted).
    // The two non-nullable string fields (memory_type, source_provider)
    // are OMITTED — they have server-side defaults that fill in
    // when missing, but explicit null is NOT the same as missing
    // (the legacy Pydantic posture typed them as `str` not
    // `Optional[str]`, and the canonical schema preserves that).
    raw_text: "MNEM-WS4 keystone test — null-on-truly-optional.",
    actor_id: null,
    actor_class: null,
    confidence: null,
    source_record_id: null,
    source_node: null,
    source_surface: null,
    metadata: null
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
    // SUBSET POSTURE: container_tag is a /store-only field server-stamped
    // by the session-store handler. A producer that tries to send it
    // must be rejected (the contract drift gate).
    raw_text: "container-tag-override attempt",
    container_tag: "evil-override-attempt"
  },
  {
    // SUBSET POSTURE: session_id is a /store-only field server-stamped
    // from the URL path. A producer that tries to forge it must be
    // rejected.
    raw_text: "session-id-forgery attempt",
    session_id: "sess_forged"
  },
  {
    // SUBSET POSTURE: valid_from is a /store-only field server-stamped
    // on the bare /store endpoint. A producer that tries to send it
    // on /sessions/{id}/store must be rejected.
    raw_text: "valid-from-leak attempt",
    valid_from: "2026-06-13T08:30:00Z"
  },
  {
    // SUBSET POSTURE: memory_block_level is a /store-only field.
    raw_text: "memory-block-level-leak attempt",
    memory_block_level: 0
  },
  {
    // SUBSET POSTURE: is_synthesized is a /store-only field.
    raw_text: "is-synthesized-leak attempt",
    is_synthesized: true
  },
  {
    // SUBSET POSTURE: parent_memory_id is a /store-only field.
    raw_text: "parent-memory-id-leak attempt",
    parent_memory_id: "mem_test_01"
  },
  {
    // SUBSET POSTURE: promoted is a /store-only field.
    raw_text: "promoted-leak attempt",
    promoted: true
  },
  {
    // Bad memory_type enum value.
    raw_text: "bad-memory-type test",
    memory_type: "not_a_real_memory_type"
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
  }
];

let pass = 0, fail = 0;
const failures = [];

for (const body of validRequests) {
  const result = validate(body, 'session-store-request');
  if (result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, errors: result.errors });
  }
}

for (const body of invalidRequests) {
  const result = validate(body, 'session-store-request');
  if (!result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, note: 'expected INVALID but got VALID' });
  }
}

// Print individual case names for grep-ability + a final Results line.
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'session-store-request');
  const caseName = `valid #${i + 1}: ${Object.keys(validRequests[i]).length} field(s)`;
  if (result.valid) {
    console.log(`  PASS: ${caseName}`);
  } else {
    console.log(`  FAIL: ${caseName} — ${JSON.stringify(result.errors)}`);
  }
}
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'session-store-request');
  const caseName = `invalid #${i + 1}: ${Object.keys(invalidRequests[i])[0]} = ${JSON.stringify(Object.values(invalidRequests[i])[0])}`;
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
