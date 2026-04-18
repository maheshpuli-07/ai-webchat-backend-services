const fs = require('fs');
const path = require('path');
const config = require('../config');
const builtin = require('./cbaUsers');

/**
 * When CBA_USERS_JSON or CBA_USERS_FILE is set, only those users can log in (real CBA simulator data).
 * Otherwise falls back to built-in demo users in cbaUsers.js.
 */

function parseUsersPayload(raw) {
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.users;
  if (!Array.isArray(list)) return null;
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const u of list) {
    if (!u || typeof u !== 'object') continue;
    const username = String(u.username || '')
      .trim()
      .toLowerCase();
    const password = u.password != null ? String(u.password) : '';
    const customerId = u.customerId != null ? String(u.customerId).trim() : '';
    const accountNumber = u.accountNumber != null ? String(u.accountNumber).trim() : '';
    if (!username || !password || !customerId || !accountNumber) continue;
    map.set(username, {
      id: u.id != null ? String(u.id) : `usr_${username}`,
      username,
      displayName: u.displayName != null ? String(u.displayName) : username,
      password,
      customerId,
      accountNumber,
    });
  }
  return map.size > 0 ? map : null;
}

function loadFromEnv() {
  let raw = (config.cbaUsersJson || '').trim();
  let source = 'CBA_USERS_JSON';

  if (!raw && config.cbaUsersFile) {
    const p = path.isAbsolute(config.cbaUsersFile)
      ? config.cbaUsersFile
      : path.join(process.cwd(), config.cbaUsersFile);
    if (!fs.existsSync(p)) {
      // eslint-disable-next-line no-console
      console.warn(`CBA_USERS_FILE not found: ${p} — using built-in demo users.`);
      return { map: null, source: 'builtin' };
    }
    raw = fs.readFileSync(p, 'utf8');
    source = 'CBA_USERS_FILE';
  }

  if (!raw) {
    return { map: null, source: 'builtin' };
  }

  try {
    const map = parseUsersPayload(raw);
    if (!map) {
      // eslint-disable-next-line no-console
      console.warn(`${source} parsed but no valid users — using built-in demo users.`);
      return { map: null, source: 'builtin' };
    }
    return { map, source };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`${source} invalid JSON — using built-in demo users.`, e instanceof Error ? e.message : e);
    return { map: null, source: 'builtin' };
  }
}

const loaded = loadFromEnv();
const usersByUsername = loaded.map || builtin.usersByUsername;
const registrySource = loaded.map ? loaded.source : 'builtin';

function getUserByUsername(username) {
  if (!username) return null;
  return usersByUsername.get(String(username).toLowerCase()) || null;
}

module.exports = { getUserByUsername, registrySource };
