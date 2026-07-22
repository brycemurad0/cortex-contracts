/**
 * health-status.schema.json — BOX-STANDARD §3 / ADR-0026 shape smoke test.
 * Ensures the normative /health contract loads and rejects a missing required field.
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

console.log('Testing health-status.schema.json (ADR-0026)...\n');

const good = {
  status: 'ok',
  box: 'cortex',
  version: '0.1.0',
  contracts_version: '0.2.0',
  deploy_parity: { running_sha: 'abc', release_tag: null, match: true },
  siblings: [
    {
      name: 'agent-fabric',
      reachable: true,
      relationship: 'live event relay upstream',
      degraded_features: []
    }
  ],
  checked_at: '2026-07-15T17:00:00.000Z'
};

check('minimal valid health payload accepts', validate(good, 'health-status').valid === true);

const bad = { ...good };
delete bad.contracts_version;
check('missing contracts_version rejects', validate(bad, 'health-status').valid === false);

const badStatus = { ...good, status: 'up' };
check('status enum rejects legacy "up"', validate(badStatus, 'health-status').valid === false);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
