/**
 * Round-trip test for SynthesisRequest contract (MNEM-WS5 keystone, SCRUTINY §3 #15 / §4.1).
 * Validates that sample /synthesize payloads conform to the JSON
 * schema, and that malformed payloads are rejected. Mirrors the
 * pattern of session-store-request.test.js.
 *
 * This is the CORTEX-SIDE contract test; the consumer-side wire-in test
 * (loader extension + handler wire-up) lives in the mnemos repo as
 * test_synthesis_keystone_boundary.py. Both are needed:
 *  - This test pins the contract surface (the schema file).
 *  - The mnemos test pins the runtime behavior (the loader reads the
 *    schema + the handler validates before the recall engine runs).
 *
 * The keystone is `additionalProperties: false` — without it a producer
 * could inject rogue fields (e.g. undeclared `confidence` overrides
 * that mask the stub's hard-coded 'medium', hidden `limit` to
 * exfiltrate the full corpus, or `debug_dump` flags that bypass the
 * synthesis envelope). The /synthesize response is server-stamped
 * (query, container_tag, synthesis_type, facts, memory_count,
 * confidence) and is NEVER accepted on input — this contract pins
 * the INPUT shape only.
 */

const { validate } = require('./validator.js');

// Sample valid SynthesisRequest payloads.
const validRequests = [
  {
    // Minimal — only the required `query` field. The mavis admin
    // /synthesize probe and the hermes-plugin recall hook both
    // send exactly this shape (the server-side defaults fill in
    // `container_tag` and `synthesis_type`).
    query: "MNEM-WS5 keystone test — minimal recall-summarization request."
  },
  {
    // Full — every optional field set. Pins that the keystone
    // accepts the full surface a producer might send, including
    // a custom `synthesis_type` (the schema intentionally does NOT
    // pin a synthesis_type enum so future producers can send
    // 'executive_summary' / 'narrative' / 'decision_brief'
    // without a schema bump).
    query: "MNEM-WS5 keystone test — maximal recall-summarization request.",
    container_tag: "cortex/hermes",
    synthesis_type: "executive_summary"
  },
  {
    // Default synthesis_type explicitly set to the legacy
    // Pydantic default — pins that the schema's `default`
    // keyword is honored on missing/empty wire (the handler
    // is responsible for any behavior switch on this field;
    // the keystone pins the SHAPE only).
    query: "MNEM-WS5 keystone test — default synthesis_type.",
    synthesis_type: "structured_truth"
  },
  {
    // Empty container_tag is allowed on the wire — the server
    // normalizes via normalize_container_tag() to the default
    // 'hermes'. Pinned here so a future regression that
    // requires a non-empty container_tag surfaces immediately.
    query: "MNEM-WS5 keystone test — empty container_tag.",
    container_tag: ""
  }
];

// Invalid payloads for negative testing.
const invalidRequests = [
  {
    // Missing required `query` field. Empty-body posture: a
    // body with no `query` is INVALID (the schema requires
    // it; empty queries would let a producer probe the full
    // container silently).
    container_tag: "cortex/hermes",
    synthesis_type: "structured_truth"
  },
  {
    // Empty `query` (minLength:1 must reject).
    query: ""
  },
  {
    // Unknown top-level field (additionalProperties: false must reject).
    // The keystone's primary job: catch rogue fields the legacy
    // Pydantic typing would have silently dropped.
    query: "rogue-confidence-override attempt",
    confidence: "high"
  },
  {
    // Unknown top-level field — `limit` would let a producer
    // exfiltrate the full corpus by setting limit:99999.
    query: "rogue-limit-override attempt",
    limit: 99999
  },
  {
    // Unknown top-level field — `debug_dump` would let a
    // producer bypass the synthesis envelope.
    query: "rogue-debug-dump attempt",
    debug_dump: true
  },
  {
    // Unknown top-level field — `container_tag` is allowed but
    // `tags` (plural, array) is not on the wire.
    query: "rogue-tags-array attempt",
    tags: ["rogue", "tags"]
  },
  {
    // Bad `query` type (integer, not string).
    query: 42
  },
  {
    // Bad `container_tag` type (array, not string).
    query: "bad-container-tag-type test",
    container_tag: ["evil", "array"]
  },
  {
    // Bad `synthesis_type` type (object, not string).
    query: "bad-synthesis-type-type test",
    synthesis_type: { mode: "executive" }
  },
  {
    // Explicit null on `query` (required, not nullable).
    query: null
  },
  {
    // Explicit null on `container_tag`. The legacy Pydantic
    // posture typed container_tag: str = 'hermes' (not
    // Optional[str]); the canonical schema preserves that.
    // An explicit null is rejected.
    query: "container-tag-null test",
    container_tag: null
  }
];

let pass = 0, fail = 0;
const failures = [];

for (const body of validRequests) {
  const result = validate(body, 'synthesis-request');
  if (result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, errors: result.errors });
  }
}

for (const body of invalidRequests) {
  const result = validate(body, 'synthesis-request');
  if (!result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, note: 'expected INVALID but got VALID' });
  }
}

// Print individual case names for grep-ability + a final Results line.
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'synthesis-request');
  const caseName = `valid #${i + 1}: ${Object.keys(validRequests[i]).length} field(s)`;
  if (result.valid) {
    console.log(`  PASS: ${caseName}`);
  } else {
    console.log(`  FAIL: ${caseName} — ${JSON.stringify(result.errors)}`);
  }
}
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'synthesis-request');
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
