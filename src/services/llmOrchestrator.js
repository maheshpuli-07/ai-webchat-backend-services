const OpenAI = require('openai');
const config = require('../config');
const { orchestrateLegacy } = require('./ruleBasedOrchestrator');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'transfer_money',
      description:
        'User wants to send, pay, or transfer money. Recipient is either a payee alias (one word, letters) OR a 10-digit destination account number (NUBAN) to credit. Amount in main currency units.',
      parameters: {
        type: 'object',
        properties: {
          receiver_username: {
            type: 'string',
            description: 'Payee alias (e.g. mahesh) or full 10-digit destination account number',
          },
          amount_major: {
            type: 'number',
            description: 'Amount in major units (e.g. 500 for five hundred)',
          },
        },
        required: ['receiver_username', 'amount_major'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_balance',
      description:
        'User wants their own account balance, available balance, "how much do I have", or to check their account (not someone else\'s).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_accounts',
      description:
        'User wants to see all their bank accounts, account numbers, or CBA accounts linked to their profile.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_customer_by_phone',
      description:
        'User wants to find, look up, or get customer details using a phone number (mobile).',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description:
              'Digits only or with spaces/dashes. Omit or leave empty if the client sent phoneNumber in secure JSON fields (server merges).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_account_by_tracking_ref',
      description:
        'User wants account details from a transaction tracking reference (e.g. TXN-… from onboarding). Same as simulator GET GetAccountByTransactionTrackingRef.',
      parameters: {
        type: 'object',
        properties: {
          transaction_tracking_ref: {
            type: 'string',
            description:
              'Tracking ref as in CBA. Omit if client sent transactionTrackingRef in secure JSON fields.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_transactions',
      description:
        'User wants their own transaction history / statement for the logged-in account (no NUBAN in message). Same as GET GetTransactions with JWT account.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_account_transactions',
      description:
        'User wants transaction history for a specific 10-digit NUBAN they named. Same as GET GetTransactions.',
      parameters: {
        type: 'object',
        properties: {
          account_number: {
            type: 'string',
            description: '10-digit NUBAN. Omit if client sent accountNumber in secure JSON fields.',
          },
          from_date: { type: 'string', description: 'Optional start date YYYY-MM-DD' },
          to_date: { type: 'string', description: 'Optional end date YYYY-MM-DD' },
          number_of_items: { type: 'number', description: 'Optional max rows (e.g. 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_accounts_for_customer_id',
      description:
        'User wants accounts for a specific customer ID (e.g. 000166), not the logged-in user. Same as GET GetAccountsByCustomerId.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: {
            type: 'string',
            description: 'Numeric customer id. Omit if client sent customerId in secure JSON fields.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'account_enquiry_by_nuban',
      description:
        'User wants account details / account enquiry for a specific 10-digit NUBAN (POST AccountEnquiry). Not transaction history; not tracking ref lookup.',
      parameters: {
        type: 'object',
        properties: {
          account_number: {
            type: 'string',
            description: '10-digit NUBAN. Omit if client sent accountNumber in secure JSON fields.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'banking_knowledge_question',
      description:
        'User asks for information only: definitions, EMI, loans, policies, FAQs — not moving money.',
      parameters: {
        type: 'object',
        properties: {
          topic_summary: { type: 'string', description: 'Short restatement of the topic' },
        },
      },
    },
  },
];

const SYSTEM = `You are a banking assistant API. Pick at most ONE tool for the user's latest message.
If the user only says hi, hello, thanks, or other pure small talk with no banking task, call NO tool (plain assistant message) so the server can reply in a friendly way.
- transfer_money: send/pay/transfer; receiver_username = payee alias OR 10-digit destination account number (NUBAN).
- get_my_balance: their own balance.
- list_my_accounts: their own accounts (JWT user).
- get_accounts_for_customer_id: accounts for a customer id; use empty customer_id if id is only in secure HTTP JSON fields.
- lookup_customer_by_phone: customer by phone; use empty phone_number if digits are only in secure fields.
- lookup_account_by_tracking_ref: account by TXN / tracking ref; use empty transaction_tracking_ref if ref is only in secure fields.
- get_my_transactions: their own transaction history (no account number in text).
- get_account_transactions: transactions for a NUBAN; use empty account_number if NUBAN is only in secure fields; optional from_date, to_date (YYYY-MM-DD).
- account_enquiry_by_nuban: full account details / enquiry for a NUBAN (name, balances, status). Not the same as transaction list or tracking ref.
- banking_knowledge_question: general info only (no CBA call).
The user message may redact sensitive tokens as [REDACTED]; still choose the right tool when intent is clear. Do not invent ids, amounts, or phone numbers—omit sensitive args when they are not in the visible text so the server can use secure fields. If unclear, call no tool.
Prior messages are shortened server-side summaries of earlier turns; use them only for continuity (e.g. follow-up "same account"), not as authorization to skip validation.`;

/** @param {Array<{ role: string, content: string }>} priorMessages */
function sanitizePriorMessages(priorMessages) {
  if (!Array.isArray(priorMessages) || priorMessages.length === 0) {
    return [];
  }
  const cap = 24;
  const slice = priorMessages.slice(-cap);
  const out = [];
  for (const m of slice) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = typeof m.content === 'string' ? m.content.slice(0, 2000) : '';
    if (!content.trim()) continue;
    out.push({ role: m.role, content });
  }
  return out;
}

/**
 * @param {import('openai').OpenAI} client
 * @param {string} model
 * @param {string} userText message possibly redacted for the LLM
 * @param {Record<string, string>} ctx normalized secure fields from the HTTP body
 * @param {string} originalPlainText original user message (for validation; not sent to LLM if redacted)
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} [priorMessages]
 * @returns {Promise<object | null>} plan shape or null to fall back to rules / next provider
 */
async function completionToPlan(
  client,
  model,
  userText,
  ctx = {},
  originalPlainText = '',
  priorMessages = [],
) {
  const plain = String(originalPlainText || userText || '');
  const history = sanitizePriorMessages(priorMessages);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      ...history,
      { role: 'user', content: userText },
    ],
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.1,
  });

  const choice = completion.choices[0];
  const msg = choice?.message;
  const calls = msg?.tool_calls;
  if (!calls || !calls.length) {
    return orchestrateLegacy(plain, ctx);
  }

  const tc = calls[0];
  if (tc.type !== 'function') {
    return orchestrateLegacy(plain, ctx);
  }

  let args = {};
  try {
    args = JSON.parse(tc.function.arguments || '{}');
  } catch {
    return orchestrateLegacy(plain, ctx);
  }

  if (tc.function.name === 'transfer_money') {
    const receiver = String(args.receiver_username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    const major = Number(args.amount_major);
    if (!receiver || !Number.isFinite(major) || major <= 0) {
      return orchestrateLegacy(plain, ctx);
    }
    const amountMinor = Math.round(major * 100);
    return {
      useRag: false,
      intent: 'transfer_money',
      entities: { receiver, amountMinor, amountDisplay: String(major) },
      tool: 'initiateTransfer',
      args: { receiverUsername: receiver, amountMinor },
    };
  }

  if (tc.function.name === 'get_my_balance') {
    return {
      useRag: false,
      intent: 'get_my_balance',
      tool: 'getMyAccount',
      args: {},
    };
  }

  if (tc.function.name === 'list_my_accounts') {
    return {
      useRag: false,
      intent: 'list_my_accounts',
      tool: 'getCbaAccountsRaw',
      args: {},
    };
  }

  if (tc.function.name === 'lookup_customer_by_phone') {
    let raw = String(args.phone_number || '').replace(/\D/g, '');
    if (!raw && ctx.phoneNumber) raw = String(ctx.phoneNumber).replace(/\D/g, '');
    if (!raw || raw.length < 10 || raw.length > 15) {
      return orchestrateLegacy(plain, ctx);
    }
    const bodyDigits = ctx.phoneNumber ? String(ctx.phoneNumber).replace(/\D/g, '') : '';
    const allowed =
      plain.replace(/\D/g, '').includes(raw) || (bodyDigits.length >= 10 && bodyDigits === raw);
    if (!allowed) {
      return orchestrateLegacy(plain, ctx);
    }
    return {
      useRag: false,
      intent: 'lookup_customer',
      tool: 'getCustomerByPhone',
      args: { phoneNumber: raw },
    };
  }

  if (tc.function.name === 'lookup_account_by_tracking_ref') {
    let ref = String(args.transaction_tracking_ref || '').trim();
    if (!ref && ctx.transactionTrackingRef) ref = String(ctx.transactionTrackingRef).trim();
    if (!ref || ref.length < 4 || ref.length > 200) {
      return orchestrateLegacy(plain, ctx);
    }
    const bodyRef = ctx.transactionTrackingRef ? String(ctx.transactionTrackingRef).trim() : '';
    const allowed = plain.includes(ref) || (bodyRef && bodyRef === ref);
    if (!allowed) {
      return orchestrateLegacy(plain, ctx);
    }
    return {
      useRag: false,
      intent: 'lookup_account_by_ref',
      tool: 'getAccountByTrackingRef',
      args: { transactionTrackingRef: ref },
    };
  }

  if (tc.function.name === 'get_my_transactions') {
    return {
      useRag: false,
      intent: 'get_my_transactions',
      tool: 'getTransactions',
      args: {},
    };
  }

  if (tc.function.name === 'get_account_transactions') {
    let acct = String(args.account_number || '').replace(/\D/g, '');
    if (acct.length !== 10 && ctx.accountNumber) acct = String(ctx.accountNumber).replace(/\D/g, '');
    if (acct.length !== 10) {
      return orchestrateLegacy(plain, ctx);
    }
    const bodyAcct = ctx.accountNumber ? String(ctx.accountNumber).replace(/\D/g, '') : '';
    const allowed =
      plain.replace(/\D/g, '').includes(acct) || (bodyAcct.length === 10 && bodyAcct === acct);
    if (!allowed) {
      return orchestrateLegacy(plain, ctx);
    }
    const n = args.number_of_items;
    const numberOfItems = Number.isFinite(Number(n)) ? Number(n) : undefined;
    return {
      useRag: false,
      intent: 'get_transactions',
      tool: 'getTransactions',
      args: {
        accountNumber: acct,
        fromDate: args.from_date != null ? String(args.from_date).trim() : '',
        toDate: args.to_date != null ? String(args.to_date).trim() : '',
        numberOfItems,
      },
    };
  }

  if (tc.function.name === 'get_accounts_for_customer_id') {
    let cid = String(args.customer_id || '').replace(/\D/g, '');
    if (!cid && ctx.customerId) cid = String(ctx.customerId).replace(/\D/g, '');
    if (!cid || cid.length < 4 || cid.length > 10) {
      return orchestrateLegacy(plain, ctx);
    }
    const bodyCid = ctx.customerId ? String(ctx.customerId).replace(/\D/g, '') : '';
    const allowed =
      plain.replace(/\D/g, '').includes(cid) || (bodyCid.length >= 4 && bodyCid === cid);
    if (!allowed) {
      return orchestrateLegacy(plain, ctx);
    }
    return {
      useRag: false,
      intent: 'accounts_by_customer_id',
      tool: 'getAccountsByCustomerIdQuery',
      args: { customerId: cid },
    };
  }

  if (tc.function.name === 'account_enquiry_by_nuban') {
    let acct = String(args.account_number || '').replace(/\D/g, '');
    if (acct.length !== 10 && ctx.accountNumber) acct = String(ctx.accountNumber).replace(/\D/g, '');
    if (acct.length !== 10) {
      return orchestrateLegacy(plain, ctx);
    }
    const bodyAcct = ctx.accountNumber ? String(ctx.accountNumber).replace(/\D/g, '') : '';
    const allowed =
      plain.replace(/\D/g, '').includes(acct) || (bodyAcct.length === 10 && bodyAcct === acct);
    if (!allowed) {
      return orchestrateLegacy(plain, ctx);
    }
    return {
      useRag: false,
      intent: 'account_enquiry',
      tool: 'accountEnquiry',
      args: { accountNumber: acct },
    };
  }

  if (tc.function.name === 'banking_knowledge_question') {
    return {
      useRag: true,
      intent: 'knowledge_query',
      raw: plain,
      message: '',
    };
  }

  return orchestrateLegacy(plain, ctx);
}

/**
 * OpenAI and/or Groq for tool routing; order from CHAT_LLM_ORDER. Returns null if no keys configured.
 * @param {string} text message for the LLM (may be redacted)
 * @param {Record<string, string>} ctx secure body fields
 * @param {string} originalPlainText original user message for validation
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} [priorMessages]
 */
async function orchestrateWithLlm(text, ctx = {}, originalPlainText = '', priorMessages = []) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { useRag: false, intent: 'empty', raw: trimmed };
  }

  const hasGroq = Boolean(config.groqApiKey);
  const hasOpenAI = Boolean(config.openaiApiKey);
  if (!hasGroq && !hasOpenAI) {
    return null;
  }

  const groqFirst = config.chatLlmOrder === 'groq_first';
  /** @type {Array<'openai' | 'groq'>} */
  const order = groqFirst ? ['groq', 'openai'] : ['openai', 'groq'];

  for (const provider of order) {
    if (provider === 'groq' && !hasGroq) continue;
    if (provider === 'openai' && !hasOpenAI) continue;

    try {
      const client =
        provider === 'groq'
          ? new OpenAI({
              apiKey: config.groqApiKey,
              baseURL: 'https://api.groq.com/openai/v1',
            })
          : new OpenAI({ apiKey: config.openaiApiKey });
      const model = provider === 'groq' ? config.groqModel : config.openaiModel;
      const plan = await completionToPlan(
        client,
        model,
        trimmed,
        ctx,
        originalPlainText,
        priorMessages,
      );
      return { ...plan, llmProvider: provider };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[llm] ${provider} failed, trying fallback if configured:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return null;
}

module.exports = { orchestrateWithLlm, completionToPlan };
