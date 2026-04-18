const jwt = require('jsonwebtoken');
const config = require('../config');
const userRegistry = require('../data/cbaUserRegistry');

function authPayloadFromUser(user) {
  return {
    sub: user.id,
    username: user.username,
    name: user.displayName,
    customerId: user.customerId,
    accountNumber: user.accountNumber,
  };
}

/**
 * Banking JWT: verifies `Authorization: Bearer` when present.
 * If JWT_AUTH_REQUIRED is false and there is no Bearer (or empty), uses ANONYMOUS_AUTH_USERNAME from the registry.
 * If a Bearer token is present but invalid, always 401.
 */
function jwtAuth() {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      if (!token) {
        return res.status(401).json({ error: 'unauthorized', message: 'Empty token' });
      }
      try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.auth = payload;
        req.accessToken = token;
        return next();
      } catch {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
      }
    }

    if (config.jwtAuthRequired) {
      return res.status(401).json({ error: 'unauthorized', message: 'Missing Bearer token' });
    }

    const user = userRegistry.getUserByUsername(config.anonymousAuthUsername);
    if (!user) {
      return res.status(503).json({
        error: 'configuration',
        message: `Anonymous auth user not found in registry: ${config.anonymousAuthUsername}`,
      });
    }
    req.auth = authPayloadFromUser(user);
    req.accessToken = null;
    return next();
  };
}

module.exports = { jwtAuth };
