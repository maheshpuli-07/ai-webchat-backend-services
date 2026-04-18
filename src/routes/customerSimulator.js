const express = require('express');
const config = require('../config');
const cbaClient = require('../cba/cbaClient');

const router = express.Router();

/**
 * Proxy to CBA simulator: GET /api/Customer/GetByCustomerPhoneNumber
 * GET /api/v1/customer/by-phone?phoneNumber=9988770011
 * Uses CBA_AUTH_TOKEN from .env (same as Swagger authToken query param).
 */
router.get('/by-phone', async (req, res) => {
  const raw = req.query.phoneNumber;
  const phoneNumber = Array.isArray(raw) ? raw[0] : raw;
  if (!phoneNumber || !String(phoneNumber).trim()) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'phoneNumber query parameter is required',
    });
  }
  if (!config.cbaAuthToken) {
    return res.status(503).json({
      error: 'configuration',
      message: 'CBA_AUTH_TOKEN is not set in .env — same value as simulator authToken',
    });
  }

  let cbaRes;
  let json;
  try {
    ({ res: cbaRes, json } = await cbaClient.getCustomerByPhoneNumber(
      String(phoneNumber).trim().replace(/\s+/g, ''),
    ));
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
