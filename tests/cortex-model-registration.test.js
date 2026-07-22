/**
 * Round-trip test for the CortexModelRegistration (DRAFT v0) contract.
 *
 * Authored 2026-06-22 (connective-code lane: the Forge→Maestro egress seam).
 * Forge POSTs this on a gate-pass so Maestro routes a served adapter local-first,
 * closing the recursive flywheel. It is v0/DRAFT; this test pins the four required
 * fields and the artifact_sha256 idempotency-key shape so the draft cannot drift
 * before promotion.
 */

const fs = require('fs');
const path = require('path');
const { validate } = require('./validator.js');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'cortex-model-registration.schema.json'), 'utf8')
);

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('Testing CortexModelRegistration (v0) contract...\n');

const SHA = 'a'.repeat(64);

console.log('Schema-shape invariants:');
check('$id is the v0 draft', schema.$id.endsWith('cortex-model-registration.v0.json'));
check('additionalProperties is false', schema.additionalProperties === false);
check('the four egress fields are required',
  JSON.stringify(schema.required) ===
  JSON.stringify(['discipline_key', 'location', 'eval_pointer', 'artifact_sha256']));
check('artifact_sha256 is a 64-hex pattern',
  schema.properties.artifact_sha256.pattern === '^[0-9a-f]{64}$');

console.log('\nValid round-trips:');

// Full gate-pass registration.
const full = {
  discipline_key: 'code_review',
  location: 'forge-code-review-lora-v0',
  eval_pointer: 'evals/results/code_review_adapter_2026-06-22.json',
  artifact_sha256: SHA,
  served: true,
  base_score: 0.4727,
  adapter_score: 0.55,
  registered_at: '2026-06-22T12:00:00Z'
};

// Minimal registration — only the four required fields.
const minimal = {
  discipline_key: 'security',
  location: 'forge-security-lora-v0',
  eval_pointer: 'evals/results/security_adapter_2026-06-22.json',
  artifact_sha256: 'f'.repeat(64)
};

for (const [label, reg] of [['full', full], ['minimal (required-only)', minimal]]) {
  const r = validate(reg, 'cortex-model-registration');
  check(`${label} conforms`, r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

console.log('\nRequired-field omission rejection:');
for (const field of schema.required) {
  const partial = { ...full };
  delete partial[field];
  const r = validate(partial, 'cortex-model-registration');
  check(`omitting required "${field}" is rejected`, !r.valid);
}

console.log('\nType / pattern / constraint violations:');
{
  const r = validate({ ...full, artifact_sha256: 'deadbeef' }, 'cortex-model-registration');
  check('short artifact_sha256 rejected (pattern)', !r.valid);
}
{
  const r = validate({ ...full, artifact_sha256: ('A'.repeat(64)) }, 'cortex-model-registration');
  check('uppercase artifact_sha256 rejected (pattern is lowercase hex)', !r.valid);
}
{
  const r = validate({ ...full, discipline_key: '' }, 'cortex-model-registration');
  check('empty discipline_key rejected (minLength:1)', !r.valid);
}
{
  const r = validate({ ...full, adapter_score: 1.2 }, 'cortex-model-registration');
  check('adapter_score > 1 rejected (maximum:1)', !r.valid);
}
{
  const r = validate({ ...full, bogus: 'x' }, 'cortex-model-registration');
  check('unknown field rejected (additionalProperties:false)', !r.valid);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
