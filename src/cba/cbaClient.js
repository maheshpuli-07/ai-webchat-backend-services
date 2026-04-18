const config = require('../config');
const {
  sanitizeForLog,
  stringifyForTerminal,
  redactQueryStringForLog,
} = require('../utils/apiTrafficLog');

/**
 * CBA often expects a fixed-width numeric customer id (e.g. 033779). JWT/registry may omit leading zeros.
 * @param {string|undefined} customerId
 */
function normalizeCustomerIdForCba(customerId) {
  const s = String(customerId || '').trim();
  if (!s) return s;
  if (/^\d+$/.test(s) && s.length < 6) return s.padStart(6, '0');
  return s;
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const scalar = Array.isArray(v) ? v[0] : v;
    if (scalar === undefined || scalar === null) return;
    const s = String(scalar);
    if (s === 'undefined' || s === 'null') return;
    q.set(k, s);
  });
  return q.toString();
}

async function fetchCba(path, { method = 'GET', query, body } = {}) {
  const qs = query && Object.keys(query).length ? `?${buildQuery(query)}` : '';
  const url = `${config.cbaBaseUrl}${path}${qs}`;
  const qsForLog = query && Object.keys(query).length ? redactQueryStringForLog(buildQuery(query)) : '';

  if (config.logApiTraffic) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        tag: 'CBA_REQ',
        method,
        path,
        url: `${config.cbaBaseUrl}${path}${qsForLog ? `?${qsForLog}` : ''}`,
        body: body !== undefined ? sanitizeForLog(body) : undefined,
      }),
    );
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.cbaTimeoutMs);
  try {
    const init = {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }
    if (config.logApiTraffic) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          tag: 'CBA_RES',
          method,
          path,
          status: res.status,
          body: stringifyForTerminal(json),
        }),
      );
    }
    return { res, json };
  } catch (e) {
    if (config.logApiTraffic) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          tag: 'CBA_ERR',
          method,
          path,
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {string} phoneNumber
 */
function getCustomerByPhoneNumber(phoneNumber) {
  return fetchCba('/api/Customer/GetByCustomerPhoneNumber', {
    query: { phoneNumber, authToken: config.cbaAuthToken },
  });
}

/**
 * @param {string} customerId
 */
function getAccountsByCustomerId(customerId) {
  return fetchCba('/api/Account/GetAccountsByCustomerId', {
    query: { customerId: normalizeCustomerIdForCba(customerId), authToken: config.cbaAuthToken },
  });
}

/**
 * @param {string} transactionTrackingRef
 */
function getAccountByTransactionTrackingRef(transactionTrackingRef) {
  return fetchCba('/api/Account/GetAccountByTransactionTrackingRef', {
    query: { transactionTrackingRef, authToken: config.cbaAuthToken },
  });
}

/**
 * @param {{ accountNumber: string, fromDate?: string, toDate?: string, numberOfItems?: number }} p
 */
function getTransactions(p) {
  const query = {
    accountNumber: String(p.accountNumber).trim(),
    authToken: config.cbaAuthToken,
  };
  if (p.fromDate && String(p.fromDate).trim()) query.fromDate = String(p.fromDate).trim();
  if (p.toDate && String(p.toDate).trim()) query.toDate = String(p.toDate).trim();
  if (p.numberOfItems != null && Number.isFinite(Number(p.numberOfItems))) {
    query.numberOfItems = String(Math.max(1, Math.min(500, Math.floor(Number(p.numberOfItems)))));
  }
  return fetchCba('/api/Account/GetTransactions', { query });
}

/**
 * Peer-to-peer funds movement: debits FromAccountNumber and credits ToAccountNumber in one call.
 * This is the correct simulator API for “send money”, not Credit (Credit only adds to one ledger without debiting the sender).
 *
 * @param {object} payload FromAccountNumber, ToAccountNumber, Amount, RetrievalReference, Narration, AuthenticationKey
 */
function localFundsTransfer(payload) {
  return fetchCba('/thirdpartyapiservice/apiservice/CoreTransactions/LocalFundsTransfer', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Stateful simulator: POST /api/Account/CreateCustomerAndAccount
 * @param {object} body TransactionTrackingRef, ProductCode, PhoneNo, BVN, etc.
 */
function createCustomerAndAccount(body) {
  return fetchCba('/api/Account/CreateCustomerAndAccount', {
    method: 'POST',
    query: { authToken: config.cbaAuthToken },
    body,
  });
}

/**
 * POST AccountEnquiry — NUBAN lookup with customer info (third-party path; body auth).
 * @param {string} accountNo 10-digit NUBAN
 */
function accountEnquiry(accountNo) {
  return fetchCba('/thirdpartyapiservice/apiservice/Account/AccountEnquiry', {
    method: 'POST',
    body: {
      AuthenticationCode: config.cbaAuthToken,
      AccountNo: String(accountNo || '').trim(),
    },
  });
}

module.exports = {
  fetchCba,
  normalizeCustomerIdForCba,
  getCustomerByPhoneNumber,
  getAccountsByCustomerId,
  getAccountByTransactionTrackingRef,
  getTransactions,
  localFundsTransfer,
  createCustomerAndAccount,
  accountEnquiry,
};
