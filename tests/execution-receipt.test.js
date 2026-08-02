/**
 * Round-trip test for the ExecutionReceipt (v1) contract.
 *
 * Authored 2026-06-11 (Phase 7 governance close-out, contracts-debt fill).
 * ExecutionReceipt is one of the two RATIFIED spine wire-format contracts
 * (ADR-0017, README §Ratified) and was the last ratified contract with no
 * round-trip test (the 2026-06-04 conformance audit F-4 gap; TaskEnvelope's
 * own test landed in Phase 2).
 *
 * v1's whole point is that ONE shape covers THREE producers:
 *   (1) spine-orchestrated — the n8n/Fabric worker path; carries the
 *       orchestration-join fields (af_dispatch_id, af_worker_session_id,
 *       decision_id).
 *   (2) Hermes tracked-bypass — no af_* join fields (null/absent).
 *   (3) surface-direct — pocket-agent/PLO/fleet-terminal; carries a
 *       `dispatch` block, no af_* join fields.
 * Per ADR-0017 those join fields are OPTIONAL precisely so bypass/direct
 * receipts are representable. This test pins all three so a future
 * "tighten the schema" change cannot silently re-forbid two of the three
 * producers (the exact over-constraint the v0 draft had).
 *
 * It also pins `receipt_id` as a required, client-generated idempotency key
 * (minLength 1) so dedupe-by-receipt_id stays safe across outbox retries.
 */

const fs = require('fs');
const path = require('path');
const { validate } = require('./validator.js');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'execution-receipt.schema.json'), 'utf8')
);

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('Testing ExecutionReceipt (v1) contract...\n');

// ── Schema-shape invariants (the ratified-v1 guarantees) ──
console.log('Schema-shape invariants:');
check('$id is versioned (.v1.json)', schema.$id.endsWith('execution-receipt.v1.json'));
check('outcome enum is exactly the canonical 4',
  JSON.stringify(schema.properties.outcome.enum) ===
  JSON.stringify(['succeeded', 'failed', 'cancelled', 'timed_out']));
check('receipt_id is required + minLength 1 (idempotency key)',
  schema.required.includes('receipt_id') &&
  schema.properties.receipt_id.minLength === 1);
for (const joinField of ['af_dispatch_id', 'af_worker_session_id', 'decision_id']) {
  check(`orchestration-join field "${joinField}" is OPTIONAL (not in required)`,
    !schema.required.includes(joinField));
  check(`"${joinField}" accepts null (bypass/direct producers)`,
    Array.isArray(schema.properties[joinField].type) &&
    schema.properties[joinField].type.includes('null'));
}
check('additionalProperties is false', schema.additionalProperties === false);

// ── The three producer shapes all round-trip ──
console.log('\nThree-producer round-trips (the v1 acceptance gate):');

// (1) spine-orchestrated — carries all three join fields
const spineOrchestrated = {
  receipt_id: 'rcp_01HX0000000000000000000001',
  task_id: '11111111-1111-4111-8111-111111111111',
  af_dispatch_id: 'disp_01HX',
  af_worker_session_id: 'sess_01HX',
  decision_id: 'dec_01HX',
  root_conversation_id: 'conversation_01HX',
  parent_session_id: 'session_01HX',
  parent_task_id: 'task_parent_01HX',
  memory_scope: 'cortex/second-brain',
  policy_version: '1.2.0',
  policy_hash: '31b1251955590c80704cf4c78feae6ad6267bcb15dc16c728ff5d39ccd355bb9',
  node: 'jarvis',
  assigned_agent: 'claude-code',
  outcome: 'succeeded',
  exit_code: 0,
  started_at: '2026-06-11T12:00:00Z',
  ended_at: '2026-06-11T12:03:20Z',
  duration_ms: 200000,
  cost: { input_tokens: 1200, output_tokens: 340, usd_cents: 1 },
  result_summary: 'fixed the flaky test',
  result_pointer: 'mnemos://cortex/agent-fabric/receipt-1',
  acceptance_criteria_evaluated: true,
  acceptance_criteria_passed: true,
  reviewer_critique: null,
  error: null
};

// (2) Hermes tracked-bypass — no af_* join fields, no dispatch block
const hermesBypass = {
  receipt_id: 'rcp_01HX0000000000000000000002',
  task_id: 'hermes-task-7c2e91',
  af_dispatch_id: null,
  af_worker_session_id: null,
  decision_id: null,
  node: 'sparky',
  assigned_agent: 'hermes-codex',
  outcome: 'succeeded',
  started_at: '2026-06-11T12:10:00Z',
  ended_at: '2026-06-11T12:10:45Z',
  duration_ms: 45000
};

// (3) surface-direct — carries a dispatch block, no af_* join fields
const surfaceDirect = {
  receipt_id: 'rcp_01HX0000000000000000000003',
  task_id: 'pocket-agent-abc',
  node: 'jarvis',
  assigned_agent: 'claude-code',
  outcome: 'failed',
  exit_code: 1,
  started_at: '2026-06-11T12:20:00Z',
  ended_at: '2026-06-11T12:21:00Z',
  duration_ms: 60000,
  error: 'task aborted by user',
  dispatch: {
    source: 'pocket-agent',
    intent: 'task',
    response_mode: 'async-orchestrated',
    project_scope: 'agent-fabric',
    memory_scope: 'cortex/agent-fabric'
  }
};

for (const [label, env] of [
  ['spine-orchestrated', spineOrchestrated],
  ['Hermes tracked-bypass', hermesBypass],
  ['surface-direct (dispatch block)', surfaceDirect]
]) {
  const r = validate(env, 'execution-receipt');
  check(`${label} receipt conforms`, r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

// ── Minimal valid receipt (only the 8 required fields) ──
console.log('\nMinimal valid receipt (required-only):');
const minimal = {
  receipt_id: 'rcp_min',
  task_id: 't-min',
  node: 'jarvis',
  assigned_agent: 'claude-code',
  outcome: 'cancelled',
  started_at: '2026-06-11T12:30:00Z',
  ended_at: '2026-06-11T12:30:01Z',
  duration_ms: 1000
};
{
  const r = validate(minimal, 'execution-receipt');
  check('minimal (8 required fields only) conforms', r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

// ── Required-field omissions are rejected ──
console.log('\nRequired-field omission rejection:');
for (const field of schema.required) {
  const partial = { ...minimal };
  delete partial[field];
  const r = validate(partial, 'execution-receipt');
  check(`omitting required "${field}" is rejected`, !r.valid);
}

// ── Type / enum / constraint violations are rejected ──
console.log('\nType / enum / constraint violations:');
{
  // empty receipt_id violates minLength:1 (the idempotency-key guarantee)
  const r = validate({ ...minimal, receipt_id: '' }, 'execution-receipt');
  check('empty receipt_id rejected (minLength:1 idempotency guarantee)', !r.valid);
}
{
  // outcome outside the canonical 4 (the v0->v1 enum correction: no "success"/"failure"/"timeout")
  const r = validate({ ...minimal, outcome: 'success' }, 'execution-receipt');
  check('legacy outcome "success" rejected (canonical enum is succeeded/failed/cancelled/timed_out)', !r.valid);
}
{
  // negative duration violates minimum:0
  const r = validate({ ...minimal, duration_ms: -5 }, 'execution-receipt');
  check('negative duration_ms rejected (minimum:0)', !r.valid);
}
{
  // unknown top-level field (additionalProperties:false)
  const r = validate({ ...minimal, bogus_field: 'nope' }, 'execution-receipt');
  check('unknown top-level field rejected (additionalProperties:false)', !r.valid);
}
{
  const r = validate({ ...minimal, policy_hash: 'not-a-sha256' }, 'execution-receipt');
  check('invalid policy_hash rejected', !r.valid);
}
{
  // unknown dispatch sub-field (the dispatch block is also additionalProperties:false)
  const r = validate(
    { ...minimal, dispatch: { source: 'pocket-agent', bogus: 'x' } },
    'execution-receipt'
  );
  check('unknown dispatch sub-field rejected (nested additionalProperties:false)', !r.valid);
}
{
  // invalid dispatch.source enum
  const r = validate(
    { ...minimal, dispatch: { source: 'slack' } },
    'execution-receipt'
  );
  check('invalid dispatch.source enum rejected', !r.valid);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
