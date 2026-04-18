const OpenAI = require('openai');
const config = require('../../config');

/**
 * @param {string[]} inputs non-empty strings
 * @returns {Promise<number[][]>}
 */
async function embedTexts(inputs) {
  const key = config.openaiApiKey;
  if (!key) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  const trimmed = inputs.map((s) => String(s || '').trim()).filter((s) => s.length > 0);
  if (!trimmed.length) {
    return [];
  }
  const openai = new OpenAI({ apiKey: key });
  const dim = config.ragEmbeddingDimensions;
  const res = await openai.embeddings.create({
    model: config.ragEmbeddingModel,
    input: trimmed.length === 1 ? trimmed[0] : trimmed,
    dimensions: dim,
  });
  const out = res.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
  for (const emb of out) {
    if (!Array.isArray(emb) || emb.length !== dim) {
      throw new Error(`Embedding dimension mismatch: expected ${dim}, got ${emb?.length}`);
    }
  }
  return out;
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedQuery(text) {
  const [vec] = await embedTexts([text]);
  return vec || [];
}

module.exports = { embedTexts, embedQuery };
