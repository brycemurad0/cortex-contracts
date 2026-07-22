/** Release integrity for the standalone @cortex/contracts / cortex-contracts artifacts. */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OWNED_PREFIX = 'https://schemas.this.live/cortex/';
const LEGACY_PREFIX = 'https://cortex.dev/schemas/';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

async function main() {
  console.log('Testing standalone contracts release integrity...\n');

  const packageJson = readJson('package.json');
  const pyproject = fs.readFileSync(path.join(ROOT, 'pyproject.toml'), 'utf8');
  const pythonLoader = fs.readFileSync(path.join(ROOT, 'cortex_contracts', '__init__.py'), 'utf8');
  const jsLoader = await import(pathToFileURL(path.join(ROOT, 'index.mjs')).href);

  check('npm package version is 0.2.0', packageJson.version === '0.2.0');
  check('JavaScript loader exports package version', jsLoader.version === packageJson.version);
  check('Python package version matches', pyproject.includes(`version = "${packageJson.version}"`) && pythonLoader.includes(`__version__ = "${packageJson.version}"`));
  check('npm package is MIT licensed', packageJson.license === 'MIT');
  check('Python package is MIT licensed', pyproject.includes('license = { text = "MIT" }'));
  check('MIT license file ships at package root', fs.existsSync(path.join(ROOT, 'LICENSE')));

  const schemaFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith('.schema.json')).sort();
  const schemas = schemaFiles.map((name) => ({ name, schema: readJson(name) }));
  const ids = schemas.map(({ schema }) => schema.$id);
  check('at least one schema ships', schemas.length > 0);
  check('every schema uses the owned identifier prefix', ids.every((id) => typeof id === 'string' && id.startsWith(OWNED_PREFIX)));
  check('schema identifiers are unique', new Set(ids).size === ids.length);
  check('no schema contains the legacy domain', schemas.every(({ schema }) => !JSON.stringify(schema).includes('cortex.dev')));

  const taskEnvelope = await jsLoader.getSchema('task-envelope');
  const legacyTaskEnvelope = await jsLoader.getSchema(`${LEGACY_PREFIX}task-envelope.json`);
  check('bare-name lookup returns the canonical ID', taskEnvelope.$id === `${OWNED_PREFIX}task-envelope.json`);
  check('legacy full-ID lookup resolves compatibly', legacyTaskEnvelope.$id === taskEnvelope.$id);

  const pythonProbe = spawnSync(
    process.env.PYTHON || 'python3',
    ['-c', [
      'import cortex_contracts as c',
      `s = c.get_schema("${LEGACY_PREFIX}task-envelope.json")`,
      `assert c.__version__ == "${packageJson.version}"`,
      `assert s["$id"] == "${OWNED_PREFIX}task-envelope.json"`,
    ].join('; ')],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONPATH: ROOT } },
  );
  check('Python loader version and legacy-ID alias match', pythonProbe.status === 0, pythonProbe.stderr.trim());

  const leaked = fs.readdirSync(ROOT).filter((name) => /(?:\.bak|\.tmp|\.swp|\.tgz)$/.test(name));
  check('source package contains no leaked build or editor artifacts', leaked.length === 0, leaked.join(', '));

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  console.log(`\nResults: ${passed} passed, ${failed + 1} failed`);
  process.exit(1);
});
