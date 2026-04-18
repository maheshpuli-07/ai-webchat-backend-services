const express = require('express');
const config = require('../config');
const cbaClient = require('../cba/cbaClient');

const router = express.Router();

const REQUIRED_FIELDS = [
  'TransactionTrackingRef',
  'ProductCode',
  'PhoneNo',
  'BVN',
  'LastName',
  'OtherNames',
  'Email',
  'Gender',
  'DOB',
  'Address',
  'NationalID',
  'AccountTier',
];

/**
 * Proxy: POST /api/v1/onboarding/create-customer-and-account
 * Body matches CBA POST /api/Account/CreateCustomerAndAccount (authToken from CBA_AUTH_TOKEN).
 */
router.post('/create-customer-and-account', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const missing = REQUIRED_FIELDS.filter((k) => {
    const v = body[k];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (missing.length) {
    return res.status(400).json({
      error: 'invalid_request',
      message: `Missing or empty fields: ${missing.join(', ')}`,
    });
  }

  if (!config.cbaAuthToken) {
    return res.status(503).json({
      error: 'configuration',
      message: 'CBA_AUTH_TOKEN is not set in .env — same value as simulator authToken',
    });
  }

  const payload = {};
  for (const k of REQUIRED_FIELDS) {
    payload[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
  }

  let cbaRes;
  let json;
  try {
    ({ res: cbaRes, json } = await cbaClient.createCustomerAndAccount(payload));
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return res.status(504).json({
      error: aborted ? 'timeout' : 'upstream_error',
      message: aborted ? 'CBA simulator timeout' : e instanceof Error ? e.message : 'Request failed',
    });
  }

  const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
  if (json === null || json === undefined) {
    return res.status(status).end();
  }
  return res.status(status).json(json);
});

module.exports = router;
