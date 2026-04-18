const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { isRedisConnected } = require('../../redis/client');
const { knowledgeIndexInfo } = require('./redisKbIndex');
const { ingestKnowledgeDocuments } = require('./ingestKnowledgeDocument');

/**
 * When RAG_SEED_ON_START=true, load knowledgeSeed.json if the index has no documents.
 */
async function seedKnowledgeIfNeeded() {
  if (!config.redisEnabled || !isRedisConnected() || !config.ragEnabled || !config.ragSeedOnStart) {
    return { seeded: false, reason: 'skipped' };
  }
  let info;
  try {
    info = await knowledgeIndexInfo();
  } catch {
    return { seeded: false, reason: 'info_failed' };
  }
  if (info.numDocs > 0) {
    // eslint-disable-next-line no-console
    console.log(`[rag] Seed skipped: index already has ${info.numDocs} document(s).`);
    return { seeded: false, reason: 'already_has_docs', numDocs: info.numDocs };
  }

  const seedPath = path.join(__dirname, '../../data/knowledgeSeed.json');
  if (!fs.existsSync(seedPath)) {
    // eslint-disable-next-line no-console
    console.warn('[rag] RAG_SEED_ON_START set but knowledgeSeed.json missing at', seedPath);
    return { seeded: false, reason: 'no_seed_file' };
  }

  let docs;
  try {
    const raw = fs.readFileSync(seedPath, 'utf8');
    docs = JSON.parse(raw);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[rag] Failed to read knowledgeSeed.json:', e instanceof Error ? e.message : e);
    return { seeded: false, reason: 'parse_error' };
  }

  if (!Array.isArray(docs) || !docs.length) {
    return { seeded: false, reason: 'empty_seed' };
  }

  try {
    const results = await ingestKnowledgeDocuments(docs);
    const chunks = results.reduce((n, r) => n + (r.chunksIndexed || 0), 0);
    // eslint-disable-next-line no-console
    console.log(`[rag] Seeded knowledge base: ${results.length} document(s), ${chunks} chunk(s).`);
    return { seeded: true, documents: results.length, chunks };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[rag] Seed ingest failed:', e instanceof Error ? e.message : e);
    return { seeded: false, reason: 'ingest_error', error: e instanceof Error ? e.message : String(e) };
  }
}

module.exports = { seedKnowledgeIfNeeded };
