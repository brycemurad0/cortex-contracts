/**
 * Round-trip test for the TrainingLabel (DRAFT v0) contract.
 *
 * Authored 2026-06-22 (connective-code lane: make the auto-labeling flywheel
 * produce Forge-consumable fuel). TrainingLabel is the raw quality_labels row
 * Quorum/Maestro writes per routed request and Forge's harvest reads. It is v0/
 * DRAFT, so this test pins the fields the flywheel produces and the optional
 * `provenance` block Forge's curate grounding gate requires, so the draft cannot
 * drift before promotion. Distinct from LearningTrace (route→outcome→grade→cost).
 */

const fs = require('fs');
const path = require('path');
const { validate } = require('./validator.js');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'training-label.schema.json'), 'utf8')
);

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('Testing TrainingLabel (v0) contract...\n');

console.log('Schema-shape invariants:');
check('$id is the v0 draft', schema.$id.endsWith('training-label.v0.json'));
check('overall is required (the judge headline score)', schema.required.includes('overall'));
check('prompt is required', schema.required.includes('prompt'));
check('provenance requires all three grounding fields',
  JSON.stringify(schema.properties.provenance.required) ===
  JSON.stringify(['source_url', 'source_commit_sha', 'license']));
check('provenance is closed (additionalProperties:false)',
  schema.properties.provenance.additionalProperties === false);

console.log('\nValid round-trips:');

// Grounded label — carries provenance, eligible as Forge training fuel.
const grounded = {
  decision_id: 'maestro-d740000c',
  timestamp: 1781214039.5,
  prompt_hash: 'a1b2c3d4e5f60718',
  prompt: 'Review this diff for correctness bugs.',
  domain: 'code',
  consensus_response: 'The off-by-one at line 42 will skip the last row...',
  gold_response: 'Bug: loop bound should be <= not <.',
  voter_responses: { 'or-opus': 'looks like an off-by-one', 'or-gpt5.5': 'bound is wrong' },
  model_votes: { 'or-opus': 0.91, 'or-gpt5.5': 0.88 },
  winning_tier: 'code',
  confidence: 0.9,
  dissent_score: 0.12,
  synthesized: 1,
  grounding_used: 1,
  accuracy: 5, completeness: 4, reasoning: 5, clarity: 5, usefulness: 5, overall: 5,
  judge_notes: 'caught the real bug',
  judge_model: 'claude-opus',
  latency_ms: 2200,
  lane: 'code-review',
  provenance: {
    source_url: 'https://github.com/this-live/cortex-suite/pull/123',
    source_commit_sha: 'd90c4a2bb7409e5e93d668a923a915fd273a23b6',
    license: 'proprietary'
  }
};

// Ungrounded label — no provenance. Honest fuel rejection downstream is correct.
const ungrounded = {
  decision_id: null,
  timestamp: 1781214100.0,
  prompt: 'What is 2+2?',
  domain: 'fast',
  consensus_response: '4',
  overall: 4
  // provenance intentionally absent
};

for (const [label, row] of [['grounded (with provenance)', grounded], ['ungrounded (no provenance)', ungrounded]]) {
  const r = validate(row, 'training-label');
  check(`${label} conforms`, r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

console.log('\nRequired-field omission rejection:');
for (const field of schema.required) {
  const partial = { ...grounded };
  delete partial[field];
  const r = validate(partial, 'training-label');
  check(`omitting required "${field}" is rejected`, !r.valid);
}

console.log('\nProvenance integrity:');
{
  // A partial provenance block (missing license) must be rejected — a half-grounded
  // label would slip past Forge's grounding gate and poison training.
  const bad = { ...grounded, provenance: { source_url: 'https://x/y', source_commit_sha: 'abc' } };
  const r = validate(bad, 'training-label');
  check('provenance missing license is rejected', !r.valid);
}
{
  const bad = { ...grounded, provenance: { ...grounded.provenance, license: 'WTFPL' } };
  const r = validate(bad, 'training-label');
  check('provenance with non-enum license is rejected', !r.valid);
}
{
  const bad = { ...grounded, provenance: { ...grounded.provenance, source_url: 'not a url' } };
  const r = validate(bad, 'training-label');
  check('provenance with malformed source_url is rejected', !r.valid);
}
{
  // null provenance is explicitly allowed (honest ungrounded).
  const ok = { ...grounded, provenance: null };
  const r = validate(ok, 'training-label');
  check('null provenance is allowed', r.valid);
}

console.log('\nScore-range violations:');
{
  const r = validate({ ...grounded, overall: 7 }, 'training-label');
  check('overall > 5 rejected (maximum:5)', !r.valid);
}
{
  const r = validate({ ...grounded, confidence: 1.4 }, 'training-label');
  check('confidence > 1 rejected (maximum:1)', !r.valid);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
