const { createClient } = require('redis');
const config = require('../config');

/** @type {import('redis').RedisClientType | null} */
let client = null;
let connected = false;

function buildClientOptions() {
  const url = config.redisUrl;
  if (url) {
    return { url };
  }
  if (!config.redisHost) {
    return null;
  }
  const opts = {
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      ...(config.redisTls ? { tls: true } : {}),
    },
  };
  if (config.redisUsername) {
    opts.username = config.redisUsername;
  }
  if (config.redisPassword) {
    opts.password = config.redisPassword;
  }
  return opts;
}

/**
 * Connect when REDIS_ENABLED=true and URL or host is set.
 * @returns {Promise<boolean>}
 */
async function connectRedis() {
  if (!config.redisEnabled) {
    return false;
  }
  const options = buildClientOptions();
  if (!options) {
    // eslint-disable-next-line no-console
    console.warn(
      'REDIS_ENABLED is true but neither REDIS_URL nor REDIS_HOST is set — Redis disabled for this process.',
    );
    return false;
  }
  client = createClient(options);
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis Client Error', err);
  });
  await client.connect();
  connected = true;
  // eslint-disable-next-line no-console
  console.log('Redis connected (conversation store + session context).');
  return true;
}

async function disconnectRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
  client = null;
  connected = false;
}

/** @returns {import('redis').RedisClientType | null} */
function getRedis() {
  return connected && client ? client : null;
}

function isRedisConnected() {
  return connected;
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedis,
  isRedisConnected,
};
