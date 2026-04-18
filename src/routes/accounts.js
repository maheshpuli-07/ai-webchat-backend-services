const express = require('express');
const config = require('../config');
const cbaClient = require('../cba/cbaClient');
const { getAccountService } = require('../services/accountServiceFactory');

const router = express.Router();

/**
 * GET /api/v1/me/account
 */
router.get('/account', async (req, res) => {
  try {
    const svc = getAccountService();
    const account = await svc.getMyAccount(req.auth);
    if (!account) {
      return res.status(404).json({ error: 'not_found', message: 'No account for user' });
    }
    return res.json({
      gatewayMode: req.gatewayMode,
      accountServiceMode: config.defaultAccountServiceEnabled ? 'default' : 'general',
      account,
    });
  } catch (e) {
    const status = e && typeof e.statusCode === 'number' ? e.statusCode : 502;
    return res.status(status).json({
      error: 'upstream_error',
      message: e instanceof Error ? e.message : 'CBA account service unavailable',
    });
  }
});

/**
 * GET /api/v1/me/cba-accounts-raw
 * Raw CBA JSON from GetAccountsByCustomerId for the JWT user (Simulator parity).
 */
router.get('/cba-accounts-raw', async (req, res) => {
  if (!config.cbaAuthToken) {
    return res.status(503).json({
      error: 'configuration',
      message: 'CBA_AUTH_TOKEN is not set in .env',
    });
  }
  const customerId = req.auth.customerId;
  if (!customerId) {
    return res.status(403).json({ error: 'forbidden', message: 'JWT missing customerId' });
  }
  let cbaRes;
  let json;
  try {
    ({ res: cbaRes, json } = await cbaClient.getAccountsByCustomerId(customerId));
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return res.status(504).json({
      error: aborted ? 'timeout' : 'upstream_error',
      message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
    });
  }
  const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
  if (json === null || json === undefined) {
    return res.status(status).end();
  }
  return res.status(status).json(json);
});

module.exports = router;
