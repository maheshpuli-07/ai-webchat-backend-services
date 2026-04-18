const express = require('express');
const config = require('../config');
const { ingestKnowledgeDocument, ingestKnowledgeDocuments } = require('../services/rag/ingestKnowledgeDocument');
const { knowledgeIndexInfo, ensureBankingKnowledgeIndex } = require('../services/rag/redisKbIndex');

const router = express.Router();

/**
 * GET /api/v1/knowledge/status
 */
router.get('/status', async (_req, res) => {
  if (!config.ragEnabled) {
    return res.json({ ragEnabled: false, message: 'RAG is disabled (RAG_ENABLED=false).' });
  }
  await ensureBankingKnowledgeIndex();
  const info = await knowledgeIndexInfo();
  return res.json({
    ragEnabled: true,
    redisConnected: info.connected,
    indexExists: info.indexExists,
    numDocs: info.numDocs,
    vectorIndexSzMb: info.vectorIndexSzMb,
    embeddingModel: config.ragEmbeddingModel,
    embeddingDimensions: config.ragEmbeddingDimensions,
    keyPrefix: config.ragKeyPrefix,
    error: info.error || undefined,
  });
});

/**
 * POST /api/v1/knowledge/ingest
 * Body: { title, category, content } or { documents: [{ title, category, content }] }
 */
router.post('/ingest', async (req, res) => {
  if (!config.ragEnabled) {
    return res.status(503).json({ error: 'rag_disabled', message: 'RAG_ENABLED is false.' });
  }
  if (!config.openaiApiKey) {
    return res.status(503).json({
      error: 'no_openai',
      message: 'OPENAI_API_KEY is required to embed and store documents.',
    });
  }

  const body = req.body || {};
  const batch = Array.isArray(body.documents) ? body.documents : null;
  try {
    if (batch) {
      const results = await ingestKnowledgeDocuments(batch);
      return res.json({
        ok: true,
        count: results.length,
        results,
      });
    }
    const title = body.title;
    const category = body.category;
    const content = body.content;
    if (!content || !String(content).trim()) {
      return res.status(400).json({
        error: 'invalid_body',
        message: 'Provide { title?, category?, content } or { documents: [...] }.',
      });
    }
    const one = await ingestKnowledgeDocument({ title, category, content });
    return res.json({ ok: true, ...one });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({
      error: 'ingest_failed',
      message: msg,
      hint: 'Ensure Redis Stack (JSON + RediSearch vectors) is enabled on your Redis Cloud database.',
    });
  }
});

module.exports = router;
