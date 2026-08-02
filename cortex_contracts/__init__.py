"""cortex-contracts — canonical Cortex shared JSON Schema contracts (ADR-0014).

This wheel makes ``cortex/contracts`` an installable, versioned Python
dependency. Instead of every pillar reaching for a hard-coded relative path
(``parents[N]/cortex/contracts``) that exists in no container, a consumer does::

    from cortex_contracts import get_schema, contracts_dir, all_schemas

    schema = get_schema("task-envelope")

The schemas ship as package data (the same canonical ``*.schema.json`` files,
one source — no divergent copies; they are ``force-include``'d from
``cortex/contracts/`` into ``cortex_contracts/schemas/`` at build time). For
COPY-into-image / bind-mount deployments a consumer can point the loader at any
directory via the ``CORTEX_CONTRACTS_DIR`` environment variable, which takes
precedence over the packaged copy.

Zero runtime dependencies (stdlib only). A consumer that needs validation
supplies its own validator (``jsonschema`` / ``pydantic`` / ...) and feeds it
the dict returned by :func:`get_schema`.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict

__version__ = "0.3.0"

__all__ = [
    "contracts_dir",
    "schema_files",
    "all_schemas",
    "get_schema",
    "__version__",
]

# Directory of this module inside the installed package.
_PACKAGE_DIR = Path(__file__).resolve().parent

# Where the *.schema.json live inside the built wheel (force-include target).
_PACKAGED_SCHEMAS = _PACKAGE_DIR / "schemas"

# Fallback for a source / editable checkout, where the schemas have NOT been
# force-included yet and still live at their canonical home one level up
# (cortex/contracts/*.schema.json — the module lives at cortex/contracts/
# cortex_contracts/, so the canonical dir is the parent).
_SOURCE_SCHEMAS = _PACKAGE_DIR.parent

_CURRENT_ID_PREFIX = "https://schemas.this.live/cortex/"
_LEGACY_ID_PREFIX = "https://cortex.dev/schemas/"


def contracts_dir() -> str:
    """Absolute path to the directory holding the canonical ``*.schema.json``.

    Resolution order:

    1. ``CORTEX_CONTRACTS_DIR`` env var (if set + non-empty) — the
       COPY-into-image / bind-mount override.
    2. The packaged ``cortex_contracts/schemas/`` dir (installed wheel).
    3. The sibling canonical dir (source / editable checkout fallback).
    """
    override = os.environ.get("CORTEX_CONTRACTS_DIR")
    if override and override.strip():
        return str(Path(override.strip()).resolve())
    if _PACKAGED_SCHEMAS.is_dir():
        return str(_PACKAGED_SCHEMAS)
    return str(_SOURCE_SCHEMAS)


def schema_files() -> list[str]:
    """Sorted list of canonical schema filenames (e.g. ``task-envelope.schema.json``)."""
    d = Path(contracts_dir())
    return sorted(p.name for p in d.glob("*.schema.json"))


def _read(d: Path, name: str) -> dict:
    return json.loads((d / name).read_text(encoding="utf-8"))


def all_schemas() -> Dict[str, dict]:
    """Every canonical schema, keyed by basename filename."""
    d = Path(contracts_dir())
    return {name: _read(d, name) for name in schema_files()}


def get_schema(id_or_name: str) -> dict:
    """Load one schema by any of its stable identifiers.

    Accepts:

    * the full ``$id``                 (``https://schemas.this.live/cortex/task-envelope.json``)
    * the schema filename              (``task-envelope.schema.json``)
    * the base name (no extension)     (``task-envelope``)

    Raises ``KeyError`` if nothing matches.
    """
    if not isinstance(id_or_name, str) or not id_or_name.strip():
        raise TypeError("get_schema(id_or_name): id_or_name must be a non-empty string")

    requested_key = id_or_name.strip()
    # v0.2.0 moved canonical identifiers onto a domain This.Live owns. Retain
    # the never-owned v0.1.x identifiers as lookup aliases for persisted
    # references; returned schemas always expose the canonical identifier.
    key = (
        _CURRENT_ID_PREFIX + requested_key[len(_LEGACY_ID_PREFIX):]
        if requested_key.startswith(_LEGACY_ID_PREFIX)
        else requested_key
    )
    d = Path(contracts_dir())

    # 1. Direct filename hit.
    if key.endswith(".schema.json") and (d / key).is_file():
        return _read(d, key)

    # 2. Base name hit.
    by_base = f"{key}.schema.json"
    if (d / by_base).is_file():
        return _read(d, by_base)

    # 3. $id hit: scan and match on declared $id.
    for name in schema_files():
        schema = _read(d, name)
        if schema.get("$id") == key:
            return schema

    raise KeyError(
        f'get_schema: no contract matches "{id_or_name}" in {d} '
        '(accepts a $id, a "<name>.schema.json" filename, or a bare "<name>")'
    )
