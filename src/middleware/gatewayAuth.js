const config = require('../config');

/**
 * Dynamic gateway credential:
 * - Default gateway ON: no extra gateway key (JWT already enforced upstream).
 * - Default gateway OFF: require X-API-Key matching GENERAL_API_KEY (internal / general gateway).
 */
function gatewayCredential(req, res, next) {
  if (config.defaultGatewayEnabled) {
    req.gatewayMode = 'default';
    return next();
  }
  const key = req.headers['x-api-key'];
  if (!key || key !== config.generalApiKey) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'General gateway mode is active; send a valid X-API-Key header',
    });
  }
  req.gatewayMode = 'general';
  return next();
}

module.exports = { gatewayCredential };
