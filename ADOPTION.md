# Adopting `@cortex/contracts` / `cortex-contracts` (R1 → WS-CTX-3)

> **Status:** **0.2.0 release candidate**. Canonical schema IDs now use the
> owned `https://schemas.this.live/cortex/` prefix, with backward-compatible
> lookup aliases for the historical `cortex.dev` IDs.
> Release-asset publish is via GitHub Actions on `contracts-v*` tags (`.github/workflows/contracts-release.yml`, ledger D6 / WS-CTX-3).
> The first production tag is `contracts-v0.2.0`; consumers adopt only after its
> npm tarball and Python wheel are attached and clean-install probes pass.
> Switching a pillar's loader is that pillar's own change; this file is the single adoption tracker.

## Adoption tracker (WS-CTX-3 / Phase-1 exit)

| Repo | Consumption today | Pinned version | Path-hack retired? | `/health` `contracts_version`? | Verified |
|---|---|---|---|---|---|
| agent-fabric | `file:../cortex/contracts` + vendored mirror | 0.2.0 (file:) | N | partial (additive field landed; release-URL pin pending) | 2026-07-15 |
| mnemos | wheel in `mnemos/vendor/` (wrong repo) | 0.1.0 | N | N | — |
| maestro | portable loader `c077e29` (template) | source/wheel fallback | partial | N | — |
| surfaces | `../../cortex` + build-time copy | path-hack | N | N | deferred — Surfaces L1 dirty tree |
| forge | sibling-checkout fallback | declared 0.1.0 unused | N | N | — |
| cortex-cockpit | reads `contracts/package.json` at boot | 0.2.0 (source) | n/a (home) | **Y** (`GET /health`) | 2026-07-15 |

Release-URL consumption (all six rows) is the retirement gate for `cortex/vendor/*` and sibling mirrors.

---

## What ships

`cortex/contracts/` is installable in **both** ecosystems at **`0.2.0`**, shipping the
**same canonical `*.schema.json` files** (one source, no divergent copies) — including
`health-status.schema.json` (ADR-0026):

| Ecosystem | Package | Entry | Loaders |
|---|---|---|---|
| npm | `@cortex/contracts` (ESM, zero runtime deps) | `index.mjs` / `index.d.ts` | `schemasDir()`, `getSchema(idOrName)`, `allSchemas()`, `schemaFiles()`, `version` |
| PyPI-style wheel | `cortex-contracts` (zero runtime deps) | `cortex_contracts/__init__.py` | `contracts_dir()`, `get_schema(id_or_name)`, `all_schemas()`, `schema_files()`, `__version__` |

Resolution order: `CORTEX_CONTRACTS_DIR` (always wins) → packaged schemas → (Python) source sibling fallback.

`getSchema` / `get_schema` accept bare name, filename, or full `$id`.
No bundled validator — consumers keep their own (ajv / jsonschema / …).

## Quickstart

### Release assets

```sh
npm install https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-v0.2.0/cortex-contracts-0.2.0.tgz
pip install https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-v0.2.0/cortex_contracts-0.2.0-py3-none-any.whl
```

### Consumer snippet

```js
import { getSchema, schemasDir, version } from "@cortex/contracts";
// Advertise `version` on GET /health as contracts_version (ADR-0026).
```

```python
from cortex_contracts import get_schema, contracts_dir, __version__
# Advertise __version__ on GET /health as contracts_version (ADR-0026).
```

---

## Migration pattern (every pillar)

1. Pin `@cortex/contracts` / `cortex-contracts` to the immutable release-asset URL.
2. Replace `parents[N]` / `../../cortex` resolution with `schemasDir()` / `contracts_dir()`.
3. Keep `CORTEX_CONTRACTS_DIR` for COPY-into-image / bind-mount.
4. Advertise `contracts_version` on `GET /health` (schema: `health-status.schema.json`).
5. Delete vendored mirrors and sibling-path resolution after the package probe is green.

**Template:** maestro portable loader (`c077e29`).

### Per-pillar notes

| Pillar | Current | Next |
|---|---|---|
| agent-fabric | `file:../cortex/contracts` | release-URL pin; drop mirror; `contracts_version` on `/health` (partial landed 2026-07-15) |
| maestro | portable loader | declare real dep + advertise `contracts_version` |
| forge | sibling fallback | pin wheel URL; demote sibling to dev-only (WS-forge-3) |
| mnemos | wrong-repo wheel | pin cortex release wheel; delete `mnemos/vendor/*.whl` |
| surfaces | `../../cortex` + build copy | **deferred** while Surfaces L1 dirty tree is in flight — do not touch `desktop/app/**` / dirty renderer from P1.contracts |
| cortex-cockpit | source tree | `GET /health` DONE (ADR-0026); release-URL when tagged |

---

## Identifier compatibility

Canonical identifiers use `https://schemas.this.live/cortex/`. JavaScript and
Python loaders continue to resolve historical
`https://cortex.dev/schemas/...` lookup strings during the 0.x migration, but
always return schemas carrying the canonical owned-domain identifier.
