// Type declarations for @cortex/contracts.
//
// A parsed JSON Schema is intentionally typed loosely (a JSON object) — the
// package ships the schemas as data and does not embed a validator; consumers
// feed the returned object to whatever validator they already use.
export type JsonSchema = Record<string, unknown>;

/** Package semver — advertised by consumers on GET /health as contracts_version. */
export const version: string;

/**
 * Absolute path to the directory holding the canonical *.schema.json files.
 * Honors the CORTEX_CONTRACTS_DIR env override (COPY-into-image / bind-mount),
 * otherwise resolves to the installed package's own directory.
 */
export function schemasDir(): string;

/** Canonical schema filenames (basename, e.g. "task-envelope.schema.json"). */
export function schemaFiles(): string[];

/** Every canonical schema, keyed by basename filename. */
export function allSchemas(): Record<string, JsonSchema>;

/**
 * Load one schema by its $id, its "<name>.schema.json" filename, or its bare
 * "<name>". Throws if nothing matches.
 */
export function getSchema(idOrName: string): JsonSchema;

declare const _default: {
  schemasDir: typeof schemasDir;
  schemaFiles: typeof schemaFiles;
  allSchemas: typeof allSchemas;
  getSchema: typeof getSchema;
  version: string;
};
export default _default;
