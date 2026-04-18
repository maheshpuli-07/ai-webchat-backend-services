const config = require('../config');
const defaultSvc = require('./accountService.default');
const generalSvc = require('./accountService.general');

function getAccountService() {
  return config.defaultAccountServiceEnabled ? defaultSvc : generalSvc;
}

module.exports = { getAccountService };
