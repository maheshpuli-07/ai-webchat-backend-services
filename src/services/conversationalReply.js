const OpenAI = require('openai');
const config = require('../config');

/**
 * Heuristic: user typed in a casual / conversational way (not a short command in ALL CAPS).
 * @param {string} text
 */
function looksCasualUserMessage(text) {
  const t = String(text || '').trim();
  if (t.length < 2) return false;
  if (/^[A-Z0-9\s\-.,;:()]+$/u.test(t) && t === t.toUpperCase() && t.length < 80) {
    return false;
  }
  let score = 0;
  if (/[a-z]/.test(t)) score += 1;
  const lower = t.toLowerCase();
  if (
    /\b(hey|hi|hello|hiya|yo|sup|thanks|thank you|thx|pls|please|can you|could you|would you|wanna|gonna|kinda)\b/i.test(
      t,
    )
  ) {
    score += 2;
  }
  if (/[!?]/.test(t)) score += 1;
  if (/\b(yeah|yep|nope|ok|okay|lol|haha|hmm|um|uh)\b/.test(lower)) score += 1;
  if (/\b(find|get|show|give|tell|help|need|want|looking)\s+(me|my|us)\b/i.test(t)) score += 1;
  return score >= 2;
}

/**
 * Rewrite assistant `reply` to sound more human when the user sounded casual. Facts must stay identical.
 * @param {string} draft
 * @param {string} userMessage
 * @param {{ username?: string, sub?: string } | undefined} auth
 * @returns {Promise<string>}
 */
async function humanizeAssistantReplyIfCasual(draft, userMessage, auth) {
  const text = String(draft || '').trim();
  if (!text || !config.chatConversationalTone || !config.openaiApiKey) {
    return draft;
  }
  if (!looksCasualUserMessage(userMessage)) {
    return draft;
  }
  if (text.length > 4000) {
    return draft;
  }

  const name =
    (auth && auth.username && String(auth.username).trim()) ||
    (auth && auth.sub && String(auth.sub).trim()) ||
    '';

  const openai = new OpenAI({ apiKey: config.openaiApiKey });
  const model = config.openaiModel || 'gpt-4o-mini';

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.35,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content: `You are a friendly human banking assistant replying in chat. Rewrite the draft so it sounds natural and warm, like texting a customer — short paragraphs, contractions okay, no corporate boilerplate.
When the user greeted you (e.g. hi, hello) or the draft is a welcome with "what I can help with", keep that friendly vibe; you may add a short "great to hear from you" style line if it fits — do not invent products, rates, or policies beyond the draft.
STRICT RULES:
- Keep every number, currency code, account ID, phone, name, date, and factual claim exactly as in the draft.
- Do not add facts, offers, or promises not in the draft.
- If the draft is already conversational, change it only lightly.
- No emojis unless the draft already had one.
- Output ONLY the reply text, no quotes or preamble.`,
        },
        {
          role: 'user',
          content: `Customer login name (optional, use sparingly): ${name || '(unknown)'}
Customer wrote: ${String(userMessage).slice(0, 800)}

Draft reply to rewrite:
${text}`,
        },
      ],
    });
    const out = completion.choices[0]?.message?.content?.trim();
    if (!out || out.length < 3) return draft;
    return out;
  } catch {
    return draft;
  }
}

/**
 * @param {import('express').Response} res
 * @param {object} payload
 * @param {string} userMessage
 * @param {object | undefined} auth
 */
async function sendChatPayload(res, payload, userMessage, auth) {
  const body =
    payload && typeof payload === 'object'
      ? { ...payload }
      : payload;
  if (body && typeof body.reply === 'string') {
    body.reply = await humanizeAssistantReplyIfCasual(body.reply, userMessage, auth);
  }
  return res.json(body);
}

module.exports = {
  looksCasualUserMessage,
  humanizeAssistantReplyIfCasual,
  sendChatPayload,
};
