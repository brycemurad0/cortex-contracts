/**
 * Round-trip test for TrainingDataCandidate contract.
 * Validates that sample payloads conform to the JSON schema.
 */

const { validate } = require('./validator.js');

// Sample valid TrainingDataCandidate payloads
const validCandidates = [
  {
    lane: "code-generation",
    prompt: "Write a Python function to calculate the factorial of a number using recursion.",
    response: "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)",
    source_url: "https://github.com/example/repo/blob/main/math/utils.py",
    source_commit_sha: "abc123def456",
    grounded: true,
    license: "MIT",
    quality_score: 95,
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    lane: "code-review",
    prompt: "Review this function for potential issues:\n\ndef get_user(id):\n    query = f\"SELECT * FROM users WHERE id = {id}\"\n    return db.execute(query)",
    response: "This function has a SQL injection vulnerability. Use parameterized queries instead.",
    source_url: "https://github.com/example/repo/pull/42",
    source_commit_sha: "def789abc012",
    grounded: true,
    license: "Apache-2.0",
    quality_score: 88,
    created_at: "2026-05-31T13:00:00Z"
  },
  {
    lane: "documentation",
    prompt: "Document the purpose of this interface:\n\ninterface Task {\n  id: string;\n  status: string;\n}",
    response: "The Task interface defines the structure of a task object with a unique identifier and current status.",
    source_url: "https://github.com/example/repo/wiki",
    source_commit_sha: "ghi345jkl678",
    grounded: true,
    license: "CC-BY-4.0",
    quality_score: 72,
    created_at: "2026-05-31T14:00:00Z"
  },
  {
    lane: "test-generation",
    prompt: "Generate unit tests for a function that adds two numbers.",
    response: "describe('add', () => {\n  it('should add positive numbers', () => {\n    expect(add(2, 3)).toBe(5);\n  });\n});",
    source_url: "https://github.com/example/repo/blob/main/tests/math.test.js",
    source_commit_sha: "mno901pqr234",
    grounded: true,
    license: "BSD-3-Clause",
    quality_score: 85,
    created_at: "2026-05-31T15:00:00Z"
  }
];

// Invalid payloads for negative testing
const invalidCandidates = [
  {
    // Missing required prompt
    lane: "code-generation",
    response: "test",
    source_url: "https://example.com",
    source_commit_sha: "abc123",
    grounded: true,
    license: "MIT",
    quality_score: 50,
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid lane
    lane: "unknown-lane",
    prompt: "test",
    response: "test",
    source_url: "https://example.com",
    source_commit_sha: "abc123",
    grounded: true,
    license: "MIT",
    quality_score: 50,
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Invalid license
    lane: "general",
    prompt: "test",
    response: "test",
    source_url: "https://example.com",
    source_commit_sha: "abc123",
    grounded: true,
    license: "Custom-License", // invalid
    quality_score: 50,
    created_at: "2026-05-31T12:00:00Z"
  },
  {
    // Quality score out of range
    lane: "general",
    prompt: "test",
    response: "test",
    source_url: "https://example.com",
    source_commit_sha: "abc123",
    grounded: true,
    license: "MIT",
    quality_score: 150, // > 100
    created_at: "2026-05-31T12:00:00Z"
  }
];

console.log("Testing TrainingDataCandidate contract...\n");

let passed = 0;
let failed = 0;

// Test valid payloads
console.log("Valid payload tests:");
for (let i = 0; i < validCandidates.length; i++) {
  const result = validate(validCandidates[i], 'training-data-candidate');
  if (result.valid) {
    console.log(`  PASS: Candidate ${i + 1} (${validCandidates[i].lane})`);
    passed++;
  } else {
    console.log(`  FAIL: Candidate ${i + 1}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

// Test invalid payloads
console.log("\nInvalid payload tests (expecting failures):");
for (let i = 0; i < invalidCandidates.length; i++) {
  const result = validate(invalidCandidates[i], 'training-data-candidate');
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
