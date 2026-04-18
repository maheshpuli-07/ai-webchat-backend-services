require('dotenv').config();

function boolEnv(name, defaultValue = true) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  return !['false', '0', 'no', 'off'].includes(String(v).toLowerCase());
}

module.exports = {
  /**
   * Log inbound HTTP (method, path, redacted body) + JSON responses, and all outbound CBA calls.
   * Set LOG_API_TRAFFIC=false to disable (recommended in production if logs are noisy).
   */
  logApiTraffic: boolEnv('LOG_API_TRAFFIC', true),

  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  /**
   * When false, banking routes do not require `Authorization: Bearer`; a fixed registry user is assumed.
   * Set JWT_AUTH_REQUIRED=true in production so the frontend must send a valid JWT.
   */
  jwtAuthRequired: boolEnv('JWT_AUTH_REQUIRED', false),
  /** Registry username used when JWT_AUTH_REQUIRED=false and no Bearer token is sent. */
  anonymousAuthUsername: (process.env.ANONYMOUS_AUTH_USERNAME || 'alice').trim().toLowerCase(),

  /** Google Sign-In: Web client ID(s) from Google Cloud Console (OAuth 2.0 Client). */
  googleOauthClientId: (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim(),
  googleOauthAudiences: (() => {
    const raw = (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_CLIENT_ID || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return raw;
  })(),
  /**
   * Maps verified Google email (lowercase) → existing banking username (see cbaUsers / CBA_USERS_*).
   * Example: GOOGLE_ACCOUNT_LINK_JSON={"you@gmail.com":"alice"}
   */
  googleAccountLink: (() => {
    const raw = (process.env.GOOGLE_ACCOUNT_LINK_JSON || '').trim();
    if (!raw) return new Map();
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return new Map();
      /** @type {Map<string, string>} */
      const m = new Map();
      for (const [email, username] of Object.entries(obj)) {
        const e = String(email || '')
          .trim()
          .toLowerCase();
        const u = String(username || '')
          .trim()
          .toLowerCase();
        if (e && u) m.set(e, u);
      }
      return m;
    } catch {
      return new Map();
    }
  })(),
  /** Dev-only: if set, any verified Google user maps to this username when not in GOOGLE_ACCOUNT_LINK_JSON. */
  googleOauthFallbackUsername: (process.env.GOOGLE_OAUTH_FALLBACK_USERNAME || '').trim().toLowerCase(),
  defaultGatewayEnabled: boolEnv('DEFAULT_GATEWAY_ENABLED', true),
  generalApiKey: process.env.GENERAL_API_KEY || 'internal-general-gateway-key',
  defaultAccountServiceEnabled: boolEnv('DEFAULT_ACCOUNT_SERVICE_ENABLED', true),

  /** CBA Mock Server / production UAPI base (no trailing slash) */
  cbaBaseUrl: (process.env.CBA_BASE_URL || 'http://192.168.3.99:4000').replace(/\/$/, ''),
  /** Simulator authToken (query) + AuthenticationKey (transfer body) — from your CBA environment */
  cbaAuthToken: process.env.CBA_AUTH_TOKEN || '',
  cbaTimeoutMs: Number(process.env.CBA_TIMEOUT_MS) || 30000,
  /** ISO currency label for responses (simulator responses do not always include it) */
  cbaCurrency: process.env.CBA_CURRENCY || 'NGN',
  /**
   * JSON map username (transfer/chat) → destination NUBAN. Matches built-in demo users when unset.
   * Set CBA_PAYEE_ACCOUNT_MAP={} to disable defaults.
   */
  cbaPayeeAccountMapJson:
    process.env.CBA_PAYEE_ACCOUNT_MAP !== undefined
      ? String(process.env.CBA_PAYEE_ACCOUNT_MAP)
      : '{"mahesh":"1100314089","bob":"1100313855","alice":"1100755299","000168":"1100314089"}',

  /**
   * Real CBA test users (optional). If set, built-in alice/mahesh/bob are ignored.
   * Use CBA_USERS_FILE=cba-users.json for easier editing, or CBA_USERS_JSON='[...]' inline.
   */
  cbaUsersJson: process.env.CBA_USERS_JSON || '',
  cbaUsersFile: (process.env.CBA_USERS_FILE || '').trim(),

  /** LLM orchestration (optional). Trim keys — do not paste secrets into code. */
  groqApiKey: (process.env.GROQ_API_KEY || '').trim(),
  openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  /**
   * Which LLM runs first for POST /api/v1/chat tool routing: openai_first | groq_first
   * Default openai_first when you want the chatbot driven by OpenAI.
   */
  chatLlmOrder: String(process.env.CHAT_LLM_ORDER || 'openai_first').toLowerCase(),
  /**
   * When the user message looks casual, optionally rewrite assistant `reply` with OpenAI (same facts).
   * Requires OPENAI_API_KEY. Set CHAT_CONVERSATIONAL_TONE=false to disable.
   */
  chatConversationalTone: boolEnv('CHAT_CONVERSATIONAL_TONE', true),

  /**
   * Redis: conversation store (multi-turn chat) + session context hash (lastIntent / lastTool).
   * Use REDIS_URL or REDIS_HOST (+ optional user/password). Never commit secrets.
   */
  redisEnabled: boolEnv('REDIS_ENABLED', false),
  redisUrl: (process.env.REDIS_URL || '').trim(),
  redisHost: (process.env.REDIS_HOST || '').trim(),
  redisPort: Number(process.env.REDIS_PORT) || 6379,
  /** Redis ACL username; Redis Cloud often uses `default`. Leave empty for local/no-ACL. */
  redisUsername: (process.env.REDIS_USERNAME || '').trim(),
  redisPassword: (process.env.REDIS_PASSWORD || '').trim(),
  /**
   * When using REDIS_HOST (not REDIS_URL): set true if the server expects TLS.
   * ERR_SSL_WRONG_VERSION_NUMBER usually means you used rediss:// or TLS on a plain-text port — use redis:// or REDIS_TLS=false.
   */
  redisTls: boolEnv('REDIS_TLS', false),
  /** Expire conversation list + session hash (seconds). 0 = no TTL. */
  redisConversationTtlSec: Math.max(0, Number(process.env.REDIS_CONVERSATION_TTL_SEC) || 0),
  /** Max dialogue turns stored (each turn = user + assistant list entries). Capped in code at 50. */
  redisConversationMaxTurns: Math.max(1, Number(process.env.REDIS_CONVERSATION_MAX_TURNS) || 20),
  redisMaxUserMsgChars: Math.max(256, Number(process.env.REDIS_MAX_USER_MSG_CHARS) || 8000),
  redisMaxAssistantMsgChars: Math.max(256, Number(process.env.REDIS_MAX_ASSISTANT_MSG_CHARS) || 8000),

  /**
   * RAG: Redis Stack JSON + RediSearch vector index (separate key prefix from conversation store).
   * Requires OPENAI_API_KEY for embeddings + answer synthesis. Uses same Redis as chat sessions.
   */
  ragEnabled: boolEnv('RAG_ENABLED', true),
  ragIndexName: (process.env.RAG_INDEX_NAME || 'banking_kb_idx').trim(),
  /** Keys must start with this prefix (e.g. banking:kb:). */
  ragKeyPrefix: (() => {
    const p = (process.env.RAG_KEY_PREFIX || 'banking:kb:').trim();
    if (!p) return 'banking:kb:';
    return p.endsWith(':') ? p : `${p}:`;
  })(),
  ragEmbeddingModel: (process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small').trim(),
  /** Smaller dims = less Redis RAM (good for free tier). Must match index; re-index if you change. */
  ragEmbeddingDimensions: Math.max(256, Math.min(2000, Number(process.env.RAG_EMBEDDING_DIM) || 512)),
  ragTopK: Math.max(1, Math.min(20, Number(process.env.RAG_TOP_K) || 5)),
  ragChunkMaxChars: Math.max(200, Number(process.env.RAG_CHUNK_MAX_CHARS) || 900),
  ragChunkOverlap: Math.max(0, Number(process.env.RAG_CHUNK_OVERLAP) || 120),
  ragAnswerModel: (process.env.RAG_ANSWER_MODEL || '').trim() || null,
  /** Load src/data/knowledgeSeed.json once when Redis connects (idempotent). */
  ragSeedOnStart: boolEnv('RAG_SEED_ON_START', false),
};
