const config = require('../config');
const { getRedis } = require('../redis/client');

function redisSafeId(s) {
  const x = String(s || 'anon').replace(/[^a-zA-Z0-9_.@-]/g, '_').slice(0, 128);
  return x || 'anon';
}

function convListKey(userKey) {
  return `banking:conv:${redisSafeId(userKey)}`;
}

function sessionHashKey(userKey) {
  return `banking:session:${redisSafeId(userKey)}`;
}

/**
 * Recent turns for LLM multi-turn context (Knowledge & Retrieval → Conversation Store).
 * @param {string} userKey
 * @returns {Promise<Array<{ role: 'user' | 'assistant', content: string }>>}
 */
async function getRecentForLlm(userKey) {
  const r = getRedis();
  if (!r || !config.redisEnabled) {
    return [];
  }
  const maxTurns = Math.max(1, Math.min(50, config.redisConversationMaxTurns || 20));
  const maxItems = maxTurns * 2;
  const key = convListKey(userKey);
  let raw = [];
  try {
    raw = await r.lRange(key, -maxItems, -1);
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw) {
    try {
      const o = JSON.parse(line);
      if (
        o &&
        (o.role === 'user' || o.role === 'assistant') &&
        typeof o.content === 'string' &&
        o.content.length
      ) {
        out.push({ role: o.role, content: o.content });
      }
    } catch {
      /* skip bad segment */
    }
  }
  return out;
}

/**
 * Append this HTTP turn: user line + assistant line; trim list; optional TTL; session hash for Conversation Manager.
 * @param {string} userKey
 * @param {string} userContent
 * @param {string} assistantContent
 * @param {{ intent?: string, tool?: string }} [meta]
 */
async function appendTurn(userKey, userContent, assistantContent, meta = {}) {
  const r = getRedis();
  if (!r || !config.redisEnabled) {
    return;
  }
  const maxTurns = Math.max(1, Math.min(50, config.redisConversationMaxTurns || 20));
  const maxLen = maxTurns * 2;
  const key = convListKey(userKey);
  const u = JSON.stringify({
    role: 'user',
    content: String(userContent || '').slice(0, config.redisMaxUserMsgChars || 8000),
  });
  const a = JSON.stringify({
    role: 'assistant',
    content: String(assistantContent || '').slice(0, config.redisMaxAssistantMsgChars || 8000),
  });
  const ttl = config.redisConversationTtlSec > 0 ? config.redisConversationTtlSec : 0;

  try {
    const multi = r.multi();
    multi.rPush(key, u);
    multi.rPush(key, a);
    multi.lTrim(key, -maxLen, -1);
    if (ttl > 0) {
      multi.expire(key, ttl);
    }
    const intent = meta.intent != null ? String(meta.intent) : '';
    const tool = meta.tool != null ? String(meta.tool) : '';
    if (intent || tool) {
      const sk = sessionHashKey(userKey);
      multi.hSet(sk, {
        lastIntent: intent,
        lastTool: tool,
        updatedAt: String(Date.now()),
      });
      if (ttl > 0) {
        multi.expire(sk, ttl);
      }
    }
    await multi.exec();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[conversationStore] appendTurn failed:', e instanceof Error ? e.message : e);
  }
}

function conversationUserKey(req) {
  const a = req.auth || {};
  return String(a.sub || a.username || 'anonymous').slice(0, 200);
}

module.exports = {
  getRecentForLlm,
  appendTurn,
  conversationUserKey,
  convListKey,
  sessionHashKey,
};
