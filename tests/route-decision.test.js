/**
 * Round-trip test for the RouteDecision (DRAFT v0) contract.
 *
 * Authored 2026-06-11 (Phase 7 governance close-out, contracts-debt fill).
 * RouteDecision is Maestro's per-request routing record (README §Drafts v0),
 * the join target for ExecutionReceipt.decision_id and Quorum labels. It was
 * the third contract flagged test-less by the 2026-06-04 conformance audit
 * (F-4). It is v0/DRAFT, so this test does NOT gate on a versioned-but-frozen
 * shape the way the ratified-contract tests do; it pins the fields the spine
 * and Maestro already consume so the draft cannot drift before promotion.
 */

const fs = require('fs');
const path = require('path');
const { validate } = require('./validator.js');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'route-decision.schema.json'), 'utf8')
);

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('Testing RouteDecision (v0) contract...\n');

console.log('Schema-shape invariants:');
check('$id is the v0 draft', schema.$id.endsWith('route-decision.v0.json'));
check('routing_mode enum matches the 5 Maestro modes',
  JSON.stringify(schema.properties.routing_mode.enum) ===
  JSON.stringify(['sonnet-anchored', 'vega-direct', 'vega-blocking-quorum', 'passthrough', 'fallback-sql']));
check('tier enum matches the 4 task tiers',
  JSON.stringify(schema.properties.tier.enum) ===
  JSON.stringify(['trivial', 'simple', 'standard', 'complex']));
check('decision_id is required (the join key)', schema.required.includes('decision_id'));
check('additionalProperties is false', schema.additionalProperties === false);

console.log('\nValid round-trips:');

// Full record — every field set, spine-invoked (task_id present).
const fullDecision = {
  decision_id: 'dec_01HX0000000000000000000001',
  task_id: '11111111-1111-4111-8111-111111111111',
  tier: 'complex',
  routing_mode: 'vega-blocking-quorum',
  model: 'minimax-direct',
  vega_confidence: 0.82,
  consensus_fired: true,
  fallback_chain: ['claude-opus-4-8', 'gpt-5.5', 'sparky-sglang'],
  session_id: 'sess_01HX',
  decided_at: '2026-06-11T12:00:00Z'
};

// Direct-caller record — task_id/session_id/vega_confidence null (nullable per schema).
const directDecision = {
  decision_id: 'dec_01HX0000000000000000000002',
  task_id: null,
  tier: 'simple',
  routing_mode: 'passthrough',
  model: 'sparky-sglang',
  vega_confidence: null,
  consensus_fired: false,
  fallback_chain: [],
  session_id: null,
  decided_at: '2026-06-11T12:05:00Z'
};

for (const [label, dec] of [['full (spine-invoked)', fullDecision], ['direct-caller (nulls)', directDecision]]) {
  const r = validate(dec, 'route-decision');
  check(`${label} conforms`, r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

console.log('\nRequired-field omission rejection:');
for (const field of schema.required) {
  const partial = { ...fullDecision };
  delete partial[field];
  const r = validate(partial, 'route-decision');
  check(`omitting required "${field}" is rejected`, !r.valid);
}

console.log('\nType / enum / constraint violations:');
{
  const r = validate({ ...fullDecision, routing_mode: 'random' }, 'route-decision');
  check('invalid routing_mode rejected', !r.valid);
}
{
  const r = validate({ ...fullDecision, tier: 'epic' }, 'route-decision');
  check('invalid tier rejected', !r.valid);
}
{
  const r = validate({ ...fullDecision, vega_confidence: 1.4 }, 'route-decision');
  check('vega_confidence > 1 rejected (maximum:1)', !r.valid);
}
{
  const r = validate({ ...fullDecision, vega_confidence: -0.1 }, 'route-decision');
  check('vega_confidence < 0 rejected (minimum:0)', !r.valid);
}
{
  const r = validate({ ...fullDecision, decision_id: '' }, 'route-decision');
  check('empty decision_id rejected (minLength:1)', !r.valid);
}
{
  const r = validate({ ...fullDecision, bogus: 'x' }, 'route-decision');
  check('unknown top-level field rejected (additionalProperties:false)', !r.valid);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
