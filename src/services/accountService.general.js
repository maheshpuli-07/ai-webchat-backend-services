const cbaBankingRepository = require('../cba/cbaBankingRepository');

/**
 * Same user-facing fields as default mode so the UI and transfers stay consistent.
 * Extra fields remain for integrators who enable "general" account service.
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
    accountId: `acc_${acc.userId}`,
    userId: acc.userId,
    ledger: { balanceMinor: minor, currency: acc.currency },
    nuban: acc.accountNumber,
    metadata: { schemaVersion: 1, source: 'cba-simulator' },
  };
}

module.exports = { getMyAccount };
