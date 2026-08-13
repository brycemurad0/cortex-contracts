/**
 * parity-operands.schema.json — shape test plus the cross-field semantics the
 * schema language cannot state.
 *
 * The schema exists because three boxes grew this object independently and
 * disagreed about what its fields mean. JSON Schema can pin the key names, the
 * types, and the basis enum; it cannot say "verdict must be null when the
 * comparison was impossible". Those rules are asserted here so a producer that
 * regresses to the old semantics fails CI rather than shipping a confident
 * boolean nobody can trust.
 */

const { validate } = require('./validator.js');

let passed = 0;
let failed = 0;

function check(label, ok) {
  if (ok) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('Testing parity-operands.schema.json...\n');

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const good = {
  basis: 'commit_sha',
  expected: { name: 'checkout_head_sha', value: SHA_A, source: 'git rev-parse HEAD' },
  actual: { name: 'running_sha', value: SHA_A, source: 'AF_VCS_REF' },
  complete: true,
  self_referential: false,
  tree_clean: true,
  verdict: true,
  note: null,
};

check('a complete matching commit_sha comparison accepts', validate(good, 'parity-operands').valid === true);

const bundle = {
  ...good,
  basis: 'bundle_hash',
  expected: { name: 'disk_bundle_sha256', value: SHA_A, source: '/opt/app/bundle.js' },
  actual: { name: 'boot_bundle_sha256', value: SHA_B, source: 'process memo' },
  verdict: false,
};
check('a bundle_hash mismatch accepts', validate(bundle, 'parity-operands').valid === true);

const none = {
  basis: 'none',
  expected: { name: null, value: null, source: null },
  actual: { name: null, value: null, source: null },
  complete: false,
  self_referential: false,
  tree_clean: null,
  verdict: null,
  note: 'missing: running_sha, checkout_head_sha',
};
check('the none basis with a null verdict accepts', validate(none, 'parity-operands').valid === true);

// tree_clean and note are the only optional fields: a producer that cannot
// read git porcelain still emits a conforming object.
const minimal = { ...good };
delete minimal.tree_clean;
delete minimal.note;
check('tree_clean and note are optional', validate(minimal, 'parity-operands').valid === true);

for (const field of ['basis', 'expected', 'actual', 'complete', 'self_referential', 'verdict']) {
  const missing = { ...good };
  delete missing[field];
  check(`missing ${field} rejects`, validate(missing, 'parity-operands').valid === false);
}

// The six-strings-for-two-concepts drift: every per-box basis name must be
// rejected in favor of the concept it was naming.
for (const legacy of [
  'deploy_stamp_vs_checkout',
  'boot_sha_vs_checkout_head',
  'boot_sha_vs_live_head',
  'built_bundle_vs_live_bundle',
  'boot_bundle_vs_disk_bundle',
  'boot_bundle_vs_live_bundle',
]) {
  check(`legacy per-box basis "${legacy}" rejects`, validate({ ...good, basis: legacy }, 'parity-operands').valid === false);
}

// The casing drift that silently un-guarded the self-comparison check: a
// camelCase flag must not slip through as an unknown extra field.
const camel = { ...good };
delete camel.self_referential;
camel.selfReferential = false;
check('camelCase selfReferential rejects', validate(camel, 'parity-operands').valid === false);

check('an unknown extra field rejects', validate({ ...good, bundleParity: 'in_sync' }, 'parity-operands').valid === false);
check('a non-boolean complete rejects', validate({ ...good, complete: 'yes' }, 'parity-operands').valid === false);
check('a string verdict rejects', validate({ ...good, verdict: 'match' }, 'parity-operands').valid === false);

// ── Cross-field semantics the schema language cannot express ────────────────
// These are the rules the three producers disagreed on. A conforming payload
// must satisfy every one; the helper is what a box's own conformance test
// should call before publishing.

/** Returns the list of semantic rule violations in a schema-valid payload. */
function semanticViolations(operands) {
  const problems = [];
  const bothValues = operands.expected?.value != null && operands.actual?.value != null;

  if (operands.complete !== bothValues) {
    problems.push('complete must be true exactly when both operand values are non-null');
  }
  if ((!operands.complete || operands.self_referential) && operands.verdict !== null) {
    problems.push('an incomplete or self-referential comparison must carry a null verdict, not false');
  }
  if (operands.complete && !operands.self_referential) {
    const equal = operands.expected.value === operands.actual.value;
    if (operands.verdict !== equal) {
      problems.push('verdict must be exact operand equality and nothing else');
    }
  }
  if (operands.basis === 'none' && (bothValues || operands.verdict !== null)) {
    problems.push('the none basis means no comparison happened');
  }
  if (operands.basis === 'commit_sha') {
    for (const side of ['expected', 'actual']) {
      const value = operands[side]?.value;
      if (value != null && !/^[0-9a-f]{40}$/.test(value)) {
        problems.push(`${side}.value must be a full 40-character lowercase SHA under the commit_sha basis`);
      }
    }
  }
  return problems;
}

for (const [label, payload] of [
  ['a matching commit_sha payload', good],
  ['a mismatching bundle_hash payload', bundle],
  ['the none-basis payload', none],
]) {
  check(`${label} satisfies the semantic rules`, semanticViolations(payload).length === 0);
}

check(
  'a false verdict on an incomplete comparison is caught',
  semanticViolations({ ...none, verdict: false }).length > 0,
);
check(
  'a self-referential comparison reported as a pass is caught',
  semanticViolations({ ...good, self_referential: true }).length > 0,
);
check(
  'complete hardcoded true with a missing operand is caught',
  semanticViolations({
    ...good,
    actual: { name: 'running_sha', value: null, source: 'AF_VCS_REF' },
  }).length > 0,
);
check(
  'a verdict that folds in tree cleanliness is caught',
  semanticViolations({ ...good, tree_clean: false, verdict: false }).length > 0,
);
check(
  'a short SHA that would need prefix comparison is caught',
  semanticViolations({
    ...good,
    expected: { name: 'checkout_head_sha', value: 'aaaaaaa', source: 'git rev-parse --short HEAD' },
    verdict: false,
  }).length > 0,
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
