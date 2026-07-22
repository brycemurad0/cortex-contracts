/**
 * Regression test for run-all-tests.js exit-code integrity.
 *
 * Defect (D1): the runner scraped each child's stdout for `Results: N passed, M
 * failed` and exited `totalFailed > 0 ? 1 : 0`. A child that crashed BEFORE
 * printing that line (uncaught throw, syntax error, import failure) contributed
 * 0 to totalFailed, so the runner exited 0 — a CI gate on the runner went GREEN
 * with a broken/crashing test file. This is a silent regression channel for the
 * "keep contracts green" invariant.
 *
 * The runner now exits non-zero when EITHER totalFailed > 0 OR failedTests is
 * non-empty (a child crashed or produced no parseable `Results:` line).
 *
 * Test design: deterministic + isolated. We write throwaway child test files
 * into a unique temp dir, inject them via the CONTRACTS_EXTRA_TESTS hook, run
 * the real runner, and assert on its exit code. No network, no ports, no shared
 * state — the temp dir is removed in a finally.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUNNER = path.join(__dirname, 'run-all-tests.js');

let passed = 0;
let failed = 0;

function check(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

function runRunner(extraFiles) {
  const res = spawnSync('node', [RUNNER], {
    encoding: 'utf8',
    env: { ...process.env, CONTRACTS_EXTRA_TESTS: extraFiles.join(':') },
  });
  return res;
}

console.log('Testing run-all-tests.js exit-code integrity...\n');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-runner-test-'));
try {
  // A child that throws before printing `Results:` — the exact D1 shape.
  const crashFile = path.join(tmp, 'crash.test.js');
  fs.writeFileSync(crashFile, 'throw new Error("simulated crash before Results line");\n');

  // A child that exits 0 but prints no `Results:` line at all (gutted/no-op).
  const noSummaryFile = path.join(tmp, 'no-summary.test.js');
  fs.writeFileSync(noSummaryFile, 'console.log("ran but printed no summary"); process.exit(0);\n');

  // A well-behaved child that self-reports a clean pass (control — must not
  // by itself make the runner fail).
  const cleanFile = path.join(tmp, 'clean.test.js');
  fs.writeFileSync(cleanFile, 'console.log("Results: 1 passed, 0 failed"); process.exit(0);\n');

  console.log('Crashing child (throws before Results line):');
  {
    const res = runRunner([crashFile]);
    check('runner exits non-zero on a crashing child', res.status !== 0);
    check('runner names the crashing child as failed', /crash\.test\.js/.test(res.stdout || ''));
  }

  console.log('\nChild that prints no Results line:');
  {
    const res = runRunner([noSummaryFile]);
    check('runner exits non-zero on a no-summary child', res.status !== 0);
  }

  console.log('\nControl — clean extra child only:');
  {
    const res = runRunner([cleanFile]);
    check('runner exits 0 when all children (incl. clean extra) pass', res.status === 0);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
