/**
 * Optional structured fields for POST /api/v1/chat so identifiers are not only in free text
 * (redacted before LLM calls; merged into tool args server-side).
 */

/**
 * @param {Record<string, unknown> | null | undefined} body
 */
function parseSecureChatBody(body) {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const pick = (camel, snake) => {
    const v = body[camel] ?? body[snake];
    if (v == null) return '';
    return String(v).trim();
  };
  return {
    phoneNumber: pick('phoneNumber', 'phone_number'),
    customerId: pick('customerId', 'customer_id'),
    accountNumber: pick('accountNumber', 'account_number'),
    transactionTrackingRef: pick('transactionTrackingRef', 'transaction_tracking_ref'),
  };
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Drop empty strings; keep only fields the client sent.
 * @param {ReturnType<typeof parseSecureChatBody>} raw
 */
function normalizeSecureContext(raw) {
  const out = {};
  if (raw.phoneNumber) out.phoneNumber = raw.phoneNumber;
  if (raw.customerId) out.customerId = raw.customerId;
  if (raw.accountNumber) out.accountNumber = raw.accountNumber;
  if (raw.transactionTrackingRef) out.transactionTrackingRef = raw.transactionTrackingRef;
  return out;
}

/**
 * Replace structured identifier substrings so they are not sent to the LLM provider.
 * @param {string} text
 * @param {ReturnType<typeof normalizeSecureContext>} ctx
 */
function redactForLlm(text, ctx) {
  let out = String(text || '');
  const parts = [];
  if (ctx.phoneNumber) {
    parts.push(digitsOnly(ctx.phoneNumber), ctx.phoneNumber.trim());
  }
  if (ctx.customerId) {
    parts.push(digitsOnly(ctx.customerId), ctx.customerId.trim());
  }
  if (ctx.accountNumber) {
    parts.push(digitsOnly(ctx.accountNumber), ctx.accountNumber.trim());
  }
  if (ctx.transactionTrackingRef) {
    parts.push(ctx.transactionTrackingRef.trim());
  }
  const seen = new Set();
  for (let p of parts) {
    p = String(p || '').trim();
    if (p.length < 3 || seen.has(p)) continue;
    seen.add(p);
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '[REDACTED]');
  }
  return out;
}

/**
 * Fill plan.args from ctx; detect conflicts when both message-derived and body disagree.
 * @param {object} plan
 * @param {ReturnType<typeof normalizeSecureContext>} ctx
 */
function mergeSensitiveArgs(plan, ctx) {
  if (!plan || !ctx) return plan;

  if (plan.intent === 'lookup_customer' && plan.tool === 'getCustomerByPhone') {
    const a = digitsOnly(plan.args?.phoneNumber);
    const b = digitsOnly(ctx.phoneNumber);
    if (a && b && a !== b) {
      return {
        ...plan,
        intent: 'invalid',
        tool: 'none',
        message: 'phoneNumber in the message and phoneNumber in the secure fields do not match.',
      };
    }
    const phone = a || b;
    if (phone.length >= 10 && phone.length <= 15) {
      return { ...plan, args: { phoneNumber: phone } };
    }
    return plan;
  }

  if (plan.intent === 'accounts_by_customer_id' && plan.tool === 'getAccountsByCustomerIdQuery') {
    const a = digitsOnly(plan.args?.customerId);
    const b = digitsOnly(ctx.customerId);
    if (a && b && a !== b) {
      return {
        ...plan,
        intent: 'invalid',
        tool: 'none',
        message: 'customerId in the message and customerId in the secure fields do not match.',
      };
    }
    const id = a || b;
    if (id.length >= 4 && id.length <= 10) {
      return { ...plan, args: { customerId: id } };
    }
    return plan;
  }

  if (plan.intent === 'get_transactions' && plan.tool === 'getTransactions') {
    const a = digitsOnly(plan.args?.accountNumber);
    const b = digitsOnly(ctx.accountNumber);
    if (a && b && a !== b) {
      return {
        ...plan,
        intent: 'invalid',
        tool: 'none',
        message: 'accountNumber in the message and accountNumber in the secure fields do not match.',
      };
    }
    const acct = a || b;
    if (acct.length === 10) {
      return {
        ...plan,
        args: {
          ...plan.args,
          accountNumber: acct,
        },
      };
    }
    return plan;
  }

  if (plan.intent === 'account_enquiry' && plan.tool === 'accountEnquiry') {
    const a = digitsOnly(plan.args?.accountNumber);
    const b = digitsOnly(ctx.accountNumber);
    if (a && b && a !== b) {
      return {
        ...plan,
        intent: 'invalid',
        tool: 'none',
        message: 'accountNumber in the message and accountNumber in the secure fields do not match.',
      };
    }
    const acct = a || b;
    if (acct.length === 10) {
      return {
        ...plan,
        args: {
          ...plan.args,
          accountNumber: acct,
        },
      };
    }
    return plan;
  }

  if (plan.intent === 'lookup_account_by_ref' && plan.tool === 'getAccountByTrackingRef') {
    const a = String(plan.args?.transactionTrackingRef || '').trim();
    const b = String(ctx.transactionTrackingRef || '').trim();
    if (a && b && a !== b) {
      return {
        ...plan,
        intent: 'invalid',
        tool: 'none',
        message:
          'transactionTrackingRef in the message and transactionTrackingRef in the secure fields do not match.',
      };
    }
    const ref = a || b;
    if (ref.length >= 4) {
      return { ...plan, args: { transactionTrackingRef: ref } };
    }
    return plan;
  }

  return plan;
}

module.exports = {
  parseSecureChatBody,
  normalizeSecureContext,
  redactForLlm,
  mergeSensitiveArgs,
  digitsOnly,
};
