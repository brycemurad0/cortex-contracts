/**
 * Round-trip test for NightCrewWorkPack contract.
 * Validates that sample payloads conform to the JSON schema.
 */

const { validate } = require('./validator.js');

// Sample valid NightCrewWorkPack payloads
const validPacks = [
  {
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    generated_at: "2026-05-31T00:00:00Z",
    items: [
      { kind: "analyze", target: "contracts/execution-receipt.ts", rationale: "Check for drift from schema" },
      { kind: "audit", target: "control-plane/src/lib/inventory.ts", rationale: "Security audit scheduled" },
      { kind: "index", target: "docs/adr", rationale: "Update search index" }
    ],
    budget: { max_tokens: 100000, max_usd_cents: 500, max_duration_seconds: 3600 },
    container: "nightcrew-2026-05-31"
  },
  {
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UW",
    generated_at: "2026-05-31T00:00:00Z",
    items: [
      { kind: "harvest", target: "github.com/org/repo", rationale: "Collect training examples" },
      { kind: "verify", target: "mnemos://containers/legacy-data", rationale: "Verify data integrity" }
    ],
    budget: { max_tokens: 50000, max_usd_cents: 250, max_duration_seconds: 1800 },
    container: "harvest-2026-05-31"
  },
  {
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UX",
    generated_at: "2026-05-31T00:00:00Z",
    items: [
      { kind: "summarize", target: "mnemos://conversations/last-24h", rationale: "Daily summary generation" }
    ],
    budget: { max_tokens: 20000, max_usd_cents: 100, max_duration_seconds: 900 },
    container: "summaries-2026-05-31"
  }
];

// Invalid payloads for negative testing
const invalidPacks = [
  {
    // Missing required budget
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    generated_at: "2026-05-31T00:00:00Z",
    items: [],
    container: "test"
  },
  {
    // Invalid item kind
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    generated_at: "2026-05-31T00:00:00Z",
    items: [{ kind: "execute", target: "test", rationale: "test" }], // invalid kind
    budget: { max_tokens: 1000, max_usd_cents: 10, max_duration_seconds: 60 },
    container: "test"
  },
  {
    // Missing required item field
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    generated_at: "2026-05-31T00:00:00Z",
    items: [{ kind: "analyze", target: "test" }], // missing rationale
    budget: { max_tokens: 1000, max_usd_cents: 10, max_duration_seconds: 60 },
    container: "test"
  },
  {
    // Zero max_tokens (violates minimum: 1)
    pack_id: "01HV8J3K2M4N5P6Q7R8S9T0UV",
    generated_at: "2026-05-31T00:00:00Z",
    items: [],
    budget: { max_tokens: 0, max_usd_cents: 10, max_duration_seconds: 60 },
    container: "test"
  }
];

console.log("Testing NightCrewWorkPack contract...\n");

let passed = 0;
let failed = 0;

// Test valid payloads
console.log("Valid payload tests:");
for (let i = 0; i < validPacks.length; i++) {
  const result = validate(validPacks[i], 'nightcrew-work-pack');
  if (result.valid) {
    console.log(`  PASS: Pack ${i + 1} (${validPacks[i].items.length} items)`);
    passed++;
  } else {
    console.log(`  FAIL: Pack ${i + 1}`);
    result.errors.forEach(e => console.log(`    - ${e}`));
    failed++;
  }
}

// Test invalid payloads
console.log("\nInvalid payload tests (expecting failures):");
for (let i = 0; i < invalidPacks.length; i++) {
  const result = validate(invalidPacks[i], 'nightcrew-work-pack');
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
