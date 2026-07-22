/**
 * Round-trip test for AdminUpdateNodeRequest contract (MNEM-WS9 keystone, SCRUTINY §3 #15 / §4.1).
 * Validates that sample /admin/update-node payloads conform to the JSON
 * schema, and that malformed payloads are rejected. Mirrors the
 * pattern of synthesis-request.test.js.
 *
 * This is the CORTEX-SIDE contract test; the consumer-side wire-in test
 * (loader extension + handler wire-up) lives in the mnemos repo as
 * test_admin_update_node_keystone_boundary.py. Both are needed:
 *  - This test pins the contract surface (the schema file).
 *  - The mnemos test pins the runtime behavior (the loader reads the
 *    schema + the handler validates before the UPDATE statement runs).
 *
 * The keystone is `additionalProperties: false` — without it a producer
 * could inject rogue fields (e.g. undeclared `last_heartbeat` to spoof
 * a healthy liveness when the node is actually down, a hidden
 * `token_override` to bypass the `require_token` dependency on a future
 * rewire, a `force_offline` flag that would silently reclassify a live
 * node). The /admin/update-node response is server-stamped
 * ({status, node_id}) and is NEVER accepted on input — this contract
 * pins the INPUT shape only.
 */

const { validate } = require('./validator.js');

// Sample valid AdminUpdateNodeRequest payloads.
const validRequests = [
  {
    // Minimal — only the required `node_id` field. The server-side
    // default fills in `status='online'`; `notes` defaults to null.
    // The health-check cron posts exactly this shape on every tick
    // for nodes that have no operator annotation.
    node_id: "node-1"
  },
  {
    // Full — every field set. The operator's manual override path:
    // status='degraded' with a notes annotation. Pins that the
    // keystone accepts the full surface a producer might send.
    node_id: "node-2",
    status: "degraded",
    notes: "redis latency spike at 2026-06-14T03:30:00Z"
  },
  {
    // Default status explicitly set to 'online' — pins that the
    // schema's `default` keyword is honored on missing/empty wire
    // (the handler is responsible for any normalization on this
    // field; the keystone pins the SHAPE only).
    node_id: "node-3",
    status: "online"
  },
  {
    // Explicit null on `notes` — pins that nullable works on the
    // wire. The legacy Pydantic posture typed notes as
    // Optional[str] = None; the canonical schema preserves that.
    node_id: "node-4",
    status: "draining",
    notes: null
  },
  {
    // Empty string on `notes` is allowed on the wire — the keystone
    // pins SHAPE only; the handler can normalize empty-string to
    // null if it chooses. Pinned here so a future regression that
    // requires a non-empty notes surfaces immediately.
    node_id: "node-5",
    status: "online",
    notes: ""
  }
];

// Invalid payloads for negative testing.
const invalidRequests = [
  {
    // Missing required `node_id` field. Empty-body posture: a
    // body with no `node_id` is INVALID (the schema requires it;
    // missing node_id would either no-op silently — the WHERE
    // clause matches nothing — or, worse, be filled with a
    // server-side default that overwrites the first row).
    status: "online"
  },
  {
    // Empty `node_id` (minLength:1 must reject).
    node_id: ""
  },
  {
    // Unknown top-level field — additionalProperties:false must
    // reject. The keystone's primary job: catch rogue fields the
    // legacy Pydantic typing would have silently dropped. A
    // `last_heartbeat` field would let a producer spoof a healthy
    // liveness when the node is actually down.
    node_id: "node-spoof-attempt",
    last_heartbeat: "2099-12-31T23:59:59Z"
  },
  {
    // Unknown top-level field — `token_override` would let a
    // producer bypass the `require_token` dependency on a future
    // rewire.
    node_id: "node-token-override-attempt",
    token_override: "Bearer evil-token"
  },
  {
    // Unknown top-level field — `force_offline` flag would let a
    // producer silently reclassify a live node as offline.
    node_id: "node-force-offline-attempt",
    force_offline: true
  },
  {
    // Bad `node_id` type (integer, not string).
    node_id: 42
  },
  {
    // Bad `status` type (array, not string).
    node_id: "node-bad-status-type",
    status: ["evil", "array"]
  },
  {
    // Bad `notes` type (object, not string-or-null).
    node_id: "node-bad-notes-type",
    notes: { reason: "struct" }
  },
  {
    // Explicit null on `node_id` (required, not nullable). The
    // legacy Pydantic posture typed node_id: str (not
    // Optional[str]); the canonical schema preserves that. An
    // explicit null is rejected.
    node_id: null
  },
  {
    // Explicit null on `status`. The legacy Pydantic posture
    // typed status: str = 'online' (not Optional[str]); the
    // canonical schema preserves that. An explicit null is
    // rejected.
    node_id: "node-status-null",
    status: null
  },
  {
    // Empty `status` (minLength:1 must reject). The legacy
    // Pydantic posture typed status: str = 'online'; an empty
    // string would be a silent typo bug — the keystone rejects
    // it explicitly.
    node_id: "node-empty-status",
    status: ""
  }
];

let pass = 0, fail = 0;
const failures = [];

for (const body of validRequests) {
  const result = validate(body, 'admin-update-node-request');
  if (result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, errors: result.errors });
  }
}

for (const body of invalidRequests) {
  const result = validate(body, 'admin-update-node-request');
  if (!result.valid) {
    pass++;
  } else {
    fail++;
    failures.push({ body, note: 'expected INVALID but got VALID' });
  }
}

// Print individual case names for grep-ability + a final Results line.
for (let i = 0; i < validRequests.length; i++) {
  const result = validate(validRequests[i], 'admin-update-node-request');
  const caseName = `valid #${i + 1}: ${Object.keys(validRequests[i]).length} field(s)`;
  if (result.valid) {
    console.log(`  PASS: ${caseName}`);
  } else {
    console.log(`  FAIL: ${caseName} — ${JSON.stringify(result.errors)}`);
  }
}
for (let i = 0; i < invalidRequests.length; i++) {
  const result = validate(invalidRequests[i], 'admin-update-node-request');
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
