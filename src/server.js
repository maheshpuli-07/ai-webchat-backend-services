const express = require('express');
const cors = require('cors');
const config = require('./config');
const { jwtAuth } = require('./middleware/jwtAuth');
const { gatewayCredential } = require('./middleware/gatewayAuth');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const accountsRouter = require('./routes/accounts');
const transfersRouter = require('./routes/transfers');
const customerSimulatorRouter = require('./routes/customerSimulator');
const onboardingRouter = require('./routes/onboarding');
const simulatorProxyRouter = require('./routes/simulatorProxy');
const knowledgeRouter = require('./routes/knowledge');
const { registrySource } = require('./data/cbaUserRegistry');
const { connectRedis, disconnectRedis, isRedisConnected } = require('./redis/client');
const { getKnowledgeIndexStatus, ensureBankingKnowledgeIndex } = require('./services/rag/redisKbIndex');
const { seedKnowledgeIfNeeded } = require('./services/rag/seedKnowledgeIfNeeded');

const { apiTrafficLogger } = require('./middleware/apiTrafficLogger');

const app = express();

function isGirmitiHttpsOrigin(origin) {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return h === 'girmiti.com' || h.endsWith('.girmiti.com');
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.corsExtraOrigins.includes(origin)) return callback(null, true);
      if (isGirmitiHttpsOrigin(origin)) return callback(null, true);
      callback(null, false);
    },
  })
);
app.use(express.json());
app.use(apiTrafficLogger);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    cbaBaseUrl: config.cbaBaseUrl,
    cbaAuthConfigured: Boolean(config.cbaAuthToken),
    authUserRegistry: registrySource,
    googleOauthConfigured: Boolean(config.googleOauthAudiences?.length),
    defaultGatewayEnabled: config.defaultGatewayEnabled,
    defaultAccountServiceEnabled: config.defaultAccountServiceEnabled,
    chatLlmOrder: config.chatLlmOrder,
    openaiConfigured: Boolean(config.openaiApiKey),
    groqConfigured: Boolean(config.groqApiKey),
    logApiTraffic: config.logApiTraffic,
    redisEnabled: config.redisEnabled,
    redisConnected: isRedisConnected(),
    ragEnabled: config.ragEnabled,
    ...getKnowledgeIndexStatus(),
  });
});

app.use('/auth', authRouter);

const banking = express.Router();
banking.use(jwtAuth(true));
banking.use(gatewayCredential);
banking.use('/chat', chatRouter);
banking.use('/me', accountsRouter);
banking.use('/transfers', transfersRouter);
banking.use('/customer', customerSimulatorRouter);
banking.use('/onboarding', onboardingRouter);
banking.use('/simulator', simulatorProxyRouter);
banking.use('/knowledge', knowledgeRouter);

app.use('/api/v1', banking);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const statusRaw = err.statusCode ?? err.status;
  const status =
    typeof statusRaw === 'number' && statusRaw >= 400 && statusRaw < 600 ? statusRaw : 500;
  if (status === 500) {
    return res.status(500).json({ error: 'internal_error', message: 'Unexpected server error' });
  }
  const error =
    err.type === 'entity.parse.failed' || err instanceof SyntaxError ? 'invalid_json' : 'bad_request';
  return res.status(status).json({
    error,
    message: err.message || 'Bad request',
  });
});

if (!config.cbaAuthToken) {
  // eslint-disable-next-line no-console
  console.warn('CBA_AUTH_TOKEN is empty — set it in .env (simulator authToken / AuthenticationKey).');
}

async function start() {
  try {
    await connectRedis();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Redis connection failed — continuing without Redis:', e instanceof Error ? e.message : e);
  }

  if (isRedisConnected() && config.ragEnabled) {
    try {
      await ensureBankingKnowledgeIndex();
      await seedKnowledgeIfNeeded();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[rag] Startup index/seed:', e instanceof Error ? e.message : e);
    }
  }

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Banking API listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(
      `Gateway: ${config.defaultGatewayEnabled ? 'default (no X-API-Key)' : 'general (X-API-Key required)'}`,
    );
    // eslint-disable-next-line no-console
    console.log(`CBA UAPI: ${config.cbaBaseUrl}`);
    let payeeCount = 0;
    try {
      const o = JSON.parse(config.cbaPayeeAccountMapJson || '{}');
      if (o && typeof o === 'object') payeeCount = Object.keys(o).length;
    } catch {
      payeeCount = 0;
    }
    // eslint-disable-next-line no-console
    console.log(`Transfer payee map: ${payeeCount} username(s) → NUBAN`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(
        `Port ${config.port} is already in use. Stop the other process (e.g. netstat -ano | findstr :${config.port}) or set PORT in .env.`,
      );
      process.exit(1);
      return;
    }
    throw err;
  });

  const shutdown = async () => {
    await disconnectRedis();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
