const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Strict Bearer JWT validation for banking routes.
 * Attaches req.auth = { sub, username, ...payload }
 */
function jwtAuth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      if (!required) return next();
      return res.status(401).json({ error: 'unauthorized', message: 'Missing Bearer token' });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'unauthorized', message: 'Empty token' });
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.auth = payload;
      req.accessToken = token;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
  };
}

module.exports = { jwtAuth };
