const express = require('express');
const config = require('../config');
const cbaClient = require('../cba/cbaClient');
const { isAllowedCbaProxyPath, normalizeCbaProxyPath } = require('../utils/cbaPathAllowlist');

const router = express.Router();

/**
 * Thin pass-through to CBA_BASE_URL — same behaviour as Swagger; secrets come from CBA_AUTH_TOKEN on the server.
 * UI supplies paths, query params, and JSON bodies; this handler forwards them.
 */
router.get('/catalog', (_req, res) => {
  return res.json({
    cbaBaseUrl: config.cbaBaseUrl,
    swaggerUi: `${String(config.cbaBaseUrl).replace(/\/$/, '')}/docs/#/Simulator/`,
    get: `${'/api/v1/simulator/cba?path='}<cba-path>&...queryParams`,
    post: 'POST /api/v1/simulator/cba JSON { "path": "<cba-path>", ...body } OR { "path", "query": {}, "body": {} }',
  });
});

function requireCbaToken(res) {
  if (!config.cbaAuthToken) {
    res.status(503).json({ error: 'configuration', message: 'CBA_AUTH_TOKEN is not set in .env' });
    return false;
  }
  return true;
}

/** Express may give array query values; CBA expects one string per key. */
function sanitizeQueryForCba(query) {
  const out = {};
  for (const [k, v] of Object.entries(query || {})) {
    if (k === 'path') continue;
    if (v === undefined || v === null) continue;
    const scalar = Array.isArray(v) ? v[0] : v;
    if (scalar === undefined || scalar === null) continue;
    const s = String(scalar).trim();
    if (s === '' || s === 'undefined' || s === 'null') continue;
    out[k] = s;
  }
  return out;
}

/** Inject simulator auth into third-party JSON when fields are empty (matches Swagger “paste token” flow). */
function applyThirdPartyAuth(path, payload) {
  const t = config.cbaAuthToken;
  if (!t || !payload || typeof payload !== 'object') return;
  const p = String(path);
  if (/LocalFundsTransfer/i.test(p)) {
    if (payload.AuthenticationKey == null || payload.AuthenticationKey === '') payload.AuthenticationKey = t;
  }
  if (/AccountEnquiry/i.test(p)) {
    if (payload.AuthenticationCode == null || payload.AuthenticationCode === '') payload.AuthenticationCode = t;
  }
  if (/\/Debit/i.test(p) || /\/Credit/i.test(p)) {
    if (payload.Token == null || payload.Token === '') payload.Token = t;
  }
}

/**
 * GET /api/v1/simulator/cba?path=/api/...&foo=bar
 * authToken is always set server-side (overrides client).
 */
router.get('/cba', async (req, res) => {
  const path = normalizeCbaProxyPath(
    typeof req.query.path === 'string' ? req.query.path : Array.isArray(req.query.path) ? req.query.path[0] : '',
  );
  if (!path) {
    return res.status(400).json({ error: 'invalid_request', message: 'Query "path" is required' });
  }
  if (!isAllowedCbaProxyPath(path)) {
    return res.status(403).json({ error: 'forbidden', message: 'path must start with /api/ or /thirdpartyapiservice/' });
  }
  if (!requireCbaToken(res)) return;

  const q = sanitizeQueryForCba(req.query);
  q.authToken = config.cbaAuthToken;

  let cbaRes;
  let json;
  try {
    ({ res: cbaRes, json } = await cbaClient.fetchCba(path, { method: 'GET', query: q }));
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return res.status(504).json({
      error: aborted ? 'timeout' : 'upstream_error',
      message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
    });
  }

  const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
  if (json === null || json === undefined) return res.status(status).end();
  return res.status(status).json(json);
});

/**
 * POST /api/v1/simulator/cba
 * { "path": "/api/...", ...jsonBody } — body fields forwarded to CBA; path removed.
 * { "path": "/thirdparty/...", "body": { ... } } — optional nested body.
 * /api/Account/* and /api/Customer/* POSTs: authToken added as query param (Swagger).
 * /thirdpartyapiservice/* POSTs: auth fields in JSON filled from env if empty.
 */
router.post('/cba', async (req, res) => {
  const raw = req.body && typeof req.body === 'object' ? req.body : {};
  const path = normalizeCbaProxyPath(typeof raw.path === 'string' ? raw.path : '');
  if (!path) {
    return res.status(400).json({ error: 'invalid_request', message: 'Body must include string "path"' });
  }
  if (!isAllowedCbaProxyPath(path)) {
    return res.status(403).json({ error: 'forbidden', message: 'path must start with /api/ or /thirdpartyapiservice/' });
  }
  if (!requireCbaToken(res)) return;

  const nestedBody = raw.body != null && typeof raw.body === 'object' ? { ...raw.body } : null;
  const payload = nestedBody ? nestedBody : { ...raw };
  delete payload.path;
  if (Object.prototype.hasOwnProperty.call(payload, 'query')) delete payload.query;
  if (Object.prototype.hasOwnProperty.call(payload, 'body')) delete payload.body;

  let cbaRes;
  let json;
  try {
    if (path.startsWith('/thirdpartyapiservice/')) {
      applyThirdPartyAuth(path, payload);
      ({ res: cbaRes, json } = await cbaClient.fetchCba(path, { method: 'POST', body: payload }));
    } else {
      ({ res: cbaRes, json } = await cbaClient.fetchCba(path, {
        method: 'POST',
        query: { authToken: config.cbaAuthToken },
        body: payload,
      }));
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return res.status(504).json({
      error: aborted ? 'timeout' : 'upstream_error',
      message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
    });
  }

  const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
  if (json === null || json === undefined) return res.status(status).end();
  return res.status(status).json(json);
});

module.exports = router;
