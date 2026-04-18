/**
 * NLU + tool routing: OpenAI and/or Groq (see CHAT_LLM_ORDER) → regex rules.
 */

const { orchestrateWithLlm } = require('./llmOrchestrator');
const { orchestrateLegacy } = require('./ruleBasedOrchestrator');
const {
  normalizeSecureContext,
  redactForLlm,
  mergeSensitiveArgs,
} = require('../utils/secureChatContext');

/**
 * @param {string} text
 * @param {Record<string, string>} [secureRaw] optional structured fields (see parseSecureChatBody)
 */
/**
 * @param {string} text
 * @param {Record<string, string>} [secureRaw]
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} [priorMessages] from Redis conversation store
 */
async function orchestrate(text, secureRaw = {}, priorMessages = []) {
  const ctx = normalizeSecureContext(secureRaw);
  const llmText = redactForLlm(text, ctx);
  let plan = await orchestrateWithLlm(llmText, ctx, text, priorMessages);
  if (plan == null) {
    plan = orchestrateLegacy(text, ctx);
  }
  plan = mergeSensitiveArgs(plan, ctx);
  return plan;
}

module.exports = { orchestrate, orchestrateLegacy };
