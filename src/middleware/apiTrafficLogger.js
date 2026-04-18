const crypto = require('crypto');
const config = require('../config');
const { sanitizeForLog, stringifyForTerminal } = require('../utils/apiTrafficLog');

/**
 * Logs incoming HTTP requests and JSON responses (when res.json is used).
 * Chains with other res.json wrappers (e.g. chat conversation store).
 */
function apiTrafficLogger(req, res, next) {
  if (!config.logApiTraffic) {
    return next();
  }

  const pathOnly = req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || req.path || '';
  if (req.method === 'GET' && (pathOnly === '/health' || pathOnly.endsWith('/health'))) {
    return next();
  }

  const rid = crypto.randomBytes(4).toString('hex');
  req._apiLogRid = rid;

  const inLine = {
    tag: 'API_IN',
    rid,
    method: req.method,
    path: req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || req.path,
    query: Object.keys(req.query || {}).length ? sanitizeForLog(req.query) : undefined,
    body:
      req.body && typeof req.body === 'object' && Object.keys(req.body).length
        ? sanitizeForLog(req.body)
        : undefined,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(inLine));

  const start = Date.now();
  const prevJson = res.json.bind(res);
  res.json = function logJsonBody(body) {
    const ms = Date.now() - start;
    const outLine = {
      tag: 'API_OUT',
      rid,
      method: req.method,
      path: req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || req.path,
      status: res.statusCode,
      ms,
      body: body !== undefined ? stringifyForTerminal(body) : undefined,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(outLine));
    return prevJson(body);
  };

  next();
}

module.exports = { apiTrafficLogger };
