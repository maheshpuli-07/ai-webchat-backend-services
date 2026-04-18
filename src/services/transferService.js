const cbaBankingRepository = require('../cba/cbaBankingRepository');

/**
 * @param {{ auth: object, receiverUsername: string, amountMinor: number }} params
 * `receiverUsername` = payee alias or 10-digit NUBAN (see transfers route).
 */
function initiateTransfer(params) {
  return cbaBankingRepository.initiateTransfer(params);
}

module.exports = { initiateTransfer };
