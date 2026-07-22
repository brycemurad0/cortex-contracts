/**
 * Round-trip test for VerificationEvidence contract.
 * Validates that sample payloads conform to the JSON schema.
 */

const { validate } = require('./validator.js');

// Sample valid VerificationEvidence payloads
const validEvidence = [
  {
    receipt_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    checks: [
      { description: "Code compiles without errors", status: "pass" },
      { description: "All tests pass", status: "pass" },
      { description: "Linting passes", status: "pass", details: "0 warnings, 0 errors" }
    ],
    status: "pass",
    artifacts: [
      { kind: "log", reference: "mnemos://build-logs/abc123", description: "Build log" },
      { kind: "metric", reference: "coverage:87%" }
    ],
    grader: "agent:claude-code",
    graded_at: "2026-05-31T14:30:00Z"
  },
  {
    receipt_id: "01HV8J3K2M4N5P6Q7R8S9T0UW",
    checks: [
      { description: "Acceptance criteria met", status: "fail", details: "Missing user authentication" },
      { description: "Performance within limits", status: "pass" }
    ],
    status: "fail",
    artifacts: [
      { kind: "diff", reference: "mnemos://diffs/changes.patch" },
      { kind: "log", reference: "mnemos://logs/error.log", description: "Error output" }
    ],
    grader: "system:automated-grader",
    graded_at: "2026-05-31T15:45:00Z"
  },
  {
    receipt_id: "01HV8J3K2M4N5P6Q7R8S9T0UX",
    checks: [
      { description: "Security scan", status: "skip", details: "Tool unavailable" }
    ],
    status: "fail",
    artifacts: [],
    grader: "agent:hermes-local",
    graded_at: "2026-05-31T16:00:00Z"
  }
];

// Invalid payloads for negative testing
const invalidEvidence = [
  {
    // Missing required receipt_id
    checks: [],
    status: "pass",
    artifacts: [],
    grader: "test",
    graded_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid check status
    receipt_id: "test",
    checks: [{ description: "Test", status: "unknown" }],
    status: "pass",
    artifacts: [],
    grader: "test",
    graded_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid overall status
    receipt_id: "test",
    checks: [],
    status: "partial", // invalid
    artifacts: [],
    grader: "test",
    graded_at: "2026-05-31T12:00:00Z"
  }
];

console.log("Testing VerificationEvidence contract...\n");

let passed = 0;
let failed = 0;

// Test valid payloads
console.log("Valid payload tests:");
for (let i = 0; i < validEvidence.length; i++) {
  const result = validate(validEvidence[i], 'verification-evidence');
  if (result.valid) {
    console.log(`  PASS: Evidence ${i + 1}`);
    passed++;
  } else {
    console.log(`  FAIL: Evidence ${i + 1}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

// Test invalid payloads
console.log("\nInvalid payload tests (expecting failures):");
for (let i = 0; i < invalidEvidence.length; i++) {
  const result = validate(invalidEvidence[i], 'verification-evidence');
  if (!result.valid) {
    console.log(`  PASS: Test ${i + 1} correctly rejected`);
    passed++;
  } else {
    console.log(`  FAIL: Test ${i + 1} should have been rejected`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
