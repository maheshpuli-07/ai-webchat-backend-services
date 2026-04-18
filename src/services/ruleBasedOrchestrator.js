/**
 * Regex / pattern NLU fallback when LLMs are unavailable or return no tool call.
 */

const TRANSFER_PATTERNS = [
  /(?:send|transfer|pay)\s+(?:rs\.?|inr|rupees?|ngn|naira|n)?\s*(\d+(?:[.,]\d+)?)\s*(?:rs\.?|inr|rupees?|ngn|naira|n)?\s*(?:to)\s+([a-zA-Z][\w.-]*)/i,
  /(?:send|transfer|pay)\s+([a-zA-Z][\w.-]*)\s+(?:rs\.?|inr|rupees?|ngn|naira|n)?\s*(\d+(?:[.,]\d+)?)/i,
  /(\d+(?:[.,]\d+)?)\s*(?:rs\.?|inr|rupees?|ngn|naira|n)\s+(?:to)\s+([a-zA-Z][\w.-]*)/i,
  /(\d+(?:[.,]\d+)?)\s+(?:to)\s+([a-zA-Z][\w.-]*)/i,
  /(?:send|transfer)\s+(?:a\s+)?money\s+to\s+([a-zA-Z][\w.-]*)\s+(\d+(?:[.,]\d+)?)\s*(?:rs\.?|inr|rupees?|ngn|naira|n)?/i,
  /(?:pay|send)\s+([a-zA-Z][\w.-]*)\s+(\d+(?:[.,]\d+)?)\s*(?:rs\.?|inr|rupees?|ngn|naira|n)?/i,
];

const RAG_HINT = /^(what|how|when|why|explain|define|emi|interest|policy|faq|loan|fd|fixed deposit)/i;

const BALANCE_HINT =
  /(?:^|\b)(?:what(?:'s| is)\s+my\s+balance|show\s+my\s+balance|check\s+my\s+balance|my\s+balance|account\s+balance|how\s+much\s+(?:money\s+)?do\s+i\s+have|how\s+much\s+is\s+in\s+my\s+account)(?:\b|[?.!])/i;

/** "List accounts for customer 000166" — before generic list accounts (must not match "... for customer"). */
const ACCOUNTS_FOR_CUSTOMER_PATTERN =
  /(?:^|\b)(?:list|show|get)\s+accounts?\s+for\s+(?:customer\s+)?(\d{4,8})\b/i;

const LIST_ACCOUNTS_HINT =
  /(?:^|\b)(?:list|show|get)\s+my\s+accounts?\b|(?:^|\b)my\s+accounts?\b|(?:^|\b)(?:list|show|get)\s+accounts?\b(?!\s+for\s+customer)/i;

/** Simulator GET GetAccountByTransactionTrackingRef */
const TRACKING_REF_PATTERNS = [
  /\b(TXN-[A-Za-z0-9-]{4,120})\b/i,
  /(?:tracking|transaction)\s+(?:ref|reference)\s*[:\s]+\s*([A-Za-z0-9][A-Za-z0-9_-]{3,120})/i,
];

/** Simulator GET GetTransactions — require "account" or "nuban" before digits (avoids confusing phone numbers). */
const TRANSACTIONS_PATTERN =
  /(?:^|\b)(?:transactions?|history|statement)\s+(?:for\s+)?(?:account|nuban)\s+(\d{10})\b/i;

/** Logged-in user's NUBAN via JWT — after explicit "transactions for account …". */
const MY_TRANSACTIONS_HINT =
  /(?:^|\b)(?:get|show|list)(?:\s+my)?\s+transactions?\b|(?:^|\b)(?:my\s+)?transaction\s+history\b/i;

function wantsCustomerByPhoneWithoutDigits(trimmed) {
  const digitCompact = trimmed.replace(/\D/g, '');
  const hasPhoneLen = digitCompact.length >= 10 && digitCompact.length <= 15;
  const asks =
    /(?:^|\b)(?:get|lookup|find|search|show)\s+(?:the\s+)?(?:customer|client|user).{0,40}(?:phone|mobile)/i.test(
      trimmed,
    ) ||
    /(?:^|\b)(?:customer|client|user).{0,30}(?:by\s+phone|phone\s+number|mobile)/i.test(trimmed);
  return asks && !hasPhoneLen;
}

/** Customer lookup by phone (checked before transfer patterns). */
const LOOKUP_PATTERNS = [
  /(?:get|lookup|find|search|show)\s+(?:the\s+)?(?:customer|client|user)?\D*(\d{10,15})/i,
  /(?:customer|client)\s+(?:by\s+)?(?:phone|mobile|number)?\D*(\d{10,15})/i,
  /(?:phone|mobile)\s*(?:number|no\.?)?\s*[:\s#-]*(\d{10,15})/i,
];

function parseAmountToMinor(amountStr) {
  const n = Number(String(amountStr).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * @param {string} text
 * @param {Record<string, string>} [ctx] normalized secure fields from the request body
 */
/**
 * Short greetings / thanks — not banking commands. Checked before RAG so "how are you" does not hit knowledge_query.
 * @param {string} s
 */
function looksLikeGreetingOrSmallTalk(s) {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length > 120) return false;
  if (/\d{10}/.test(t)) return false;

  if (
    /^(?:h+i+|hello|hey|hiya|yo|sup|howdy|good\s+(?:morning|afternoon|evening))(?:\s+there)?\s*[!.?,]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^(?:h+i+|hello|hey)\b[\s,!.]*(?:how\s+are\s+you(?:\s+doing)?|how'?s\s+it\s+going|what'?s\s+up)\s*[!.?,]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(?:how\s+are\s+you|how'?re\s+you|what'?s\s+up|how'?s\s+it\s+going)\s*[!.?,]*$/i.test(t)) {
    return true;
  }
  if (/^(?:thanks?|thank\s+you|thx|ty|appreciate\s+it)\s*[!.?,]*$/i.test(t)) {
    return true;
  }
  return false;
}

const GREETING_REPLY = `Hi! How are you doing? I'm here and happy to help.

I can pull up your balance, list your accounts, look up account details by NUBAN, find a customer by phone, show transactions, or help you send money. If you're not sure where to start, tell me what you're trying to do and I'll walk you through it step by step.`;

const THANKS_REPLY = `You're welcome! Anytime you need your balance, a transfer, or account details, just ask — I can walk you through it.`;

const UNSURE_REPLY = `I'm not sure I caught that — no worries.

I can help with your balance, listing accounts, account details (NUBAN enquiry), phone lookup, transactions, or sending money (for example, "Send 500 to mahesh" or to a 10-digit account). Say what you'd like and I'll guide you.`;

function orchestrateLegacy(text, ctx = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { useRag: false, intent: 'empty', raw: trimmed };
  }

  if (looksLikeGreetingOrSmallTalk(trimmed)) {
    const thanks = /^(?:thanks?|thank\s+you|thx|ty|appreciate\s+it)\b/i.test(trimmed);
    return {
      useRag: false,
      intent: 'unknown',
      raw: trimmed,
      message: thanks ? THANKS_REPLY : GREETING_REPLY,
    };
  }

  if (BALANCE_HINT.test(trimmed)) {
    return {
      useRag: false,
      intent: 'get_my_balance',
      tool: 'getMyAccount',
      args: {},
    };
  }

  const accForCust = trimmed.match(ACCOUNTS_FOR_CUSTOMER_PATTERN);
  if (accForCust) {
    return {
      useRag: false,
      intent: 'accounts_by_customer_id',
      tool: 'getAccountsByCustomerIdQuery',
      args: { customerId: accForCust[1] },
    };
  }

  const ctxCust = ctx.customerId ? String(ctx.customerId).replace(/\D/g, '') : '';
  if (
    ctxCust.length >= 4 &&
    ctxCust.length <= 10 &&
    /(?:^|\b)(?:list|show|get)\s+accounts?\s+for\s+customer\b/i.test(trimmed) &&
    !accForCust
  ) {
    return {
      useRag: false,
      intent: 'accounts_by_customer_id',
      tool: 'getAccountsByCustomerIdQuery',
      args: { customerId: ctxCust },
    };
  }

  if (LIST_ACCOUNTS_HINT.test(trimmed)) {
    return {
      useRag: false,
      intent: 'list_my_accounts',
      tool: 'getCbaAccountsRaw',
      args: {},
    };
  }

  for (const re of TRACKING_REF_PATTERNS) {
    const m = trimmed.match(re);
    if (!m) continue;
    const ref = String(m[1]).trim();
    if (ref.length >= 4) {
      return {
        useRag: false,
        intent: 'lookup_account_by_ref',
        tool: 'getAccountByTrackingRef',
        args: { transactionTrackingRef: ref },
      };
    }
  }

  const ctxRef = ctx.transactionTrackingRef ? String(ctx.transactionTrackingRef).trim() : '';
  if (
    ctxRef.length >= 4 &&
    /(?:^|\b)(?:tracking|transaction)\s+(?:ref|reference)\b|account\s+by\s+tracking|lookup\s+.*\bref\b/i.test(
      trimmed,
    )
  ) {
    return {
      useRag: false,
      intent: 'lookup_account_by_ref',
      tool: 'getAccountByTrackingRef',
      args: { transactionTrackingRef: ctxRef },
    };
  }

  const txm = trimmed.match(TRANSACTIONS_PATTERN);
  if (txm) {
    return {
      useRag: false,
      intent: 'get_transactions',
      tool: 'getTransactions',
      args: { accountNumber: txm[1] },
    };
  }

  const ctxAcct = ctx.accountNumber ? String(ctx.accountNumber).replace(/\D/g, '') : '';
  if (
    ctxAcct.length === 10 &&
    /(?:^|\b)(?:get|show|list)\s+transactions?\s+for\s+(?:account|nuban)\b/i.test(trimmed)
  ) {
    return {
      useRag: false,
      intent: 'get_transactions',
      tool: 'getTransactions',
      args: { accountNumber: ctxAcct },
    };
  }

  if (MY_TRANSACTIONS_HINT.test(trimmed)) {
    return {
      useRag: false,
      intent: 'get_my_transactions',
      tool: 'getTransactions',
      args: {},
    };
  }

  /** Account Enquiry (NUBAN) — POST …/Account/AccountEnquiry; distinct from transaction history. */
  const accountEnquiryWithNuban = trimmed.match(
    /(?:^|\b)(?:account\s+enquiry|enquiry\s+(?:on\s+)?(?:the\s+)?(?:account|nuban)|(?:get|give|show)\s+(?:me\s+)?(?:the\s+)?(?:full\s+)?account\s+details?|details?\s+(?:of|for)\s+(?:the\s+)?(?:account|nuban)|lookup\s+(?:this\s+)?account|nuban\s+(?:details?|info|information))\D*(\d{10})\b/i,
  );
  if (accountEnquiryWithNuban) {
    return {
      useRag: false,
      intent: 'account_enquiry',
      tool: 'accountEnquiry',
      args: { accountNumber: accountEnquiryWithNuban[1] },
    };
  }

  if (
    /(?:^|\b)(?:give\s+me\s+|show\s+me\s+|get\s+|i\s+need\s+)?(?:the\s+)?account\s+details?\b/i.test(
      trimmed,
    ) &&
    !/\btransactions?\b/i.test(trimmed) &&
    !/\b(?:send|transfer|pay)\s+\d/i.test(trimmed)
  ) {
    const ctxAcct = ctx.accountNumber ? String(ctx.accountNumber).replace(/\D/g, '') : '';
    const inline = trimmed.match(/\b(\d{10})\b/);
    const acct = inline ? inline[1] : ctxAcct.length === 10 ? ctxAcct : '';
    if (acct.length === 10) {
      return {
        useRag: false,
        intent: 'account_enquiry',
        tool: 'accountEnquiry',
        args: { accountNumber: acct },
      };
    }
    return {
      useRag: false,
      intent: 'chat_guidance',
      tool: 'none',
      message:
        'Sure — which 10-digit account (NUBAN) should I look up? Add it to your message (e.g. “account details for 1100313855”) or send it in the accountNumber JSON field.',
    };
  }

  if (wantsCustomerByPhoneWithoutDigits(trimmed)) {
    const fromCtx = ctx.phoneNumber ? String(ctx.phoneNumber).replace(/\D/g, '') : '';
    if (fromCtx.length >= 10 && fromCtx.length <= 15) {
      return {
        useRag: false,
        intent: 'lookup_customer',
        tool: 'getCustomerByPhone',
        args: { phoneNumber: fromCtx },
      };
    }
    return {
      useRag: false,
      intent: 'chat_guidance',
      tool: 'none',
      message:
        'Sure — I’ll need the phone number to look them up. You can type it in the same message, or paste it in the secure phoneNumber field in the request. Example: “Customer for 0803…” plus the digits.',
    };
  }

  for (const re of LOOKUP_PATTERNS) {
    const m = trimmed.match(re);
    if (!m) continue;
    const digits = String(m[1]).replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      return {
        useRag: false,
        intent: 'lookup_customer',
        tool: 'getCustomerByPhone',
        args: { phoneNumber: digits },
      };
    }
  }

  /** LocalFundsTransfer: debit = JWT-linked account; credit = this 10-digit NUBAN (another account in CBA). */
  const transferNuban = trimmed.match(
    /(?:^|\b)(?:send|transfer|pay)\s+(?:rs\.?|inr|rupees?|ngn|naira|n)?\s*(\d+(?:[.,]\d+)?)\s*(?:rs\.?|inr|rupees?|ngn|naira|n)?\s+to\s+(?:account|nuban\s+)?(\d{10})\b/i,
  );
  if (transferNuban) {
    const amountMinor = parseAmountToMinor(transferNuban[1]);
    const nuban = transferNuban[2];
    if (amountMinor && nuban) {
      return {
        useRag: false,
        intent: 'transfer_money',
        entities: { receiver: nuban, amountMinor, amountDisplay: transferNuban[1] },
        tool: 'initiateTransfer',
        args: { receiverUsername: nuban, amountMinor },
      };
    }
  }

  for (const re of TRANSFER_PATTERNS) {
    const m = trimmed.match(re);
    if (!m) continue;
    let amountStr;
    let nameRaw;
    const amountFirst =
      re === TRANSFER_PATTERNS[0] || re === TRANSFER_PATTERNS[2] || re === TRANSFER_PATTERNS[3];
    if (amountFirst) {
      amountStr = m[1];
      nameRaw = m[2];
    } else {
      nameRaw = m[1];
      amountStr = m[2];
    }
    const amountMinor = parseAmountToMinor(amountStr);
    const receiver = nameRaw ? nameRaw.trim() : null;
    if (!amountMinor || !receiver) continue;

    return {
      useRag: false,
      intent: 'transfer_money',
      entities: { receiver, amountMinor, amountDisplay: amountStr },
      tool: 'initiateTransfer',
      args: { receiverUsername: receiver.toLowerCase(), amountMinor },
    };
  }

  if (RAG_HINT.test(trimmed)) {
    return {
      useRag: true,
      intent: 'knowledge_query',
      raw: trimmed,
      message: '',
    };
  }

  return {
    useRag: false,
    intent: 'unknown',
    raw: trimmed,
    message: UNSURE_REPLY,
  };
}

module.exports = { orchestrateLegacy, looksLikeGreetingOrSmallTalk };
