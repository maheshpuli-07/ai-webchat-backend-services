/**
 * Allow proxying to CBA Mock Server paths only (no traversal). All Simulator APIs live under these prefixes.
 * @param {string} path absolute path starting with /
 */
function isAllowedCbaProxyPath(path) {
  if (typeof path !== 'string' || path.length < 6 || path.length > 320) return false;
  if (path.includes('..') || path.includes('\\')) return false;
  const normalized = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;
  if (normalized.length < 6) return false;
  return normalized.startsWith('/api/') || normalized.startsWith('/thirdpartyapiservice/');
}

/**
 * @param {string} path
 * @returns {string}
 */
function normalizeCbaProxyPath(path) {
  if (typeof path !== 'string') return '';
  const t = path.trim();
  if (!t) return '';
  return t.startsWith('/') ? t : `/${t}`;
}

module.exports = { isAllowedCbaProxyPath, normalizeCbaProxyPath };
