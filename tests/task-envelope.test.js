/**
 * Round-trip + lifecycle test for the TaskEnvelope contract.
 *
 * Pins the consolidated ≤8-state lifecycle (2026-06-10, AF-WS4 lifecycle gate):
 * the two pure substates `dispatched` (now `running` with started_at unset) and
 * `needs_review` (now `reviewing` with review.needs_human=true) were collapsed.
 * This test is the canonical guard so the enum cannot silently regrow past 8 and
 * so the escalation flag (`review.needs_human`) stays representable.
 */

const fs = require('fs');
const path = require('path');
const { validate } = require('./validator.js');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'task-envelope.schema.json'), 'utf8')
);

const EXPECTED_STATES = [
  'refining',
  'clarifying',
  'blocked',
  'queued',
  'running',
  'reviewing',
  'done',
  'failed'
];

const REMOVED_STATES = ['dispatched', 'needs_review'];

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); passed++; }
  else { console.log(`  FAIL: ${name}`); failed++; }
}

console.log('Testing TaskEnvelope contract...\n');

console.log('Lifecycle enum (≤8 acceptance gate):');
const statusEnum = schema.properties.status.enum;
check('status enum has exactly 8 states', statusEnum.length === 8);
check('status enum matches the consolidated set', JSON.stringify(statusEnum) === JSON.stringify(EXPECTED_STATES));
for (const removed of REMOVED_STATES) {
  check(`removed state "${removed}" absent from enum`, !statusEnum.includes(removed));
}
check('default status is still "refining"', schema.properties.status.default === 'refining');

console.log('\nEscalation flag (needs_review collapse target):');
const review = schema.properties.review;
check('review object carries needs_human flag', !!(review.properties && review.properties.needs_human));

console.log('\nValid payload round-trips:');
const validEnvelopes = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    project: 'agent-fabric',
    source: 'manual',
    title: 'collapse lifecycle',
    capability: 'code',
    prompt: 'do the thing',
    status: 'running'
  },
  {
    // reviewing + needs_human is the new shape for what was needs_review
    id: '22222222-2222-4222-8222-222222222222',
    project: 'cortex',
    source: 'cron',
    title: 'escalated task',
    capability: 'review',
    prompt: 'grade the output',
    status: 'reviewing',
    review: { score: 0.4, passed: false, critique: 'retries exhausted', needs_human: true }
  }
];
for (const env of validEnvelopes) {
  const r = validate(env, 'task-envelope');
  check(`valid envelope (${env.status}) conforms`, r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

console.log('\nInvalid payload rejection (removed states):');
for (const removed of REMOVED_STATES) {
  const r = validate(
    {
      id: '33333333-3333-4333-8333-333333333333',
      project: 'cortex',
      source: 'manual',
      title: 'x',
      capability: 'code',
      prompt: 'x',
      status: removed
    },
    'task-envelope'
  );
  check(`removed state "${removed}" rejected at runtime`, !r.valid);
}

// ── Dynamic-workflow-engine extension fields (workflowId/nodeId/context/routing) ──
// Added 2026-06-10 (AF-WS5 engine-primitives). The canonical schema is
// additionalProperties:false, so these MUST exist here for agent-fabric to import them.
console.log('\nDynamic-workflow-engine extension fields:');
const props = schema.properties;
check('schema defines workflowId', !!props.workflowId);
check('schema defines nodeId', !!props.nodeId);
check('schema defines context', !!props.context);
check('schema defines routing', !!props.routing);
check('context is a nested object with workTreePath/sessionId/checkpoint',
  !!(props.context && props.context.properties &&
     props.context.properties.workTreePath &&
     props.context.properties.sessionId &&
     props.context.properties.checkpoint));
check('routing carries model/provider/reason/fallbackChain/decision_id',
  !!(props.routing && props.routing.properties &&
     props.routing.properties.model &&
     props.routing.properties.provider &&
     props.routing.properties.reason &&
     props.routing.properties.fallbackChain &&
     props.routing.properties.decision_id));
check('the four extension fields all default to null',
  props.workflowId.default === null &&
  props.nodeId.default === null &&
  props.context.default === null &&
  props.routing.default === null);

console.log('\nWorkflow-node envelope round-trips:');
const workflowEnvelope = {
  id: '44444444-4444-4444-8444-444444444444',
  project: 'forge',
  source: 'manual',
  title: 'fan-out node',
  capability: 'research',
  prompt: 'research relics design',
  status: 'running',
  workflowId: '55555555-5555-4555-8555-555555555555',
  nodeId: 'relics-design',
  context: {
    workTreePath: '/Users/jarvis/.agent-fabric-runtime/workflows/55555555/relics-design',
    sessionId: 'sess_01HX',
    checkpoint: { lastNode: 'classify', state: { progress: 0.5 }, savedAt: '2026-06-10T12:00:00Z' }
  },
  routing: {
    model: 'claude-fable-5',
    provider: 'claude',
    reason: 'research task class -> registry primary',
    fallbackChain: ['claude-opus-4-8', 'gpt-5.5'],
    decision_id: 'dec_01HX'
  }
};
{
  const r = validate(workflowEnvelope, 'task-envelope');
  check('workflow-node envelope conforms', r.valid);
  if (!r.valid) r.errors.forEach(e => console.log(`    - ${e}`));
}

console.log('\nExtension rejection (additionalProperties:false still holds):');
{
  const r = validate(
    {
      id: '66666666-6666-4666-8666-666666666666',
      project: 'cortex',
      source: 'manual',
      title: 'x',
      capability: 'code',
      prompt: 'x',
      status: 'queued',
      bogusField: 'nope'
    },
    'task-envelope'
  );
  check('an unknown top-level field is still rejected', !r.valid);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
