/**
 * Minimal JSON Schema validator for round-trip tests.
 * Validates structure against draft-07 style schemas without external deps.
 */

const fs = require('fs');
const path = require('path');

// R1 adoption: resolve the canonical schema directory the same way the published
// @cortex/contracts loader does — CORTEX_CONTRACTS_DIR (the COPY-into-image /
// bind-mount override) takes precedence, else fall back to the sibling canonical
// dir (this suite lives at cortex/contracts/tests, so the schemas are one level
// up). This test suite is CommonJS and the @cortex/contracts entry is ESM, so we
// mirror the package's resolution precedence rather than statically importing it;
// the schema files it points at are the SAME canonical *.schema.json.
function contractsDir() {
  const override = process.env.CORTEX_CONTRACTS_DIR;
  if (typeof override === 'string' && override.trim() !== '') {
    return path.resolve(override.trim());
  }
  return path.resolve(__dirname, '..');
}

function loadSchema(name) {
  const schemaPath = path.join(contractsDir(), `${name}.schema.json`);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

function validateType(value, expectedType) {
  if (expectedType === 'integer') {
    return typeof value === 'number' && Number.isInteger(value);
  }
  if (expectedType === 'array') {
    return Array.isArray(value);
  }
  if (expectedType === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  if (Array.isArray(expectedType)) {
    return expectedType.some(t => validateType(value, t));
  }
  return typeof value === expectedType;
}

function validateFormat(value, format) {
  if (format === 'date-time') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  if (format === 'uri') {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  if (format === 'uuid') {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
  return true;
}

function validateValue(value, schema, path = '') {
  const errors = [];

  // Handle null
  if (value === null) {
    if (schema.type && (schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null')))) {
      return errors;
    }
    if (schema.type) {
      errors.push(`${path}: expected ${JSON.stringify(schema.type)}, got null`);
    }
    return errors;
  }

  // Type check
  if (schema.type) {
    if (!validateType(value, schema.type)) {
      errors.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${typeof value}`);
      return errors;
    }
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value "${value}" not in enum ${JSON.stringify(schema.enum)}`);
  }

  // Const check (draft-07 const keyword). Strict equality for scalars; a
  // const on a non-scalar is rare in this contract set but supported via
  // JSON deep-equality.
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    const a = JSON.stringify(value);
    const b = JSON.stringify(schema.const);
    if (a !== b) {
      errors.push(`${path}: value ${a} !== const ${b}`);
    }
  }

  // String constraints
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string length ${value.length} < minLength ${schema.minLength}`);
    }
    // maxLength was previously unimplemented: declared constraints
    // (task-enqueue-request title<=200 / description<=32000) were dead, so a
    // 50KB title passed intake validation unbounded. Now enforced.
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: string length ${value.length} > maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !(new RegExp(schema.pattern).test(value))) {
      errors.push(`${path}: string "${value}" does not match pattern /${schema.pattern}/`);
    }
    if (schema.format && !validateFormat(value, schema.format)) {
      errors.push(`${path}: string does not match format "${schema.format}"`);
    }
  }

  // Number constraints
  if (typeof value === 'number') {
    // Non-finite guard: NaN and ±Infinity are `typeof 'number'`, but JSON has no
    // representation for them and they break every range comparison — `NaN < min`
    // and `NaN > max` are BOTH false, so a NaN silently passed as an in-range
    // number, and an Infinity slipped through any field with only a minimum.
    // Reject them outright so a malformed numeric from an untrusted producer
    // (e.g. task-envelope.confidence, route-decision score) is a clean rejection,
    // not a silently-valid value. (integer fields are already covered by
    // Number.isInteger, which rejects NaN/Infinity; this also pins `number`.)
    if (!Number.isFinite(value)) {
      errors.push(`${path}: value ${value} is not a finite number`);
    } else {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: value ${value} < minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: value ${value} > maximum ${schema.maximum}`);
      }
    }
  }

  // Array constraints
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: array length ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const k = JSON.stringify(item);
        if (seen.has(k)) {
          errors.push(`${path}: array items must be unique (duplicate ${k})`);
          break;
        }
        seen.add(k);
      }
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validateValue(item, schema.items, `${path}[${i}]`));
      });
    }
  }

  // Object constraints
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in value)) {
          errors.push(`${path}: missing required field "${field}"`);
        }
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [key, val] of Object.entries(value)) {
        if (schema.properties[key]) {
          errors.push(...validateValue(val, schema.properties[key], `${path}.${key}`));
        } else if (schema.additionalProperties === false) {
          errors.push(`${path}: additional property "${key}" not allowed`);
        }
      }
    }
  }

  return errors;
}

function validate(data, schemaName) {
  const schema = loadSchema(schemaName);
  const errors = validateValue(data, schema);
  return {
    valid: errors.length === 0,
    errors
  };
}

// validateValue is exported for keyword-coverage tests that exercise a
// constraint in isolation (inline schema, no on-disk schema file needed).
module.exports = { validate, loadSchema, validateValue };
