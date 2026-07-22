/**
 * Validator keyword-completeness test.
 *
 * The custom round-trip validator (validator.js) MUST enforce every JSON Schema
 * keyword that any in-tree contract declares as a field constraint — otherwise a
 * declared constraint is dead and the "every field constraint tested / round-trip
 * stable" guarantee is silently false.
 *
 * This is the regression test for the maxLength gap (task-enqueue-request
 * title<=200 / description<=32000 were declared but never enforced — a 50KB title
 * passed intake validation unbounded). It also pins the other string/array
 * keywords (pattern, minItems, maxItems, uniqueItems, const) so a future schema
 * that uses them cannot silently no-op through the validator.
 *
 * Each case exercises ONE constraint via an inline schema (no on-disk schema
 * file, no network, no shared state) plus a real-schema boundary check against
 * task-enqueue-request. Deterministic and isolated by construction.
 */

const { validateValue, validate } = require('./validator.js');

let passed = 0;
let failed = 0;

function expectErrors(label, value, schema, shouldError) {
  const errors = validateValue(value, schema, '$');
  const hasError = errors.length > 0;
  if (hasError === shouldError) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} — expected ${shouldError ? 'rejection' : 'acceptance'}, got ${JSON.stringify(errors)}`);
    failed++;
  }
}

console.log('Testing validator keyword completeness...\n');

console.log('maxLength (the regression — was silently unenforced):');
expectErrors('string at maxLength is accepted', 'x'.repeat(200), { type: 'string', maxLength: 200 }, false);
expectErrors('string over maxLength is REJECTED', 'x'.repeat(201), { type: 'string', maxLength: 200 }, true);
expectErrors('large string with no maxLength is accepted', 'x'.repeat(50000), { type: 'string' }, false);

console.log('\nminLength (already worked — keep it covered):');
expectErrors('empty string under minLength 1 is REJECTED', '', { type: 'string', minLength: 1 }, true);
expectErrors('1-char string at minLength 1 is accepted', 'x', { type: 'string', minLength: 1 }, false);

console.log('\npattern:');
expectErrors('non-matching string is REJECTED', 'abc', { type: 'string', pattern: '^[0-9]+$' }, true);
expectErrors('matching string is accepted', '12345', { type: 'string', pattern: '^[0-9]+$' }, false);

console.log('\nconst:');
expectErrors('wrong const value is REJECTED', '1.1.0', { const: '1.0.0' }, true);
expectErrors('right const value is accepted', '1.0.0', { const: '1.0.0' }, false);

console.log('\nminItems / maxItems:');
expectErrors('array under minItems is REJECTED', [], { type: 'array', minItems: 1 }, true);
expectErrors('array at minItems is accepted', ['a'], { type: 'array', minItems: 1 }, false);
expectErrors('array over maxItems is REJECTED', ['a', 'b', 'c'], { type: 'array', maxItems: 2 }, true);
expectErrors('array at maxItems is accepted', ['a', 'b'], { type: 'array', maxItems: 2 }, false);

console.log('\nuniqueItems:');
expectErrors('duplicate items are REJECTED', ['a', 'a'], { type: 'array', uniqueItems: true }, true);
expectErrors('distinct items are accepted', ['a', 'b'], { type: 'array', uniqueItems: true }, false);

// Non-finite numbers (NaN / Infinity) MUST be rejected for number-typed fields.
// Defect: `typeof NaN === 'number'` and `NaN < min` / `NaN > max` are BOTH false,
// so a NaN passed every numeric range check and validated as an in-range number.
// Likewise a `number` field with only a `minimum` (no maximum) let `Infinity`
// through. Real producers feed task-envelope.confidence (0..1),
// route-decision score (0..1), execution-receipt duration/token counts (>=0),
// etc. — a NaN/Infinity must be a clean rejection, not a silently-valid value.
console.log('\nnon-finite numbers (NaN / Infinity must be rejected):');
expectErrors('NaN is REJECTED for a bounded number field', NaN, { type: 'number', minimum: 0, maximum: 1 }, true);
expectErrors('Infinity is REJECTED for a bounded number field', Infinity, { type: 'number', minimum: 0, maximum: 1 }, true);
expectErrors('-Infinity is REJECTED for a bounded number field', -Infinity, { type: 'number', minimum: 0, maximum: 1 }, true);
expectErrors('NaN is REJECTED for a min-only number field', NaN, { type: 'number', minimum: 0 }, true);
expectErrors('Infinity is REJECTED for a min-only number field', Infinity, { type: 'number', minimum: 0 }, true);
expectErrors('a finite in-range number is still accepted', 0.5, { type: 'number', minimum: 0, maximum: 1 }, false);
expectErrors('a finite boundary value is still accepted', 0, { type: 'number', minimum: 0, maximum: 1 }, false);
// integer fields already reject non-finite via Number.isInteger; pin it so the
// guard can't regress them into acceptance either.
expectErrors('NaN is REJECTED for an integer field', NaN, { type: 'integer', minimum: 0 }, true);
expectErrors('Infinity is REJECTED for an integer field', Infinity, { type: 'integer', minimum: 0 }, true);

// Real-schema boundary: task-envelope.confidence is `number` 0..1. A NaN
// confidence from a producer must be rejected, not pass as in-range.
console.log('\nReal task-envelope.confidence non-finite boundary:');
const envBase = {
  id: '11111111-2222-3333-4444-555555555555',
  project: 'cortex',
  source: 'pocket-agent',
  title: 'ok',
  capability: 'code',
  prompt: 'do the thing',
  status: 'queued',
};
{
  const r = validate({ ...envBase, confidence: NaN }, 'task-envelope');
  if (!r.valid && r.errors.some(e => /confidence/.test(e))) { console.log('  PASS: NaN confidence REJECTED'); passed++; }
  else { console.log(`  FAIL: NaN confidence should be rejected — ${JSON.stringify(r.errors)}`); failed++; }
}
{
  const r = validate({ ...envBase, confidence: 0.9 }, 'task-envelope');
  const confErr = r.errors.filter(e => /confidence/.test(e));
  if (confErr.length === 0) { console.log('  PASS: finite confidence 0.9 accepted'); passed++; }
  else { console.log(`  FAIL: finite confidence should be accepted — ${JSON.stringify(confErr)}`); failed++; }
}

// Real-schema boundary check: the actual task-enqueue-request constraints
// (title maxLength 200, description maxLength 32000) must now be live.
console.log('\nReal task-enqueue-request maxLength boundary:');
const base = { source: 'pocket-agent', description: 'y', project: 'cortex', tier: 'standard' };
{
  const r = validate({ ...base, title: 'x'.repeat(200) }, 'task-enqueue-request');
  if (r.valid) { console.log('  PASS: 200-char title accepted'); passed++; }
  else { console.log(`  FAIL: 200-char title should be accepted — ${JSON.stringify(r.errors)}`); failed++; }
}
{
  const r = validate({ ...base, title: 'x'.repeat(201) }, 'task-enqueue-request');
  if (!r.valid) { console.log('  PASS: 201-char title REJECTED'); passed++; }
  else { console.log('  FAIL: 201-char title should be rejected (maxLength 200)'); failed++; }
}
{
  const r = validate({ source: 'pocket-agent', title: 'ok', project: 'cortex', tier: 'standard', description: 'y'.repeat(32001) }, 'task-enqueue-request');
  if (!r.valid) { console.log('  PASS: 32001-char description REJECTED'); passed++; }
  else { console.log('  FAIL: 32001-char description should be rejected (maxLength 32000)'); failed++; }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
