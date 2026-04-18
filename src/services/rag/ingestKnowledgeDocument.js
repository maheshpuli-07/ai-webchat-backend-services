const crypto = require('crypto');
const config = require('../../config');
const { chunkText } = require('./chunkText');
const { embedTexts } = require('./embeddings');
const { ensureBankingKnowledgeIndex, indexJsonChunk } = require('./redisKbIndex');

const EMBED_BATCH = 24;

/**
 * @param {{ title?: string, category?: string, content: string }} doc
 * @returns {Promise<{ docId: string, chunksIndexed: number, redisKeys: string[] }>}
 */
async function ingestKnowledgeDocument(doc) {
  const title = String(doc.title || 'Untitled').slice(0, 500);
  const category = String(doc.category || 'faq').toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'faq';
  const content = String(doc.content || '');
  const ok = await ensureBankingKnowledgeIndex();
  if (!ok) {
    throw new Error(
      'Knowledge index is not available. Use Redis Stack (JSON + Search) and ensure FT.CREATE succeeds.',
    );
  }
  const docId = crypto.randomUUID();
  const chunks = chunkText(content, config.ragChunkMaxChars, config.ragChunkOverlap);
  if (!chunks.length) {
    return { docId, chunksIndexed: 0, redisKeys: [] };
  }

  const embeddings = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const slice = chunks.slice(i, i + EMBED_BATCH);
    const part = await embedTexts(slice);
    embeddings.push(...part);
  }
  if (embeddings.length !== chunks.length) {
    throw new Error('Embedding batch count mismatch');
  }

  const redisKeys = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const key = await indexJsonChunk({
      title,
      category,
      docId,
      chunkIndex: i,
      content: chunks[i],
      embedding: embeddings[i],
    });
    redisKeys.push(key);
  }
  return { docId, chunksIndexed: chunks.length, redisKeys };
}

/**
 * @param {Array<{ title?: string, category?: string, content: string }>} docs
 */
async function ingestKnowledgeDocuments(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const results = [];
  for (const d of list) {
    if (!d || !String(d.content || '').trim()) continue;
    results.push(await ingestKnowledgeDocument(d));
  }
  return results;
}

module.exports = { ingestKnowledgeDocument, ingestKnowledgeDocuments };
