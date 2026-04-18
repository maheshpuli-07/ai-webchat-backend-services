const express = require('express');
const config = require('../config');
const cbaClient = require('../cba/cbaClient');
const { orchestrate } = require('../services/aiOrchestrator');
const { parseSecureChatBody, digitsOnly } = require('../utils/secureChatContext');
const {
  humanCustomerByPhoneReply,
  humanAccountsListReply,
  humanAccountByTrackingRefReply,
  humanBalanceReply,
  humanAccountEnquiryReply,
} = require('../utils/chatHumanReplies');
const { getAccountService } = require('../services/accountServiceFactory');
const { initiateTransfer } = require('../services/transferService');
const {
  getRecentForLlm,
  appendTurn,
  conversationUserKey,
} = require('../services/conversationStore');
const { answerKnowledgeQuestion } = require('../services/rag/ragAnswer');
const { sendChatPayload } = require('../services/conversationalReply');

function balanceReplyFromAccount(account) {
  if (!account) return 'No account data.';
  if (account.summary) return String(account.summary);
  if (account.ledger && typeof account.ledger.balanceMinor === 'number') {
    const cur = account.ledger.currency || config.cbaCurrency;
    return `Available balance: ${cur} ${(account.ledger.balanceMinor / 100).toFixed(2)}`;
  }
  return 'Here is your account information.';
}

/** Require that the user actually typed this phone (stops LLM inventing digits). */
function userMessageContainsPhoneDigits(userMessage, normalizedDigits) {
  const compact = String(userMessage || '').replace(/\D/g, '');
  return compact.includes(normalizedDigits);
}

const router = express.Router();

/**
 * POST /api/v1/chat
 * Body: { "message": "…", optional secure fields: phoneNumber, customerId, accountNumber, transactionTrackingRef }
 * (snake_case aliases supported). Identifiers in those fields are redacted before LLM calls.
 */
router.post('/', async (req, res) => {
  const { message } = req.body || {};
  const secureFields = parseSecureChatBody(req.body);
  const userKey = conversationUserKey(req);

  const priorMessages = config.redisEnabled ? await getRecentForLlm(userKey) : [];

  const origJson = res.json.bind(res);
  res.json = (body) => {
    if (config.redisEnabled && body && typeof body === 'object') {
      const assistantText =
        (typeof body.reply === 'string' && body.reply) ||
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        '';
      appendTurn(
        userKey,
        String(message || '').slice(0, config.redisMaxUserMsgChars),
        assistantText,
        { intent: body.intent, tool: body.tool },
      ).catch(() => {});
    }
    return origJson(body);
  };

  const plan = await orchestrate(message, secureFields, priorMessages);

  if (plan.intent === 'invalid') {
    return res.status(400).json({
      gatewayMode: req.gatewayMode,
      path: 'ai_orchestration',
      intent: plan.intent,
      llmProvider: plan.llmProvider,
      message: plan.message || 'Invalid request',
    });
  }

  if (plan.intent === 'chat_guidance') {
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        llmProvider: plan.llmProvider,
        reply: plan.message,
      },
      message,
      req.auth,
    );
  }

  if (plan.useRag) {
    const rag = await answerKnowledgeQuestion(plan.raw || message);
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'rag',
        intent: plan.intent,
        reply: rag.reply,
        sources: rag.sources,
        ragMode: rag.mode,
        ragIndexReady: rag.indexReady,
        llmProvider: plan.llmProvider,
      },
      message,
      req.auth,
    );
  }

  if (plan.intent === 'lookup_customer' && plan.tool === 'getCustomerByPhone') {
    const phoneNumber = String(plan.args?.phoneNumber || '').replace(/\D/g, '');
    if (!phoneNumber || phoneNumber.length < 10) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message: 'Valid phone number (at least 10 digits) is required.',
      });
    }
    const bodyPhone = digitsOnly(secureFields.phoneNumber);
    const allowedPhone =
      userMessageContainsPhoneDigits(message, phoneNumber) ||
      (bodyPhone.length >= 10 && bodyPhone === phoneNumber);
    if (!allowedPhone) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message:
          'Put the phone number in your message, or send the same number in the phoneNumber JSON field (secure). The simulator returns an empty list if no customer matches.',
      });
    }
    if (!config.cbaAuthToken) {
      return res.status(503).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'configuration',
        message: 'CBA_AUTH_TOKEN is not set — required for customer lookup.',
      });
    }

    let cbaRes;
    let json;
    try {
      ({ res: cbaRes, json } = await cbaClient.getCustomerByPhoneNumber(phoneNumber));
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return res.status(504).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? 'CBA simulator timeout' : e instanceof Error ? e.message : 'Request failed',
      });
    }

    const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
    if (!cbaRes.ok) {
      const msg =
        json && typeof json === 'object' && json.Message
          ? String(json.Message)
          : `CBA returned ${cbaRes.status}`;
      return res.status(status >= 400 ? status : 502).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: msg,
        customer: json,
      });
    }

    if (Array.isArray(json)) {
      if (json.length === 0) {
        return sendChatPayload(
          res,
          {
            gatewayMode: req.gatewayMode,
            path: 'ai_orchestration',
            intent: plan.intent,
            tool: plan.tool,
            llmProvider: plan.llmProvider,
            reply: `Hi ${req.auth?.username || req.auth?.sub || 'there'}, no customer was found in the simulator for that phone number (${phoneNumber}).`,
            customer: [],
            customerDetails: [],
          },
          message,
          req.auth,
        );
      }
      const { reply, customerDetails } = humanCustomerByPhoneReply(json, req.auth);
      return sendChatPayload(
        res,
        {
          gatewayMode: req.gatewayMode,
          path: 'ai_orchestration',
          intent: plan.intent,
          tool: plan.tool,
          llmProvider: plan.llmProvider,
          reply,
          customer: json,
          customerDetails,
        },
        message,
        req.auth,
      );
    }

    const { reply, customerDetails } = humanCustomerByPhoneReply(json, req.auth);
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply,
        customer: json,
        customerDetails,
      },
      message,
      req.auth,
    );
  }

  if (plan.intent === 'get_my_balance' && plan.tool === 'getMyAccount') {
    try {
      const svc = getAccountService();
      const account = await svc.getMyAccount(req.auth);
      if (!account) {
        return res.status(404).json({
          gatewayMode: req.gatewayMode,
          path: 'ai_orchestration',
          intent: plan.intent,
          tool: plan.tool,
          llmProvider: plan.llmProvider,
          error: 'not_found',
          message: 'No account for this user.',
        });
      }
      return sendChatPayload(
        res,
        {
          gatewayMode: req.gatewayMode,
          path: 'ai_orchestration',
          intent: plan.intent,
          tool: plan.tool,
          llmProvider: plan.llmProvider,
          reply: humanBalanceReply(req.auth, balanceReplyFromAccount(account)),
          account,
        },
        message,
        req.auth,
      );
    } catch (e) {
      const status = e && typeof e.statusCode === 'number' ? e.statusCode : 502;
      return res.status(status).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: e instanceof Error ? e.message : 'Account service unavailable',
      });
    }
  }

  if (plan.intent === 'list_my_accounts' && plan.tool === 'getCbaAccountsRaw') {
    if (!config.cbaAuthToken) {
      return res.status(503).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'configuration',
        message: 'CBA_AUTH_TOKEN is not set — required to list accounts.',
      });
    }
    const customerId = req.auth.customerId;
    if (!customerId) {
      return res.status(403).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'forbidden',
        message: 'JWT is missing customerId.',
      });
    }
    let cbaRes;
    let json;
    try {
      ({ res: cbaRes, json } = await cbaClient.getAccountsByCustomerId(customerId));
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return res.status(504).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
      });
    }
    const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
    if (json === null || json === undefined) {
      return res.status(status).end();
    }
    if (!cbaRes.ok) {
      const msg =
        json && typeof json === 'object' && json.Message
          ? String(json.Message)
          : `CBA returned ${cbaRes.status}`;
      return res.status(status >= 400 ? status : 502).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: msg,
        cbaAccounts: json,
      });
    }
    const { reply, customerDetails } = humanAccountsListReply(json, customerId, req.auth);
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply,
        cbaAccounts: json,
        customerDetails,
      },
      message,
      req.auth,
    );
  }

  if (plan.intent === 'accounts_by_customer_id' && plan.tool === 'getAccountsByCustomerIdQuery') {
    const customerId = String(plan.args?.customerId || '').replace(/\D/g, '');
    if (!customerId || customerId.length < 4) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message: 'customerId (numeric, at least 4 digits) is required.',
      });
    }
    const bodyCid = digitsOnly(secureFields.customerId);
    const allowedCustomerId =
      String(message || '')
        .replace(/\D/g, '')
        .includes(customerId) || (bodyCid.length >= 4 && bodyCid === customerId);
    if (!allowedCustomerId) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message:
          'Include the customer id in your message or send the same id in the customerId JSON field.',
      });
    }
    if (!config.cbaAuthToken) {
      return res.status(503).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'configuration',
        message: 'CBA_AUTH_TOKEN is not set.',
      });
    }
    let cbaRes;
    let json;
    try {
      ({ res: cbaRes, json } = await cbaClient.getAccountsByCustomerId(customerId));
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return res.status(504).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
      });
    }
    const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
    if (json === null || json === undefined) {
      return res.status(status).end();
    }
    if (!cbaRes.ok) {
      const msg =
        json && typeof json === 'object' && json.Message
          ? String(json.Message)
          : `CBA returned ${cbaRes.status}`;
      return res.status(status >= 400 ? status : 502).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: msg,
        cbaAccounts: json,
      });
    }
    const { reply, customerDetails } = humanAccountsListReply(json, customerId, req.auth);
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply,
        cbaAccounts: json,
        queriedCustomerId: customerId,
        customerDetails,
      },
      message,
      req.auth,
    );
  }

  if (plan.intent === 'lookup_account_by_ref' && plan.tool === 'getAccountByTrackingRef') {
    const transactionTrackingRef = String(plan.args?.transactionTrackingRef || '').trim();
    if (!transactionTrackingRef || transactionTrackingRef.length < 4) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message: 'transactionTrackingRef is required.',
      });
    }
    const bodyRef = String(secureFields.transactionTrackingRef || '').trim();
    const allowedRef =
      String(message || '').includes(transactionTrackingRef) ||
      (bodyRef.length >= 4 && bodyRef === transactionTrackingRef);
    if (!allowedRef) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message:
          'Include the tracking ref in your message or send the same ref in the transactionTrackingRef JSON field.',
      });
    }
    if (!config.cbaAuthToken) {
      return res.status(503).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'configuration',
        message: 'CBA_AUTH_TOKEN is not set.',
      });
    }
    let cbaRes;
    let json;
    try {
      ({ res: cbaRes, json } = await cbaClient.getAccountByTransactionTrackingRef(transactionTrackingRef));
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return res.status(504).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
      });
    }
    const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
    if (json === null || json === undefined) {
      return res.status(status).end();
    }
    if (!cbaRes.ok) {
      const msg =
        json && typeof json === 'object' && json.Message
          ? String(json.Message)
          : `CBA returned ${cbaRes.status}`;
      return res.status(status >= 400 ? status : 502).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: msg,
        accountByTrackingRef: json,
      });
    }
    const { reply, customerDetails } = humanAccountByTrackingRefReply(json, req.auth);
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply,
        accountByTrackingRef: json,
        customerDetails,
      },
      message,
      req.auth,
    );
  }

  if (plan.intent === 'account_enquiry' && plan.tool === 'accountEnquiry') {
    let accountNumber = String(plan.args?.accountNumber || '').replace(/\D/g, '');
    if (accountNumber.length !== 10) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message: 'A 10-digit NUBAN is required for Account Enquiry.',
      });
    }
    const bodyAcct = digitsOnly(secureFields.accountNumber);
    const allowedAcct =
      String(message || '')
        .replace(/\D/g, '')
        .includes(accountNumber) ||
      (bodyAcct.length === 10 && bodyAcct === accountNumber);
    if (!allowedAcct) {
      return res.status(400).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        message:
          'Include the NUBAN in your message (e.g. “account details for …”) or send the same value in the accountNumber JSON field.',
      });
    }
    if (!config.cbaAuthToken) {
      return res.status(503).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'configuration',
        message: 'CBA_AUTH_TOKEN is not set — required for Account Enquiry (AuthenticationCode).',
      });
    }
    let cbaRes;
    let json;
    try {
      ({ res: cbaRes, json } = await cbaClient.accountEnquiry(accountNumber));
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return res.status(504).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
      });
    }
    const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
    if (json === null || json === undefined) {
      return res.status(status).end();
    }
    if (!cbaRes.ok) {
      const msg =
        json && typeof json === 'object' && json.Message != null
          ? String(json.Message)
          : `CBA returned ${cbaRes.status}`;
      return res.status(status >= 400 ? status : 502).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: msg,
        accountEnquiry: json,
      });
    }
    const { reply, customerDetails } = humanAccountEnquiryReply(json, req.auth, accountNumber);
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply,
        accountEnquiry: json,
        customerDetails,
      },
      message,
      req.auth,
    );
  }

  if (
    (plan.intent === 'get_transactions' || plan.intent === 'get_my_transactions') &&
    plan.tool === 'getTransactions'
  ) {
    let accountNumber = '';
    if (plan.intent === 'get_my_transactions') {
      accountNumber = String(req.auth.accountNumber || '').replace(/\D/g, '');
      if (accountNumber.length !== 10) {
        return res.status(400).json({
          gatewayMode: req.gatewayMode,
          path: 'ai_orchestration',
          intent: plan.intent,
          message:
            'Your login token has no 10-digit NUBAN. Say “transactions for account 1106751539” with the account you want.',
        });
      }
    } else {
      accountNumber = String(plan.args?.accountNumber || '').replace(/\D/g, '');
      if (accountNumber.length !== 10) {
        return res.status(400).json({
          gatewayMode: req.gatewayMode,
          path: 'ai_orchestration',
          intent: plan.intent,
          message: 'A 10-digit account number (NUBAN) is required for transaction history.',
        });
      }
      const bodyAcct = digitsOnly(secureFields.accountNumber);
      const allowedAcct =
        String(message || '')
          .replace(/\D/g, '')
          .includes(accountNumber) ||
        (bodyAcct.length === 10 && bodyAcct === accountNumber);
      if (!allowedAcct) {
        return res.status(400).json({
          gatewayMode: req.gatewayMode,
          path: 'ai_orchestration',
          intent: plan.intent,
          message:
            'Include the NUBAN in your message (e.g. “transactions for account …”) or send the same value in the accountNumber JSON field.',
        });
      }
    }
    if (!config.cbaAuthToken) {
      return res.status(503).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: 'configuration',
        message: 'CBA_AUTH_TOKEN is not set.',
      });
    }
    const fromDate = plan.args?.fromDate != null ? String(plan.args.fromDate).trim() : '';
    const toDate = plan.args?.toDate != null ? String(plan.args.toDate).trim() : '';
    const numberOfItems = plan.args?.numberOfItems;
    let cbaRes;
    let json;
    try {
      ({ res: cbaRes, json } = await cbaClient.getTransactions({
        accountNumber,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        numberOfItems,
      }));
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return res.status(504).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        error: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? 'CBA timeout' : e instanceof Error ? e.message : 'Request failed',
      });
    }
    const status = cbaRes.status >= 100 && cbaRes.status < 600 ? cbaRes.status : 502;
    if (json === null || json === undefined) {
      return res.status(status).end();
    }
    if (!cbaRes.ok) {
      let msg = `CBA returned ${cbaRes.status}`;
      if (json && typeof json === 'object' && json.Message != null) {
        msg = typeof json.Message === 'string' ? json.Message : JSON.stringify(json.Message);
      }
      return res.status(status >= 400 ? status : 502).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        error: 'upstream_error',
        message: msg,
        cbaTransactions: json,
      });
    }
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply: `Transactions for account ${accountNumber} (GetTransactions).`,
        cbaTransactions: json,
      },
      message,
      req.auth,
    );
  }

  if (plan.intent === 'transfer_money' && plan.tool === 'initiateTransfer') {
    const result = await initiateTransfer({
      auth: req.auth,
      receiverUsername: plan.args.receiverUsername,
      amountMinor: plan.args.amountMinor,
    });
    if (!result.ok) {
      const status =
        result.code === 'insufficient_funds'
          ? 402
          : result.code === 'upstream_error'
            ? 502
            : result.code === 'account_not_found' || result.code === 'receiver_not_found'
              ? 409
              : 400;
      return res.status(status).json({
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        error: result.code,
        message: result.message,
      });
    }
    const amount = result.amountMinor / 100;
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        tool: plan.tool,
        llmProvider: plan.llmProvider,
        reply: `${amount.toFixed(2)} ${result.currency} sent to ${result.receiver.displayName} (${result.receiver.username}).`,
        transfer: {
          transferId: result.transferId,
          amount,
          currency: result.currency,
          receiver: result.receiver,
        },
      },
      message,
      req.auth,
    );
  }

  /** Unknown / empty are normal chat turns, not client errors — 200 so the UI does not style them as failures. */
  if (plan.intent === 'unknown' || plan.intent === 'empty') {
    const reply =
      plan.intent === 'empty'
        ? "Hi! I'm here when you're ready. I can help with your balance, your accounts, account details by NUBAN, finding someone by phone, transactions, or sending money — tell me what you'd like and I'll walk you through it."
        : plan.message ||
          "I'm here to help. I can check your balance, list accounts, account enquiry by NUBAN, look up by phone, show transactions, or help with transfers — what would you like to do?";
    return sendChatPayload(
      res,
      {
        gatewayMode: req.gatewayMode,
        path: 'ai_orchestration',
        intent: plan.intent,
        llmProvider: plan.llmProvider,
        reply,
      },
      message,
      req.auth,
    );
  }

  return res.status(400).json({
    gatewayMode: req.gatewayMode,
    path: 'ai_orchestration',
    intent: plan.intent || 'unknown',
    llmProvider: plan.llmProvider,
    message: plan.message || 'Unsupported message',
  });
});

module.exports = router;
