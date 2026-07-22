// @cortex/contracts — canonical Cortex shared JSON Schema contracts (ADR-0014).
//
// This module is the npm entry point that makes cortex/contracts an installable,
// versioned dependency. Instead of every pillar reaching for a hard-coded
// relative path (parents[N]/cortex/contracts) that exists in no container, a
// consumer does:
//
//     import { getSchema, schemasDir, allSchemas } from "@cortex/contracts";
//
// The schemas ship as package data (the *.schema.json files sit next to this
// file in the published tarball), so the resolved directory is self-contained
// inside the installed package. For COPY-into-image / bind-mount deployments a
// consumer can point the loader at any directory via the CORTEX_CONTRACTS_DIR
// environment variable, which takes precedence over the packaged copy.
//
// Zero runtime dependencies (Node stdlib only) — the package is safe to depend
// on from any pillar without dragging a validator or ajv into every image. A
// consumer that needs validation supplies its own validator and feeds it the
// schema object returned by getSchema().

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// The directory that contains this module. In the published package the
// *.schema.json files are siblings of index.mjs, so this is the packaged
// schema directory.
const PACKAGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CURRENT_ID_PREFIX = "https://schemas.this.live/cortex/";
const LEGACY_ID_PREFIX = "https://cortex.dev/schemas/";

/** Package semver — advertised by consumers on GET /health as contracts_version. */
export const version = (() => {
  try {
    const require = createRequire(import.meta.url);
    return require("./package.json").version;
  } catch {
    return "0.2.0";
  }
})();

/**
 * Absolute path to the directory holding the canonical *.schema.json files.
 *
 * Resolution order:
 *   1. process.env.CORTEX_CONTRACTS_DIR (if set + non-empty) — the
 *      COPY-into-image / bind-mount override.
 *   2. The package's own directory (schemas shipped as package data).
 *
 * @returns {string}
 */
export function schemasDir() {
  const override = process.env.CORTEX_CONTRACTS_DIR;
  if (typeof override === "string" && override.trim() !== "") {
    return path.resolve(override.trim());
  }
  return PACKAGE_DIR;
}

/**
 * List the canonical schema filenames (basename, e.g.
 * "task-envelope.schema.json") in the resolved schemas directory.
 * @returns {string[]}
 */
export function schemaFiles() {
  const dir = schemasDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".schema.json"))
    .sort();
}

function readSchemaFile(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
}

/**
 * Load every canonical schema.
 * @returns {Record<string, object>} map keyed by basename filename
 *   (e.g. "task-envelope.schema.json") to the parsed schema object.
 */
export function allSchemas() {
  const dir = schemasDir();
  const out = {};
  for (const file of schemaFiles()) {
    out[file] = readSchemaFile(dir, file);
  }
  return out;
}

/**
 * Load one schema by any of its stable identifiers.
 *
 * Accepts:
 *   - the full $id                       ("https://schemas.this.live/cortex/task-envelope.json")
 *   - the schema filename                ("task-envelope.schema.json")
 *   - the base name (no extension)       ("task-envelope")
 *
 * @param {string} idOrName
 * @returns {object} the parsed schema
 * @throws {Error} if no schema matches
 */
export function getSchema(idOrName) {
  if (typeof idOrName !== "string" || idOrName.trim() === "") {
    throw new TypeError("getSchema(idOrName): idOrName must be a non-empty string");
  }
  const requestedKey = idOrName.trim();
  // v0.2.0 moved canonical identifiers onto a domain This.Live owns. Keep the
  // never-owned v0.1.x identifiers as loader aliases so a persisted reference
  // can still resolve while producers migrate; returned schemas always expose
  // the canonical identifier.
  const key = requestedKey.startsWith(LEGACY_ID_PREFIX)
    ? `${CURRENT_ID_PREFIX}${requestedKey.slice(LEGACY_ID_PREFIX.length)}`
    : requestedKey;
  const dir = schemasDir();

  // 1. Direct filename hit: "task-envelope.schema.json".
  if (key.endsWith(".schema.json")) {
    const p = path.join(dir, key);
    if (fs.existsSync(p)) return readSchemaFile(dir, key);
  }

  // 2. Base name hit: "task-envelope" -> "task-envelope.schema.json".
  const byBase = `${key}.schema.json`;
  if (fs.existsSync(path.join(dir, byBase))) {
    return readSchemaFile(dir, byBase);
  }

  // 3. $id hit: scan the schemas and match on the declared $id.
  for (const file of schemaFiles()) {
    const schema = readSchemaFile(dir, file);
    if (schema && schema.$id === key) return schema;
  }

  throw new Error(
    `getSchema: no contract matches "${idOrName}" in ${dir} ` +
      `(accepts a $id, a "<name>.schema.json" filename, or a bare "<name>")`
  );
}

export default { schemasDir, schemaFiles, allSchemas, getSchema, version };
