const crypto = require('crypto');
const { SchemaFieldTypes, VectorAlgorithms } = require('redis');
const config = require('../../config');
const { getRedis } = require('../../redis/client');

let indexEnsureAttempted = false;
let indexReady = false;
let indexError = '';

function floatVectorToBuffer(vec) {
  const f32 = Float32Array.from(vec);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

function isIndexMissingError(err) {
  const m = String(err && err.message ? err.message : err);
  return /unknown index|no such index|Index not found/i.test(m);
}

function isIndexExistsError(err) {
  const m = String(err && err.message ? err.message : err);
  return /Index already exists/i.test(m);
}

/**
 * @returns {{ ragIndexReady: boolean, ragIndexError: string }}
 */
function getKnowledgeIndexStatus() {
  return { ragIndexReady: indexReady, ragIndexError: indexError };
}

async function ensureBankingKnowledgeIndex() {
  const r = getRedis();
  if (!r || !config.redisEnabled || !config.ragEnabled) {
    indexReady = false;
    indexError = !config.ragEnabled ? 'RAG_DISABLED' : 'REDIS_UNAVAILABLE';
    return false;
  }
  if (indexReady) {
    return true;
  }
  if (indexEnsureAttempted && indexError && indexError !== 'REDIS_UNAVAILABLE') {
    return false;
  }
  indexEnsureAttempted = true;
  indexError = '';

  try {
    await r.ft.info(config.ragIndexName);
    indexReady = true;
    return true;
  } catch (e) {
    if (!isIndexMissingError(e)) {
      indexError = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.warn('[rag] FT.INFO failed:', indexError);
      return false;
    }
  }

  const dim = config.ragEmbeddingDimensions;
  const prefix = config.ragKeyPrefix;

  try {
    await r.ft.create(
      config.ragIndexName,
      {
        '$.title': { type: SchemaFieldTypes.TEXT, AS: 'title' },
        '$.category': { type: SchemaFieldTypes.TAG, AS: 'category' },
        '$.docId': { type: SchemaFieldTypes.TAG, AS: 'docId' },
        '$.content': { type: SchemaFieldTypes.TEXT, AS: 'content' },
        '$.embedding': {
          type: SchemaFieldTypes.VECTOR,
          AS: 'embedding',
          ALGORITHM: VectorAlgorithms.HNSW,
          TYPE: 'FLOAT32',
          DIM: dim,
          DISTANCE_METRIC: 'COSINE',
          INITIAL_CAP: 400,
          M: 8,
          EF_CONSTRUCTION: 100,
        },
      },
      {
        ON: 'JSON',
        PREFIX: prefix,
      },
    );
    indexReady = true;
    // eslint-disable-next-line no-console
    console.log(`[rag] Created RediSearch index "${config.ragIndexName}" (prefix ${prefix}, dim ${dim}).`);
    return true;
  } catch (e) {
    if (isIndexExistsError(e)) {
      indexReady = true;
      return true;
    }
    indexError = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[rag] FT.CREATE failed (need Redis Stack + Search + JSON):', indexError);
    indexReady = false;
    return false;
  }
}

/**
 * @param {object} doc
 * @param {string} doc.title
 * @param {string} doc.category faq | policy | product
 * @param {string} doc.content
 * @param {string} doc.docId logical document id (shared across chunks)
 * @param {number} doc.chunkIndex
 * @param {number[]} doc.embedding
 */
async function indexJsonChunk(doc) {
  const r = getRedis();
  if (!r) {
    throw new Error('Redis not connected');
  }
  const id = `${config.ragKeyPrefix}chunk:${crypto.randomUUID()}`;
  const payload = {
    title: String(doc.title || '').slice(0, 500),
    category: String(doc.category || 'faq').replace(/\s+/g, '_').slice(0, 64),
    docId: String(doc.docId || '').slice(0, 64),
    chunkIndex: Number(doc.chunkIndex) || 0,
    content: String(doc.content || '').slice(0, 12000),
    embedding: doc.embedding,
  };
  await r.json.set(id, '$', payload);
  return id;
}

/**
 * @param {number[]} queryEmbedding
 * @param {number} topK
 * @returns {Promise<Array<{ id: string, score: number, title: string, category: string, content: string, docId: string }>>}
 */
async function searchKnowledgeVectors(queryEmbedding, topK) {
  const r = getRedis();
  if (!r || !queryEmbedding.length) {
    return [];
  }
  const ok = await ensureBankingKnowledgeIndex();
  if (!ok) {
    return [];
  }
  const k = Math.max(1, Math.min(20, topK || config.ragTopK));
  const blob = floatVectorToBuffer(queryEmbedding);
  const query = `*=>[KNN ${k} @embedding $vec AS dist]`;

  try {
    const res = await r.ft.search(config.ragIndexName, query, {
      DIALECT: 2,
      PARAMS: { vec: blob },
      RETURN: ['title', 'category', 'content', 'docId', 'dist'],
      SORTBY: { BY: 'dist', DIRECTION: 'ASC' },
      LIMIT: { from: 0, size: k },
    });

    const hits = [];
    for (const row of res.documents || []) {
      const v = row.value || {};
      const dist = Number(v.dist);
      const score = Number.isFinite(dist) ? dist : 0;
      hits.push({
        id: row.id,
        score,
        title: String(v.title || ''),
        category: String(v.category || ''),
        content: String(v.content || ''),
        docId: String(v.docId || ''),
      });
    }
    return hits;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[rag] vector search failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

async function knowledgeIndexInfo() {
  const r = getRedis();
  if (!r) {
    return { connected: false, indexExists: false, numDocs: 0, error: 'REDIS_UNAVAILABLE' };
  }
  try {
    const info = await r.ft.info(config.ragIndexName);
    return {
      connected: true,
      indexExists: true,
      numDocs: Number(info.numDocs) || 0,
      vectorIndexSzMb: info.vectorIndexSzMb,
      error: '',
    };
  } catch (e) {
    return {
      connected: true,
      indexExists: false,
      numDocs: 0,
      error: isIndexMissingError(e) ? 'INDEX_MISSING' : e instanceof Error ? e.message : String(e),
    };
  }
}

function resetIndexStateForTests() {
  indexEnsureAttempted = false;
  indexReady = false;
  indexError = '';
}

module.exports = {
  ensureBankingKnowledgeIndex,
  indexJsonChunk,
  searchKnowledgeVectors,
  knowledgeIndexInfo,
  getKnowledgeIndexStatus,
  resetIndexStateForTests,
};
