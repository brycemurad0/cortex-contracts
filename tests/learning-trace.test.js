/**
 * Round-trip test for LearningTrace contract.
 * Validates that sample payloads conform to the JSON schema.
 */

const { validate } = require('./validator.js');

// Sample valid LearningTrace payloads
const validTraces = [
  {
    decision_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    task_id: "task-abc-123",
    route: { model: "claude-sonnet-4", tier: "complex" },
    outcome: "succeeded",
    grade: "excellent",
    cost: { input_tokens: 15000, output_tokens: 8000, usd_cents: 45 },
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    decision_id: "01HV8J3K2M4N5P6Q7R8S9T0UW",
    task_id: "task-def-456",
    route: { model: "gpt-4o", tier: "standard" },
    outcome: "failed",
    grade: "poor",
    cost: { input_tokens: 5000, output_tokens: 2000, usd_cents: 15 },
    created_at: "2026-05-31T13:30:00Z"
  },
  {
    decision_id: "01HV8J3K2M4N5P6Q7R8S9T0UX",
    task_id: "task-ghi-789",
    route: { model: "claude-haiku", tier: "trivial" },
    outcome: "succeeded",
    grade: "good",
    cost: { input_tokens: 500, output_tokens: 300, usd_cents: 2 },
    created_at: "2026-05-31T14:00:00Z"
  },
  {
    decision_id: "01HV8J3K2M4N5P6Q7R8S9T0UY",
    task_id: "task-jkl-012",
    route: { model: "vega-preview", tier: "complex" },
    outcome: "timed_out",
    grade: "ungraded",
    cost: { input_tokens: 25000, output_tokens: 1000, usd_cents: 50 },
    created_at: "2026-05-31T15:00:00Z"
  }
];

// Invalid payloads for negative testing
const invalidTraces = [
  {
    // Missing required route
    decision_id: "test",
    task_id: "task-1",
    outcome: "succeeded",
    grade: "good",
    cost: { input_tokens: 100, output_tokens: 50, usd_cents: 1 },
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid grade
    decision_id: "test",
    task_id: "task-1",
    route: { model: "test", tier: "simple" },
    outcome: "succeeded",
    grade: "mediocre", // invalid
    cost: { input_tokens: 100, output_tokens: 50, usd_cents: 1 },
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid tier in route
    decision_id: "test",
    task_id: "task-1",
    route: { model: "test", tier: "medium" }, // invalid tier
    outcome: "succeeded",
    grade: "good",
    cost: { input_tokens: 100, output_tokens: 50, usd_cents: 1 },
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Negative cost
    decision_id: "test",
    task_id: "task-1",
    route: { model: "test", tier: "simple" },
    outcome: "succeeded",
    grade: "good",
    cost: { input_tokens: -100, output_tokens: 50, usd_cents: 1 }, // negative
    created_at: "2026-05-31T12:00:00Z"
  }
];

console.log("Testing LearningTrace contract...\n");

let passed = 0;
let failed = 0;

// Test valid payloads
console.log("Valid payload tests:");
for (let i = 0; i < validTraces.length; i++) {
  const result = validate(validTraces[i], 'learning-trace');
  if (result.valid) {
    console.log(`  PASS: Trace ${i + 1} (${validTraces[i].outcome})`);
    passed++;
  } else {
    console.log(`  FAIL: Trace ${i + 1}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

// Test invalid payloads
console.log("\nInvalid payload tests (expecting failures):");
for (let i = 0; i < invalidTraces.length; i++) {
  const result = validate(invalidTraces[i], 'learning-trace');
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
