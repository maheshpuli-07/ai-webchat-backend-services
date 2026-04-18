const cbaBankingRepository = require('../cba/cbaBankingRepository');

/**
 * Client-friendly account view (default / plugin-style integration).
 */
async function getMyAccount(auth) {
  const acc = await cbaBankingRepository.getAccount(auth);
  if (!acc) return null;
  const minor = acc.balanceMinor;
  return {
    balance: minor / 100,
    currency: acc.currency,
    accountNumber: acc.accountNumber,
    summary: `Available balance: ${acc.currency} ${(minor / 100).toFixed(2)}`,
  };
}

module.exports = { getMyAccount };
