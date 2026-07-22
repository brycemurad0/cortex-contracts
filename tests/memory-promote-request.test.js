/**
 * Round-trip test for MemoryPromoteRequest contract (MNEM-WS2 keystone,
 * SCRUTINY §3 #15 / §4.1). Validates that sample POST /promote payloads
 * conform to the JSON schema, and that malformed payloads are rejected.
 * Mirrors the pattern of session-store-request.test.js +
 * memory-store-request.test.js.
 *
 * This is the CORTEX-SIDE contract test; the consumer-side wire-in test
 * (loader extension + handler wire-up) lives in the mnemos repo as
 * test_promote_keystone_boundary.py. Both are needed:
 *  - This test pins the contract surface (the schema file).
 *  - The mnemos test pins the runtime behavior (the loader reads the
 *    schema + the handler validates before store_payload).
 *
 * The keystone is `additionalProperties: false` — without it a producer
 * could inject rogue provenance fields or hidden attestor overrides
 * and the promotion audit log + the protected-root parent container's
 * promoted-ancestor recallability join would silently pick them up.
 */

const { validate } = require('./validator.js');

// Sample valid MemoryPromoteRequest payloads.
const validRequests = [
  {
    // Minimal — only the two required fields. The legacy posture
    // accepted an empty body for an auto-attested system promotion
    // (the system cron promotes receipts that pass a freshness
    // check), so the keystone declares attestor as `default: null`
    // + optional on the wire, and the HANDLER enforces the
    // "attestor required for non-system promotes" rule.
    memory_id: "mem_test_01",
    to_container: "cortex"
  },
  {
    // Full — every field set, including attestor + reason. This is
    // the shape a human-initiated promotion through the Surfaces
    // admin UI would send.
    memory_id: "mem_test_02",
    to_container: "thislive",
    attestor: "human:bryce",
    reason: "Manually promoted after manual review per session log X"
  },
  {
    // System cron attestation (the system:cron-name format is the
    // canonical machine-attestor). reason null is accepted.
    memory_id: "mem_test_03",
    to_container: "mnemos",
    attestor: "system:mnemos-receipt-validator",
    reason: null
  }
];

// Invalid payloads for negative testing.
const invalidRequests = [
  {
    // Missing required memory_id.
    to_container: "cortex"
  },
  {
    // Missing required to_container.
    memory_id: "mem_test_01"
  },
  {
    // Missing both required fields (empty body).
  },
  {
    // Empty memory_id (minLength:1 must reject).
    memory_id: "",
    to_container: "cortex"
  },
  {
    // Empty to_container (minLength:1 must reject).
    memory_id: "mem_test_01",
    to_container: ""
  },
  {
    // Explicit null on a required field (memory_id).
    memory_id: null,
    to_container: "cortex"
  },
  {
    // Explicit null on a required field (to_container).
    memory_id: "mem_test_01",
    to_container: null
  },
  {
    // Bad memory_id type (integer, not string).
    memory_id: 12345,
    to_container: "cortex"
  },
  {
    // Bad to_container type (array, not string).
    memory_id: "mem_test_01",
    to_container: ["cortex"]
  },
  {
    // Unknown top-level field (additionalProperties: false must reject).
    memory_id: "mem_test_01",
    to_container: "cortex",
    sneaky_undeclared_field: "injected-by-misbehaving-producer"
  }
];

let pass = 0, fail = 0;
const failures = [];

for (const body of validRequests) {
  const result = validate(body, 'memory-promote-request');
  if (result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, errors: result.errors });
  }
}

for (const body of invalidRequests) {
  const result = validate(body, 'memory-promote-request');
  if (!result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, note: 'expected INVALID but got VALID' });
  }
}

// Print individual case names for grep-ability + a final Results line.
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'memory-promote-request');
  const caseName = `valid #${i + 1}: ${Object.keys(validRequests[i]).length} field(s)`;
  if (result.valid) {
    console.log(`  PASS: ${caseName}`);
  } else {
    console.log(`  FAIL: ${caseName} — ${JSON.stringify(result.errors)}`);
  }
}
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'memory-promote-request');
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
