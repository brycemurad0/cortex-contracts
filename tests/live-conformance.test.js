/**
 * live-conformance.test.js — the runtime conformance gate (cortex.md C1 [2g], SCRUTINY W1/§B6).
 *
 * Every OTHER contracts test round-trips a schema against its OWN fixtures — fully hermetic,
 * which is correct for the CI-pure core but means interop is a *test-pinned hope*, not a
 * runtime guarantee. A live producer could drift from canon and no hermetic test would fail.
 *
 * This test closes that seam: it SAMPLES REAL envelopes off the LIVE producers and validates
 * each against the CANONICAL schema (cortex/contracts/*.schema.json) with the same validator
 * the hermetic suite uses — NOT against the suite's own fixtures. Three producers, three canons:
 *
 *   1. agent-fabric :3333  GET  /receipts          -> ExecutionReceipt v1 (execution-receipt)
 *   2. surfaces enqueue    POST /cortex/enqueue     -> TaskEnqueueRequest    (task-enqueue-request)
 *   3. Maestro     :8003   POST /v1/chat/completions._maestro.route_decision -> RouteDecision (route-decision)
 *
 * IMPORTANT — this is NOT in tests/run-all-tests.js's hermetic list, by design:
 *   - The hermetic suite must stay deterministic + offline (CI on a box with no fleet).
 *   - Each producer probe is INDEPENDENTLY SKIP-GATED: when a producer is unreachable it reports
 *     a clean SKIP for that producer (and the run exits 0 if nothing actually FAILED) so it never
 *     reds CI on an offline box.
 *   - The cockpit MONITOR (cockpit/scripts/cockpit-monitor.mjs) runs this with CONFORMANCE_STRICT=1
 *     against the LIVE fleet, so a producer that is down OR drifts from canon goes RED there.
 *
 * SAFETY (the executor's constraints): the surfaces probe POSTs a `trivial`-tier enqueue with
 * `assigned_agent:null` and a STABLE idempotency_key. Per agent-fabric/src/services/enqueue.mjs,
 * a non-`complex` tier mints NO workflow_id and therefore NEVER kicks runComplexWorkflowAsync —
 * it only records a durable intake-ack row + emits a task.enqueued event. No agent spawn, no
 * model call, no forge spend. The stable idempotency_key means re-runs dedupe (idempotent:true) —
 * no row spam. The Maestro probe is max_tokens:1 against the cheapest local routing tier
 * (maestro/fast -> qwen-primary on the fleet's own GPU) — the documented routing-probe pattern,
 * not a forge dispatch.
 *
 * AF's /receipts wire format is a SUPERSET of the canonical envelope (a SQLite row with extra
 * columns + `id` instead of `receipt_id`). The conformance question is honest and precise:
 * "does the live producer emit the canonical SPINE fields, correctly typed, with the right
 * outcome enum and join-field nullability?" So we (1) assert every canonical-required field is
 * present in the raw row, then (2) project the row to the canonical field set (documented
 * mapping: id -> receipt_id) and validate that projection against canon. A producer that drops
 * a required field, sends a bad outcome enum, or wrong-types a spine field is REJECTED.
 *
 * Env:
 *   AF_RECEIPTS_URL      override the AF receipts endpoint (default http://127.0.0.1:3333/receipts)
 *   AF_ENQUEUE_URL       override the AF enqueue endpoint  (default http://127.0.0.1:3333/cortex/enqueue)
 *   MAESTRO_BASE_URL     override the Maestro base         (default http://100.81.13.93:8003)
 *   MAESTRO_AUTH         Maestro bearer token (sourced from ~/.hermes/.env; never printed).
 *                        Absent => the Maestro producer is SKIPPED (it is token-gated by design).
 *   CONFORMANCE_STRICT=1 treat an unreachable/unauthenticated producer as a FAILURE instead of a
 *                        SKIP (the monitor sets this when it KNOWS the fleet should be up).
 *   CONFORMANCE_TIMEOUT_MS  per-probe timeout (default 4000; Maestro probe uses up to 30s).
 */

const { validate } = require('./validator.js');

const AF_RECEIPTS_URL = process.env.AF_RECEIPTS_URL || 'http://127.0.0.1:3333/receipts';
const AF_ENQUEUE_URL = process.env.AF_ENQUEUE_URL || 'http://127.0.0.1:3333/cortex/enqueue';
const MAESTRO_BASE_URL = (process.env.MAESTRO_BASE_URL || 'http://100.81.13.93:8003').replace(/\/+$/, '');
const MAESTRO_AUTH = process.env.MAESTRO_AUTH || process.env.AF_MAESTRO_AUTH || '';
const STRICT = process.env.CONFORMANCE_STRICT === '1';
const TIMEOUT_MS = Number(process.env.CONFORMANCE_TIMEOUT_MS || 4000);
const MAESTRO_TIMEOUT_MS = Number(process.env.MAESTRO_TIMEOUT_MS || 30000);

let passed = 0;
let failed = 0;
const skips = [];
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}
// A producer is unreachable/unauthenticated. In strict mode that's a FAILURE (the fleet is
// supposed to be up); otherwise it's a clean SKIP (offline CI box) recorded for the summary.
function unreachable(producer, reason) {
  if (STRICT) {
    check(`[${producer}] producer reachable`, false);
    console.log(`    (strict mode: unreachable/unauthenticated producer is a FAILURE — ${reason})`);
  } else {
    skips.push(`${producer} (${reason})`);
    console.log(`  SKIP: [${producer}] ${reason} — conformance gate skipped (offline box).`);
    console.log('        Set CONFORMANCE_STRICT=1 to treat this as a failure (the monitor does).');
  }
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

// ───────────────────────────────────────────────────────────────────────────
// Producer 1 — agent-fabric ExecutionReceipt v1 (GET /receipts -> execution-receipt)
// ───────────────────────────────────────────────────────────────────────────

// The canonical field set for ExecutionReceipt v1 (the only keys allowed under
// additionalProperties:false). AF's row carries extra columns; we project to exactly these.
const CANONICAL_RECEIPT_FIELDS = [
  'receipt_id', 'task_id', 'af_dispatch_id', 'af_worker_session_id', 'decision_id',
  'node', 'assigned_agent', 'outcome', 'exit_code', 'started_at', 'ended_at',
  'duration_ms', 'cost', 'result_summary', 'result_pointer',
  'acceptance_criteria_evaluated', 'acceptance_criteria_passed', 'reviewer_critique',
  'error', 'dispatch'
];
const CANONICAL_RECEIPT_REQUIRED = [
  'task_id', 'node', 'assigned_agent', 'outcome', 'started_at', 'ended_at', 'duration_ms'
];

// Map a live AF /receipts row to the canonical ExecutionReceipt v1 envelope.
// Documented mapping (AF DB column -> canonical field): id -> receipt_id (AF's row PK is the
// client idempotency key). All other canonical fields share their AF column name; non-canonical
// columns are dropped.
function projectReceiptToCanonical(row) {
  const out = {};
  for (const f of CANONICAL_RECEIPT_FIELDS) {
    if (f === 'receipt_id') {
      if (row.receipt_id != null) out.receipt_id = row.receipt_id;
      else if (row.id != null) out.receipt_id = row.id;
    } else if (f in row) {
      out[f] = row[f];
    }
  }
  return out;
}

async function probeAfReceipt() {
  console.log('\n[1/3] agent-fabric ExecutionReceipt v1 — GET /receipts vs execution-receipt canon');
  console.log(`      producer: ${AF_RECEIPTS_URL}`);
  const { signal, done } = withTimeout(TIMEOUT_MS);
  let row;
  try {
    const res = await fetch(AF_RECEIPTS_URL, { method: 'GET', signal });
    if (!res.ok) return unreachable('af-receipt', `HTTP ${res.status}`);
    const body = await res.json();
    const rows = Array.isArray(body) ? body : (Array.isArray(body?.receipts) ? body.receipts : null);
    if (!rows) return unreachable('af-receipt', 'unexpected /receipts shape (not an array)');
    if (rows.length === 0) return unreachable('af-receipt', 'no receipts to sample (empty)');
    row = rows[0];
  } catch (e) {
    return unreachable('af-receipt', e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e)));
  } finally {
    done();
  }

  // (1) every canonical-required field is present in the RAW live row (a producer that drops a
  //     spine field is caught here, before projection).
  for (const f of CANONICAL_RECEIPT_REQUIRED) {
    check(`[af-receipt] live receipt has canonical-required field "${f}"`, f in row && row[f] != null);
  }
  check('[af-receipt] live receipt supplies a receipt_id (via id or receipt_id)',
    row.id != null || row.receipt_id != null);

  // (2) project to the canonical field set and validate the FULL envelope against canon. No
  //     carve-out. (The acceptance_criteria_* fields were a prior DRIFT finding — AF leaked
  //     SQLite 0/1 for BOOLEAN columns, AF R-Finding #5; reconciled IN FAVOR OF CANON: the AF
  //     producer was fixed to coerce 0/1 -> boolean|null on the GET /receipts read path
  //     (agent-fabric/src/services/receipts-routes.mjs normalizeReceiptRow), canon stays
  //     boolean|null. So the gate validates the COMPLETE envelope; a producer that reintroduces
  //     the 0/1 leak, drops, or wrong-types any field is REJECTED.)
  const envelope = projectReceiptToCanonical(row);
  const result = validate(envelope, 'execution-receipt');
  check('[af-receipt] validates against canonical ExecutionReceipt v1 (full envelope, no carve-out)', result.valid);
  if (!result.valid) {
    console.log('    validator errors:');
    for (const e of result.errors) console.log(`      - ${e}`);
  }

  // (3) spot-pin the invariants that matter most for a live producer.
  check('[af-receipt] outcome is in the canonical enum',
    ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(envelope.outcome));
  check('[af-receipt] duration_ms is a finite number', Number.isFinite(envelope.duration_ms));
  for (const jf of ['af_dispatch_id', 'af_worker_session_id', 'decision_id']) {
    check(`[af-receipt] join field "${jf}" is absent, null, or a string (ADR-0017)`,
      !(jf in envelope) || envelope[jf] === null || typeof envelope[jf] === 'string');
  }
  for (const f of ['acceptance_criteria_evaluated', 'acceptance_criteria_passed']) {
    if (f in envelope) {
      const v = envelope[f];
      check(`[af-receipt] ${f} conforms to canon (boolean|null) — R-Finding #5 reconciled`,
        v === null || typeof v === 'boolean');
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Producer 2 — surfaces enqueue (POST /cortex/enqueue -> task-enqueue-request)
//
// The surfaces->AF intake. We sample the LIVE producer/consumer boundary the only way it is
// observable: POST a REAL canonical TaskEnqueueRequest and assert the LIVE AF consumer ACCEPTS
// it (202 accepted) — i.e. the live intake validates the canonical shape — AND validate that
// exact envelope against canon locally. The envelope is `trivial`-tier with assigned_agent:null
// and a STABLE idempotency_key, so it records an intake-ack only: no dispatch, no spend, no row
// spam (re-runs return idempotent:true). This is the honest "a surface's enqueue conforms to
// canon AND the live consumer accepts it" gate.
// ───────────────────────────────────────────────────────────────────────────

const ENQUEUE_PROBE_ENVELOPE = Object.freeze({
  source: 'manual',
  title: 'cortex live-conformance probe',
  description:
    'Runtime conformance gate (cortex.md C1 [2g]): sample a real TaskEnqueueRequest against the ' +
    'live /cortex/enqueue consumer. Trivial tier, assigned_agent:null => intake-ack only, no ' +
    'dispatch, no model call, no forge spend. Stable idempotency_key => re-runs dedupe.',
  project: 'cortex',
  tier: 'trivial',
  assigned_agent: null,
  priority: 'low',
  idempotency_key: 'cortex-conformance-probe-v1',
});

async function probeSurfacesEnqueue() {
  console.log('\n[2/3] surfaces TaskEnqueueRequest — POST /cortex/enqueue vs task-enqueue-request canon');
  console.log(`      producer/consumer: ${AF_ENQUEUE_URL}`);

  // (a) the envelope the surface would send conforms to canon (the producer side).
  const local = validate(ENQUEUE_PROBE_ENVELOPE, 'task-enqueue-request');
  check('[surfaces-enqueue] sampled envelope validates against canonical TaskEnqueueRequest', local.valid);
  if (!local.valid) {
    console.log('    validator errors:');
    for (const e of local.errors) console.log(`      - ${e}`);
  }

  // (b) the LIVE AF consumer accepts the canonical shape (the consumer side): 202 accepted.
  const { signal, done } = withTimeout(TIMEOUT_MS);
  let res, body;
  try {
    res = await fetch(AF_ENQUEUE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ENQUEUE_PROBE_ENVELOPE),
      signal,
    });
    body = await res.json().catch(() => null);
  } catch (e) {
    done();
    return unreachable('surfaces-enqueue', e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e)));
  }
  done();

  check('[surfaces-enqueue] live consumer accepts the canonical envelope (HTTP 202)', res.status === 202);
  check('[surfaces-enqueue] live consumer returns status:accepted + a dispatch_id',
    body != null && body.status === 'accepted' && typeof body.dispatch_id === 'string' && body.dispatch_id.length > 0);
  // trivial tier => NO workflow_id => the consumer did NOT kick the engine (no dispatch, no spend).
  check('[surfaces-enqueue] trivial tier minted no workflow (intake-ack only, no dispatch/spend)',
    body != null && (body.workflow_id == null));
}

// ───────────────────────────────────────────────────────────────────────────
// Producer 3 — Maestro RouteDecision (POST /v1/chat/completions -> route-decision)
//
// Maestro is OpenAI-compatible; there is no dedicated route-decision endpoint. The canonical
// RouteDecision is emitted in the response body's `_maestro.route_decision` block (post-Wave-B:
// decision_id is now NON-NULL). We send a minimal max_tokens:1 routing probe to the cheapest
// local tier (maestro/fast) and validate the emitted RouteDecision against canon. Token-gated by
// design: absent MAESTRO_AUTH => SKIP (not a failure outside strict mode).
// ───────────────────────────────────────────────────────────────────────────

async function probeMaestroRouteDecision() {
  console.log('\n[3/3] Maestro RouteDecision — POST /v1/chat/completions vs route-decision canon');
  console.log(`      producer: ${MAESTRO_BASE_URL}/v1/chat/completions (strict=${STRICT})`);

  if (!MAESTRO_AUTH) {
    return unreachable('maestro-route', 'MAESTRO_AUTH not in env (token-gated; source ~/.hermes/.env)');
  }

  const { signal, done } = withTimeout(MAESTRO_TIMEOUT_MS);
  let rd;
  try {
    const res = await fetch(`${MAESTRO_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MAESTRO_AUTH}`,
        'X-Maestro-Caller': 'cortex-conformance-probe',
      },
      body: JSON.stringify({
        model: 'maestro/fast',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal,
    });
    if (!res.ok) {
      done();
      return unreachable('maestro-route', `HTTP ${res.status}`);
    }
    const body = await res.json();
    rd = body && body._maestro && body._maestro.route_decision;
    if (!rd || typeof rd !== 'object') {
      done();
      // A live 2xx with no route_decision block IS a conformance failure (the producer stopped
      // emitting the canonical record) — fail, don't skip, regardless of strict.
      check('[maestro-route] response carries a _maestro.route_decision block', false);
      return;
    }
  } catch (e) {
    done();
    return unreachable('maestro-route', e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e)));
  }
  done();

  // decision_id is now NON-NULL post-Wave-B — pin it explicitly (the join key for Quorum labels
  // + Mnemos memories + the AF receipt decision_id).
  check('[maestro-route] decision_id is present and non-null (post-Wave-B)',
    typeof rd.decision_id === 'string' && rd.decision_id.length > 0);

  // Validate the FULL live RouteDecision against canon.
  const result = validate(rd, 'route-decision');
  check('[maestro-route] live RouteDecision validates against canonical route-decision schema', result.valid);
  if (!result.valid) {
    console.log('    validator errors:');
    for (const e of result.errors) console.log(`      - ${e}`);
  }

  // Spot-pin the invariants a downstream join depends on.
  check('[maestro-route] tier is in the canonical enum',
    ['trivial', 'simple', 'standard', 'complex'].includes(rd.tier));
  check('[maestro-route] routing_mode is in the canonical enum',
    ['sonnet-anchored', 'vega-direct', 'vega-blocking-quorum', 'passthrough', 'fallback-sql'].includes(rd.routing_mode));
  check('[maestro-route] model is a non-empty string', typeof rd.model === 'string' && rd.model.length > 0);
  check('[maestro-route] consensus_fired is a boolean', typeof rd.consensus_fired === 'boolean');
  check('[maestro-route] fallback_chain is an array of strings',
    Array.isArray(rd.fallback_chain) && rd.fallback_chain.every((x) => typeof x === 'string'));
  check('[maestro-route] decided_at is a valid date-time',
    typeof rd.decided_at === 'string' && !Number.isNaN(new Date(rd.decided_at).getTime()));
  check('[maestro-route] vega_confidence is null or in [0,1]',
    rd.vega_confidence === null || (typeof rd.vega_confidence === 'number' && rd.vega_confidence >= 0 && rd.vega_confidence <= 1));
}

// ───────────────────────────────────────────────────────────────────────────

(async () => {
  console.log('LIVE conformance gate (cortex.md C1 [2g]) — real producer envelopes vs CANONICAL schema.');
  console.log('Three producers: AF ExecutionReceipt v1 · surfaces TaskEnqueueRequest · Maestro RouteDecision.');

  await probeAfReceipt();
  await probeSurfacesEnqueue();
  await probeMaestroRouteDecision();

  console.log(`\nResults: ${passed} passed, ${failed} failed${skips.length ? `, ${skips.length} skipped` : ''}`);
  if (skips.length) console.log(`Skipped producers: ${skips.join(', ')}`);
  process.exit(failed > 0 ? 1 : 0);
})();
