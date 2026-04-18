const OpenAI = require('openai');
const config = require('../../config');
const { embedQuery } = require('./embeddings');
const {
  ensureBankingKnowledgeIndex,
  searchKnowledgeVectors,
  getKnowledgeIndexStatus,
} = require('./redisKbIndex');

const RAG_SYSTEM = `You are a helpful banking assistant chatting with a customer. Answer ONLY using the provided context excerpts (FAQ, product information, policies).
Write like a knowledgeable human: warm, clear, conversational — not stiff or robotic. Short paragraphs or a few sentences unless the user clearly wants detail.
If the answer is not contained in the context, say honestly you do not have that in the knowledge base and suggest support or official disclosures — still in a natural tone.
Do not invent rates, fees, legal advice, or account-specific data.`;

/**
 * @param {string} userQuestion
 * @returns {Promise<{ reply: string, sources: object[], mode: string, indexReady: boolean }>}
 */
async function answerKnowledgeQuestion(userQuestion) {
  const q = String(userQuestion || '').trim();
  const status = getKnowledgeIndexStatus();
  if (!config.ragEnabled) {
    return {
      reply: 'Knowledge search is disabled (RAG_ENABLED=false).',
      sources: [],
      mode: 'disabled',
      indexReady: false,
    };
  }
  if (!config.openaiApiKey) {
    return {
      reply: 'OPENAI_API_KEY is required for embeddings and answers.',
      sources: [],
      mode: 'no_openai',
      indexReady: status.ragIndexReady,
    };
  }

  const idxOk = await ensureBankingKnowledgeIndex();
  if (!idxOk) {
    return {
      reply:
        'The knowledge index is not available. Confirm Redis Stack (RediSearch + RedisJSON) on your instance, set REDIS_* and restart, then POST documents to /api/v1/knowledge/ingest.',
      sources: [],
      mode: 'index_unavailable',
      indexReady: false,
    };
  }

  let queryVec = [];
  try {
    queryVec = await embedQuery(q);
  } catch (e) {
    return {
      reply: `Could not embed your question: ${e instanceof Error ? e.message : String(e)}`,
      sources: [],
      mode: 'embed_error',
      indexReady: true,
    };
  }

  const hits = await searchKnowledgeVectors(queryVec, config.ragTopK);
  if (!hits.length) {
    return {
      reply:
        'No matching passages were found in the knowledge base. Upload FAQ or policy documents via POST /api/v1/knowledge/ingest (or enable RAG_SEED_ON_START with knowledgeSeed.json).',
      sources: [],
      mode: 'no_hits',
      indexReady: true,
    };
  }

  const sources = hits.map((h, i) => ({
    rank: i + 1,
    title: h.title,
    category: h.category,
    docId: h.docId,
    score: h.score,
    excerpt: h.content.slice(0, 320),
  }));

  const contextBlocks = hits.map(
    (h, i) =>
      `--- Source ${i + 1} (${h.category}) ${h.title} ---\n${h.content}`,
  );
  const context = contextBlocks.join('\n\n');

  const model = config.ragAnswerModel || config.openaiModel;
  const openai = new OpenAI({ apiKey: config.openaiApiKey });
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: RAG_SYSTEM },
        {
          role: 'user',
          content: `Context:\n${context}\n\nUser question: ${q}`,
        },
      ],
    });
    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      'Could not generate an answer.';
    return { reply, sources, mode: 'rag', indexReady: true };
  } catch (e) {
    const fallback = hits.map((h) => `• ${h.title}: ${h.content.slice(0, 400)}…`).join('\n');
    return {
      reply: `LLM answer failed (${e instanceof Error ? e.message : String(e)}). Top match excerpts:\n${fallback}`,
      sources,
      mode: 'llm_error',
      indexReady: true,
    };
  }
}

module.exports = { answerKnowledgeQuestion };
