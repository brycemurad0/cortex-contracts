/**
 * Round-trip test for SessionPromoteOnCloseRequest contract (MNEM-WS3
 * keystone, SCRUTINY §3 #15 / §4.1). Validates that sample
 * POST /sessions/{session_id}/promote-on-close payloads conform to the
 * JSON schema, and that malformed payloads are rejected. Mirrors the
 * pattern of session-store-request.test.js + memory-store-request.test.js.
 *
 * This is the CORTEX-SIDE contract test; the consumer-side wire-in test
 * (loader extension + handler wire-up) lives in the mnemos repo as
 * test_session_promote_on_close_keystone_boundary.py. Both are needed:
 *  - This test pins the contract surface (the schema file).
 *  - The mnemos test pins the runtime behavior (the loader reads the
 *    schema + the handler validates before close_session).
 *
 * The keystone is `additionalProperties: false` — without it a producer
 * could inject rogue provenance fields or hidden attestor overrides
 * and the session-run audit log + the parent container's
 * promoted-ancestor recallability join would silently pick them up.
 *
 * All fields are OPTIONAL on the wire — the schema declares them as
 * nullable + server-defaults, mirroring the legacy Pydantic posture.
 * The keystone's first pass is SHAPE-only; the handler's second pass
 * enforces the business rules (attestor required for non-empty promote
 * lists, to_container must resolve to a container, etc.).
 */

const { validate } = require('./validator.js');

// Sample valid SessionPromoteOnCloseRequest payloads.
const validRequests = [
  {
    // Minimal — empty body. The legacy posture accepted an empty
    // body that means "sweep all unpromoted memories on close with
    // the session default scope" (hermes-plugin close hooks rely
    // on this). The keystone accepts the empty body as valid
    // (no required fields, all optional/nullable), and the
    // HANDLER applies the session-default sweep.
  },
  {
    // Full — every field set, including a non-empty promote list
    // with the run-id attestor. This is the shape a Maestro
    // session-run lifecycle close hook would send at the end of
    // a run.
    promote_memory_ids: ["mem_a", "mem_b", "mem_c"],
    to_container: "cortex",
    attestor: "mvs_01KTZMADMYJYC5FKFKAKJRS29F",
    reason: "Maestro run complete; promote the 3 anchored memories to cortex"
  },
  {
    // Explicit null on every field (must be accepted — all fields
    // are optional + nullable). This pins the keystone's null-
    // tolerance posture, which the handler relies on for the
    // "sweep everything, no explicit promote" path.
    promote_memory_ids: null,
    to_container: null,
    attestor: null,
    reason: null
  },
  {
    // Empty array on promote_memory_ids (different from null:
    // null = no promote-list specified; [] = promote nothing,
    // sweep everything unpromoted — the hermes-plugin close hook
    // path).
    promote_memory_ids: [],
    to_container: "thislive",
    attestor: "system:hermes-close-hook"
  },
  {
    // Single-item promote list with the run-id attestor (the
    // minimal Maestro run that promotes exactly one anchored
    // memory). The keystone accepts minLength:1 strings here
    // (the items schema enforces `minLength: 1`).
    promote_memory_ids: ["mem_anchored_01"],
    to_container: "mnemos",
    attestor: "mvs_01KTZMABCDEF"
  }
];

// Invalid payloads for negative testing.
const invalidRequests = [
  {
    // Bad promote_memory_ids type (string, not array).
    promote_memory_ids: "not-an-array"
  },
  {
    // promote_memory_ids array contains a non-string element
    // (integer). The items schema is `type: string` so an int
    // must be rejected.
    promote_memory_ids: ["mem_a", 42, "mem_c"]
  },
  {
    // promote_memory_ids array contains an empty string
    // (minLength: 1 must reject).
    promote_memory_ids: ["mem_a", "", "mem_c"]
  },
  {
    // Bad to_container type (integer, not string).
    to_container: 42
  },
  {
    // Bad attestor type (boolean, not string-or-null).
    attestor: true
  },
  {
    // Bad reason type (integer, not string-or-null).
    reason: 12345
  },
  {
    // Unknown top-level field (additionalProperties: false must
    // reject). This is the keystone — a producer that tries to
    // inject e.g. a forged `attestor_override` or a hidden
    // `parent_run_id` must be rejected.
    sneaky_undeclared_field: "injected-by-misbehaving-producer"
  },
  {
    // Unknown top-level field WITH a valid nested promote list
    // (the keystone fires on the top-level rogue field, NOT on
    // the valid nested data — the producer's positive intent
    // does not save the rogue field).
    promote_memory_ids: ["mem_a"],
    to_container: "cortex",
    attestor: "mvs_01KTZ",
    sneaky_undeclared_field: "rogue"
  }
];

let pass = 0, fail = 0;
const failures = [];

for (const body of validRequests) {
  const result = validate(body, 'session-promote-on-close-request');
  if (result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, errors: result.errors });
  }
}

for (const body of invalidRequests) {
  const result = validate(body, 'session-promote-on-close-request');
  if (!result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, note: 'expected INVALID but got VALID' });
  }
}

// Print individual case names for grep-ability + a final Results line.
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'session-promote-on-close-request');
  const fieldCount = Object.keys(validRequests[i]).length;
  const caseName = `valid #${i + 1}: ${fieldCount} field(s)`;
  if (result.valid) {
    console.log(`  PASS: ${caseName}`);
  } else {
    console.log(`  FAIL: ${caseName} — ${JSON.stringify(result.errors)}`);
  }
}
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'session-promote-on-close-request');
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
