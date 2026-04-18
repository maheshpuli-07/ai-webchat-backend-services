/**
 * Redact secrets and trim large payloads for stdout logging.
 */

const MAX_JSON_CHARS = 14000;

/** Keys (exact) always redacted in objects. */
const REDACT_KEYS = new Set([
  'password',
  'access_token',
  'refresh_token',
  'id_token',
  'credential',
  'token',
  'Authorization',
  'authentication',
  'AuthenticationKey',
  'AuthenticationCode',
  'authToken',
  'cbaAuthToken',
  'openaiApiKey',
  'groqApiKey',
]);

function shouldRedactKey(key) {
  const k = String(key || '');
  if (REDACT_KEYS.has(k)) return true;
  if (/password/i.test(k)) return true;
  if (/secret/i.test(k) && k.length < 48) return true;
  if ((/key$/i.test(k) || /^apikey$/i.test(k)) && k.length < 48) return true;
  return false;
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @returns {unknown}
 */
function sanitizeForLog(value, depth = 0) {
  if (depth > 8) return '[MaxDepth]';
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const cap = 200;
    const slice = value.length > cap ? value.slice(0, cap) : value;
    const mapped = slice.map((v) => sanitizeForLog(v, depth + 1));
    if (value.length > cap) mapped.push(`…[+${value.length - cap} more items]`);
    return mapped;
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = shouldRedactKey(k) ? '[REDACTED]' : sanitizeForLog(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function stringifyForTerminal(data) {
  try {
    const s = typeof data === 'string' ? data : JSON.stringify(sanitizeForLog(data));
    if (s.length <= MAX_JSON_CHARS) return s;
    return `${s.slice(0, MAX_JSON_CHARS)}…[truncated ${s.length - MAX_JSON_CHARS} chars]`;
  } catch {
    return String(data).slice(0, MAX_JSON_CHARS);
  }
}

/**
 * @param {string} qs query string without leading ?
 */
function redactQueryStringForLog(qs) {
  if (!qs) return '';
  try {
    const u = new URLSearchParams(qs);
    if (u.has('authToken')) u.set('authToken', '[REDACTED]');
    return u.toString();
  } catch {
    return '[unparseable query]';
  }
}

module.exports = {
  sanitizeForLog,
  stringifyForTerminal,
  redactQueryStringForLog,
  MAX_JSON_CHARS,
};
