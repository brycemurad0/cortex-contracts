/**
 * Round-trip test for WorkRequest contract.
 * Validates that sample payloads conform to the JSON schema.
 */

const { validate } = require('./validator.js');

// Sample valid WorkRequest payloads
const validWorkRequests = [
  {
    id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    source: "pocket-agent",
    intent: "code-review",
    refined_prompt: "Review the authentication module for security vulnerabilities and provide recommendations.",
    acceptance_criteria: [
      "Identify all potential security issues",
      "Provide actionable remediation steps",
      "Rate severity of each finding"
    ],
    priority: "high",
    requested_by: "user@example.com",
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    id: "01HV8J3K2M4N5P6Q7R8S9T0UW",
    source: "personal-life-os",
    intent: "refactor",
    refined_prompt: "Refactor the database connection pooling to use async/await pattern.",
    acceptance_criteria: [
      "All tests pass",
      "No connection leaks",
      "Performance improved or maintained"
    ],
    priority: "normal",
    requested_by: "system:cron",
    created_at: "2026-05-31T10:30:00Z"
  },
  {
    id: "01HV8J3K2M4N5P6Q7R8S9T0UX",
    source: "manual",
    intent: "documentation",
    refined_prompt: "Update API documentation for the new endpoints.",
    acceptance_criteria: [
      "All new endpoints documented",
      "Examples provided",
      "Response schemas included"
    ],
    priority: "low",
    requested_by: "developer@example.com",
    created_at: "2026-05-31T08:15:00Z"
  }
];

// Invalid payloads for negative testing
const invalidWorkRequests = [
  {
    // Missing required fields
    id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    source: "pocket-agent"
  },
  {
    // Invalid priority enum
    id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    source: "pocket-agent",
    intent: "test",
    refined_prompt: "Test prompt",
    acceptance_criteria: [],
    priority: "super-urgent", // invalid
    requested_by: "user",
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid source enum
    id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    source: "unknown-source", // invalid
    intent: "test",
    refined_prompt: "Test prompt",
    acceptance_criteria: [],
    priority: "normal",
    requested_by: "user",
    created_at: "2026-05-31T12:00:00Z"
  }
];

console.log("Testing WorkRequest contract...\n");

let passed = 0;
let failed = 0;

// Test valid payloads
console.log("Valid payload tests:");
for (const payload of validWorkRequests) {
  const result = validate(payload, 'work-request');
  if (result.valid) {
    console.log(`  PASS: ${payload.id}`);
    passed++;
  } else {
    console.log(`  FAIL: ${payload.id}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

// Test invalid payloads
console.log("\nInvalid payload tests (expecting failures):");
for (let i = 0; i < invalidWorkRequests.length; i++) {
  const result = validate(invalidWorkRequests[i], 'work-request');
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
