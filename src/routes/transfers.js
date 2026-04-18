const express = require('express');
const { initiateTransfer } = require('../services/transferService');

const router = express.Router();

/**
 * POST /api/v1/transfers — sends money via CBA **LocalFundsTransfer** (debit sender, credit payee).
 * Not the same as POST …/Credit (Credit only tops up one account; no sender debit).
 *
 * Body (amount in major units, e.g. 500 = 500.00):
 * - `receiver` (preferred) or `receiverUsername` / `payee` / `to` / `toAccountNumber`:
 *   payee alias from CBA_PAYEE_ACCOUNT_MAP or a 10-digit destination NUBAN (CBA does not use “usernames” here).
 */
router.post('/', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const receiverRaw =
    body.receiver ?? body.receiverUsername ?? body.payee ?? body.to ?? body.toAccountNumber;
  const { amount } = body;
  if (receiverRaw === undefined || receiverRaw === null || String(receiverRaw).trim() === '') {
    return res.status(400).json({
      error: 'invalid_request',
      message:
        'receiver is required (payee alias from CBA_PAYEE_ACCOUNT_MAP or 10-digit NUBAN). Same as legacy receiverUsername.',
    });
  }
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: 'invalid_request', message: 'amount required' });
  }
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ error: 'invalid_request', message: 'amount must be a positive number' });
  }
  const amountMinor = Math.round(n * 100);
  const result = await initiateTransfer({
    auth: req.auth,
    receiverUsername: String(receiverRaw).trim().toLowerCase(),
    amountMinor,
  });
  if (!result.ok) {
    const status =
      result.code === 'insufficient_funds'
        ? 402
        : result.code === 'upstream_error'
          ? 502
          : result.code === 'account_not_found' || result.code === 'receiver_not_found'
            ? 409
            : 400;
    return res.status(status).json({ error: result.code, message: result.message });
  }
  return res.status(201).json({
    gatewayMode: req.gatewayMode,
    transferId: result.transferId,
    amount: result.amountMinor / 100,
    currency: result.currency,
    cbaEndpoint: 'LocalFundsTransfer',
    destinationNuban: result.destinationNuban,
    receiver: result.receiver,
  });
});

module.exports = router;
