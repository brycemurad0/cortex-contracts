/**
 * Test runner for all Cortex contract round-trip tests.
 */

const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'work-request.test.js',
  'verification-evidence.test.js',
  'learning-trace.test.js',
  'training-data-candidate.test.js',
  'nightcrew-work-pack.test.js',
  // Added 2026-06-03 (W2 P0 lane, commit c6c49d7): RefinePunchupRequest/Response v0.
  // Without this entry, the canonical test-runner silently under-counts (35 vs 49)
  // and the drift detector's glob (`*.test.js`) is the only place the new
  // contract is verified. Adding it here keeps the user-facing runner honest.
  'refine-punchup.test.js',
  // Added 2026-06-10 (AF-WS4 lifecycle gate): pins the consolidated ≤8-state
  // TaskEnvelope lifecycle (dispatched+needs_review collapsed) so the enum cannot
  // silently regrow and the needs_human escalation flag stays representable.
  'task-envelope.test.js',
  // Added 2026-06-10 (AF-WS6 integrate-enqueue-maestro): the surface->agent-fabric
  // TaskEnqueueRequest intake shape (Suite Link §4.1) consumed by POST /cortex/enqueue.
  'task-enqueue-request.test.js',
  // Added 2026-06-11 (Phase 7 governance close-out): closes the 2026-06-04
  // conformance-audit F-4 gap. ExecutionReceipt is the second RATIFIED spine
  // contract (ADR-0017) and pins the three producer shapes (spine-orchestrated,
  // Hermes-bypass, surface-direct); RouteDecision (v0) pins Maestro's routing
  // record. Both were the last contracts in cortex/contracts/ with no round-trip test.
  'execution-receipt.test.js',
  'route-decision.test.js',
  // Added 2026-06-22 (connective-code lane: make Maestro complete for Cortex).
  // TrainingLabel is the raw quality_labels row the flywheel writes and Forge's
  // harvest reads — with optional provenance so a grounded label survives Forge's
  // curate grounding gate. CortexModelRegistration is the Forge->Maestro egress
  // seam (register a served, eval-beating adapter so Maestro routes it local-first).
  'training-label.test.js',
  'cortex-model-registration.test.js',
  // Added 2026-06-11 (harden-cortex reliability pass): keyword-completeness
  // guard for the custom validator. Closes the maxLength gap (declared
  // task-enqueue-request title<=200 / description<=32000 were never enforced —
  // a 50KB title passed intake unbounded) and pins pattern/const/minItems/
  // maxItems/uniqueItems so a future schema using them cannot silently no-op.
  'validator-completeness.test.js',
  // Added 2026-06-13 (MNEM-WS4 keystone, SCRUTINY §3 #15 / §4.1 — eighth
  // boundary): the SessionStoreRequest contract. Deliberate subset of
  // memory-store-request.schema.json (the /store wire); the session-store
  // endpoint server-stamps container_tag (from the session) and session_id
  // (from the URL path), so the wire body is narrower. The negative tests
  // pin the SUBSET posture: container_tag, session_id, valid_from,
  // memory_block_level, is_synthesized, parent_memory_id, and promoted are
  // all /store-only fields and a producer that tries to send any of them
  // on /sessions/{id}/store is REJECTED (the contract drift gate).
  'session-store-request.test.js',
  // Added 2026-06-13 (MNEM-WS1/WS2/WS3 contract-pin backfill, SCRUTINY
  // §3 #15 / §4.1 keystone). The MNEM-WS1/2/3 keystone commits each added
  // a new contract file (memory-store-request, memory-promote-request,
  // session-promote-on-close-request) but DID NOT add a round-trip test on
  // the cortex side — only the consumer-side test in the mnemos repo
  // exists. The contract surfaces were silently undertested: a future
  // breaking change to any of these schemas would not be caught by
  // `node tests/run-all-tests.js`. This commit adds the missing 3 tests
  // (18 + 13 + 13 = 44 new cases) + wires them into the runner. The
  // keystone patterns pinned: `additionalProperties: false` (rogue-field
  // rejection on all 3); required-field enforcement (memory_id +
  // to_container on promote); minLength: 1 (raw_text, memory_id,
  // to_container, nested promote_memory_ids items); date-time format on
  // valid_from; confidence 0..1 range; non-finite-number guard on
  // confidence (NaN silently passed minimum/maximum comparisons before
  // the harden-cortex reliability pass closed it); memory_type enum
  // (7-value, including the 'receipt' case the agent-fabric fleet
  // ships); memory_block_level 0/1/2 enum; explicit null rejection on
  // non-nullable string fields (memory_type, source_provider,
  // container_tag — the legacy Pydantic `str` posture preserved); all-
  // optional + nullable posture on session-promote-on-close (the
  // hermes-plugin close-hook path with empty body must pass).
  'memory-store-request.test.js',
  'memory-promote-request.test.js',
  'session-promote-on-close-request.test.js',
  // Added 2026-06-13 (MNEM-WS5 keystone, SCRUTINY §3 #15 / §4.1 —
  // ninth boundary): the SynthesisRequest contract. The /synthesize
  // recall-summarization read seam on mnemos; the legacy handler at
  // main.py:463–469 stubs `confidence:'medium'` (the SCRUTINY §B5 /
  // §4.1 link 3 named gap). The keystone pins the INPUT shape only
  // (the response is server-stamped); rogue fields the legacy
  // Pydantic typing would have silently dropped (confidence / limit
  // / debug_dump) are caught by `additionalProperties: false`.
  'synthesis-request.test.js',
  // Added 2026-06-14 (MNEM-WS9 keystone, SCRUTINY §3 #15 / §4.1 —
  // tenth boundary): the AdminUpdateNodeRequest contract. The
  // /admin/update-node fleet-heartbeat write seam on mnemos; the legacy
  // handler at main.py:688–696 accepts an in-file `UpdateNodeRequest`
  // Pydantic BaseModel and is NEVER validated against a canonical
  // contract. The keystone pins the INPUT shape only (the response is
  // server-stamped); rogue fields the legacy Pydantic typing would have
  // silently dropped (last_heartbeat to spoof healthy liveness,
  // token_override to bypass the require_token dependency, force_offline
  // to silently reclassify a live node) are caught by
  // `additionalProperties: false`.
  'admin-update-node-request.test.js',
  // Added 2026-07-15 (P1.contracts / WS-CTX-4): BOX-STANDARD §3 health shape.
  'health-status.test.js',
  // v0.2.0 release integrity replaces the old sibling-checkout path pin. A
  // release package must be testable from cortex alone: coherent JS/Python
  // versions, owned and unique schema IDs, MIT metadata, loader compatibility
  // aliases, and no leaked temporary artifacts.
  'package-integrity.test.js'
];

// Test-only hook: a regression test injects extra test-file paths (absolute,
// colon-separated) via CONTRACTS_EXTRA_TESTS to exercise the runner's
// crash/no-summary handling without touching the canonical list above. Unset in
// normal use, so production behavior is unchanged.
if (process.env.CONTRACTS_EXTRA_TESTS) {
  for (const p of process.env.CONTRACTS_EXTRA_TESTS.split(':').filter(Boolean)) {
    tests.push(p);
  }
}

let totalPassed = 0;
let totalFailed = 0;
let failedTests = [];

console.log("=" .repeat(70));
console.log("CORTEX CONTRACT ROUND-TRIP TEST SUITE");
console.log("=" .repeat(70));
console.log();

for (const test of tests) {
  console.log(`\nRunning: ${test}`);
  console.log("-".repeat(70));

  try {
    const output = execSync(`node ${path.resolve(__dirname, test)}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(output);

    // Parse results from output
    const match = output.match(/Results: (\d+) passed, (\d+) failed/);
    if (match) {
      totalPassed += parseInt(match[1], 10);
      totalFailed += parseInt(match[2], 10);
    } else {
      // A child exited 0 but never printed `Results:` — its self-report is
      // missing (it may have crashed after partial work or been gutted). Treat
      // a missing summary line as a hard failure rather than a silent 0/0 no-op,
      // so the runner's exit code can never go green on an unreported child.
      console.log(`  WARN: ${test} produced no "Results:" line — counting as failed`);
      failedTests.push(test);
    }
  } catch (error) {
    // Test failed (non-zero exit)
    console.log(error.stdout);
    const match = error.stdout?.match(/Results: (\d+) passed, (\d+) failed/);
    if (match) {
      totalPassed += parseInt(match[1], 10);
      totalFailed += parseInt(match[2], 10);
    }
    failedTests.push(test);
  }
}

console.log("\n" + "=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);

if (failedTests.length > 0) {
  console.log(`\nFailed tests: ${failedTests.join(', ')}`);
}

console.log();
// Exit non-zero if EITHER a child self-reported failures (totalFailed) OR a
// child crashed / produced no parseable summary (failedTests). Previously the
// exit ignored failedTests, so a test file that threw before printing
// `Results:` (syntax error, import failure, uncaught throw) contributed 0 to
// totalFailed and the runner went green — a silent regression channel for the
// "keep contracts green" invariant.
process.exit(totalFailed > 0 || failedTests.length > 0 ? 1 : 0);
