const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const userRegistry = require('../data/cbaUserRegistry');

const router = express.Router();
const googleClient = new OAuth2Client();

/**
 * Demo token endpoint (OAuth2 password grant style — replace with real IdP).
 * JWT includes CBA customerId + accountNumber (NUBAN) for simulator calls.
 * POST /auth/token
 */
router.post('/token', (req, res) => {
  try {
    const { username, password, grant_type: grantType } = req.body || {};
    if (grantType && grantType !== 'password') {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }
    if (!username || !password) {
      return res.status(400).json({ error: 'invalid_request', message: 'username and password required' });
    }
    const user = userRegistry.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'invalid_grant', message: 'Invalid credentials' });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      name: user.displayName,
      customerId: user.customerId,
      accountNumber: user.accountNumber,
    };
    let access_token;
    try {
      access_token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    } catch (signErr) {
      // eslint-disable-next-line no-console
      console.error('jwt.sign failed:', signErr);
      return res.status(500).json({
        error: 'token_issuance_failed',
        message: 'Unable to issue token — check JWT_SECRET and JWT_EXPIRES_IN in .env',
      });
    }
    return res.json({
      access_token,
      token_type: 'Bearer',
      expires_in: config.jwtExpiresIn,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ error: 'internal_error', message: 'Unexpected server error' });
  }
});

/**
 * Google Sign-In (OAuth 2.0): verify ID token from GIS, map email → banking user, issue same JWT as /auth/token.
 * POST /auth/google  body: { "id_token": "<credential JWT>" }
 */
router.post('/google', async (req, res) => {
  try {
    const idToken = req.body?.id_token || req.body?.credential;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'invalid_request', message: 'id_token (or credential) required' });
    }

    const audiences = config.googleOauthAudiences;
    if (!audiences.length) {
      return res.status(503).json({
        error: 'google_oauth_disabled',
        message: 'Set GOOGLE_OAUTH_CLIENT_ID on the server to match your Web client ID.',
      });
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken, audience: audiences });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[auth/google] verifyIdToken failed:', err instanceof Error ? err.message : err);
      return res.status(401).json({ error: 'invalid_grant', message: 'Invalid Google token' });
    }

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: 'invalid_grant', message: 'Google token has no email' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'invalid_grant', message: 'Google email is not verified' });
    }

    const email = String(payload.email).trim().toLowerCase();
    let username = config.googleAccountLink.get(email);
    if (!username && config.googleOauthFallbackUsername) {
      username = config.googleOauthFallbackUsername;
    }
    if (!username) {
      return res.status(403).json({
        error: 'google_account_not_linked',
        message:
          'This Google account is not linked to a banking user. Add your email to GOOGLE_ACCOUNT_LINK_JSON on the API (e.g. {"you@gmail.com":"alice"}), or set GOOGLE_OAUTH_FALLBACK_USERNAME for local dev only.',
      });
    }

    const user = userRegistry.getUserByUsername(username);
    if (!user) {
      return res.status(403).json({
        error: 'invalid_linked_user',
        message: 'Linked username was not found in the user registry.',
      });
    }

    const jwtPayload = {
      sub: user.id,
      username: user.username,
      name: user.displayName || String(payload.name || user.username || ''),
      customerId: user.customerId,
      accountNumber: user.accountNumber,
    };

    let access_token;
    try {
      access_token = jwt.sign(jwtPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    } catch (signErr) {
      // eslint-disable-next-line no-console
      console.error('jwt.sign failed:', signErr);
      return res.status(500).json({
        error: 'token_issuance_failed',
        message: 'Unable to issue token — check JWT_SECRET and JWT_EXPIRES_IN in .env',
      });
    }

    return res.json({
      access_token,
      token_type: 'Bearer',
      expires_in: config.jwtExpiresIn,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ error: 'internal_error', message: 'Unexpected server error' });
  }
});

module.exports = router;
