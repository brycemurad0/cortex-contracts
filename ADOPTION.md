# Adopting `@cortex/contracts` / `cortex-contracts` (R1 → WS-CTX-3)

> **Status:** **0.3.0 projection prepared for immutable public distribution.**
> Canonical schema IDs use the
> owned `https://schemas.this.live/cortex/` prefix, with backward-compatible
> lookup aliases for the historical `cortex.dev` IDs.
> Contracts remain authored in `cortex/contracts/`; the consumer distribution
> is the public MIT-only
> [`brycemurad0/cortex-contracts`](https://github.com/brycemurad0/cortex-contracts)
> projection. A source version bump, branch, or locally built artifact is not a
> consumer release. Consumers may repin only when the `contracts-v0.3.0` release
> exists with passing contract, clean-install, provenance, and checksum gates.
> Switching a pillar's loader is that pillar's own change; this file is the single adoption tracker.

## Adoption tracker (WS-CTX-3 / Phase-1 exit)

| Repo | Consumption today | Pinned version | Path-hack retired? | `/health` `contracts_version`? | Verified |
|---|---|---|---|---|---|
| agent-fabric | immutable public release asset | 0.2.0 | **Y** | **Y**; isolated 0.3.0 adoption proof is green, release-URL repin pending | 2026-08-01 |
| mnemos | wheel in `mnemos/vendor/` (wrong repo) | 0.1.0 | N | N | — |
| maestro | portable loader `c077e29` (template) | source/wheel fallback | partial | N | — |
| surfaces | `../../cortex` + build-time copy | path-hack | N | N | deferred — Surfaces L1 dirty tree |
| forge | sibling-checkout fallback | declared 0.1.0 unused | N | N | — |
| cortex-cockpit | reads canonical source package at boot | 0.3.0-rc (source) | n/a (home) | **Y** (`GET /health`) | 2026-08-01 |

Release-URL consumption (all six rows) is the retirement gate for `cortex/vendor/*` and sibling mirrors.

---

## What ships

`cortex/contracts/` is the canonical authoring source; this distribution
projection is versioned `0.3.0`. Both packages ship the same canonical
`*.schema.json` files, including
`health-status.schema.json` (ADR-0026):

| Ecosystem | Package | Entry | Loaders |
|---|---|---|---|
| npm | `@cortex/contracts` (ESM, zero runtime deps) | `index.mjs` / `index.d.ts` | `schemasDir()`, `getSchema(idOrName)`, `allSchemas()`, `schemaFiles()`, `version` |
| PyPI-style wheel | `cortex-contracts` (zero runtime deps) | `cortex_contracts/__init__.py` | `contracts_dir()`, `get_schema(id_or_name)`, `all_schemas()`, `schema_files()`, `__version__` |

Resolution order: `CORTEX_CONTRACTS_DIR` (always wins) → packaged schemas → (Python) source sibling fallback.

`getSchema` / `get_schema` accept bare name, filename, or full `$id`.
No bundled validator — consumers keep their own (ajv / jsonschema / …).

## Quickstart

### 0.3.0 release assets (after publication)

These URLs intentionally fail before the public `contracts-v0.3.0` release
exists. Never replace them with a branch archive, sibling path, or locally
vendored package in a release build.

```sh
VERSION=0.3.0
BASE="https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-v${VERSION}"
mkdir "cortex-contracts-${VERSION}" && cd "cortex-contracts-${VERSION}"
curl -fLO "${BASE}/cortex-contracts-${VERSION}.tgz"
curl -fLO "${BASE}/cortex_contracts-${VERSION}-py3-none-any.whl"
curl -fLO "${BASE}/SHA256SUMS"
shasum -a 256 -c SHA256SUMS
npm install "./cortex-contracts-${VERSION}.tgz"
pip install "./cortex_contracts-${VERSION}-py3-none-any.whl"
```

The release-attached `SHA256SUMS`, backed by the projection's provenance and
workflow evidence, is the checksum source of truth. Do not copy an artifact's
own checksum into package content.

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
| agent-fabric | immutable 0.2.0 release asset, no sibling or mirror fallback | repin to immutable 0.3.0 release URL after publication; isolated 1,722-test proof is already green |
| maestro | portable loader | declare real dep + advertise `contracts_version` |
| forge | sibling fallback | pin wheel URL; demote sibling to dev-only (WS-forge-3) |
| mnemos | wrong-repo wheel | pin cortex release wheel; delete `mnemos/vendor/*.whl` |
| surfaces | `../../cortex` + build copy | **deferred** while Surfaces L1 dirty tree is in flight — do not touch `desktop/app/**` / dirty renderer from P1.contracts |
| cortex-cockpit | source tree | `GET /health` DONE (ADR-0026); release-URL when tagged |

---

## Cutting a public release (`contracts-vX.Y.Z`)

Publishing is **GitHub release assets from the public MIT-only
`brycemurad0/cortex-contracts` projection** on `contracts-v*` tags. The
registry approach (npm/PyPI publish) remains intentionally unused. Canonical
schemas and loaders are changed and reviewed in this directory first; the
projection is an exact, provenance-stamped distribution copy.

The projection's release workflow gates on the contract suite, builds both
packages, clean-install-probes them, and attaches three assets:

| Asset | For |
|---|---|
| `cortex-contracts-X.Y.Z.tgz` | `npm install <url>` (@cortex/contracts) |
| `cortex_contracts-X.Y.Z-py3-none-any.whl` | `pip install <url>` (cortex-contracts) |
| `SHA256SUMS` | integrity pinning for both packages |

Steps:

1. Bump `version` in **both** canonical `package.json` and `pyproject.toml`,
   run `npm test` from this directory, and dry-run the exact asset set locally:
   `bash scripts/build-release-assets.sh` → git-ignored `dist/` (npm tarball +
   wheel + schemas-only tar.gz + SHA256SUMS).
2. Land and review the canonical Cortex change with its root changelog entry.
3. Export only the MIT-licensed contract package surface to
   `brycemurad0/cortex-contracts`; update its `PROVENANCE.md` with the canonical
   source commit and verify the projected files before release.
4. Tag the reviewed projection commit `contracts-vX.Y.Z` and push the tag.
   **Tag pushes are a deliberate release act**, never a side effect of feature
   work.
5. Verify the public workflow, clean-install probes, release assets, and
   `SHA256SUMS`; then update the adoption tracker as consumers re-pin.

The private Cortex workflow (`.github/workflows/contracts-release.yml`) remains
in place for canonical-repository release history. It builds its assets with
`contracts/scripts/build-release-assets.sh` — the same script as the local
dry-run, so CI and local builds cannot drift — and attaches one asset beyond
the projection's set: `cortex-contracts-schemas-X.Y.Z.tar.gz`, the schemas-only
bundle (`*.schema.json` + LICENSE) for COPY-into-image / `CORTEX_CONTRACTS_DIR`
consumers that want neither npm nor pip. Do not use its private release URLs in
consumer manifests.

Downstream pins the immutable asset URL (never a branch path):

```sh
npm install https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-vX.Y.Z/cortex-contracts-X.Y.Z.tgz
pip install https://github.com/brycemurad0/cortex-contracts/releases/download/contracts-vX.Y.Z/cortex_contracts-X.Y.Z-py3-none-any.whl
```

and records the SHA256 from `SHA256SUMS` alongside the pin where the consumer
has an integrity field (e.g. npm lockfile integrity, Dockerfile checksum check).

---

## Identifier compatibility

Canonical identifiers use `https://schemas.this.live/cortex/`. JavaScript and
Python loaders continue to resolve historical
`https://cortex.dev/schemas/...` lookup strings during the 0.x migration, but
always return schemas carrying the canonical owned-domain identifier.
