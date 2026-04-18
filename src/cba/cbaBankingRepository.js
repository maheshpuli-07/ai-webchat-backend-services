const crypto = require('crypto');
const config = require('../config');
const cbaClient = require('./cbaClient');

function parsePayeeMap() {
  const raw = config.cbaPayeeAccountMapJson;
  if (!raw || !raw.trim()) return {};
  try {
    const o = JSON.parse(raw);
    return typeof o === 'object' && o !== null ? o : {};
  } catch {
    return {};
  }
}

/**
 * Payee from UI/chat: either a key in CBA_PAYEE_ACCOUNT_MAP (e.g. mahesh) or a raw 10-digit NUBAN.
 * @param {string} receiverRaw
 * @returns {string | null}
 */
function resolveDestinationNuban(receiverRaw) {
  const trimmed = String(receiverRaw || '').trim();
  if (!trimmed) return null;
  const map = parsePayeeMap();
  const fromMap = map[trimmed.toLowerCase()];
  if (fromMap != null && String(fromMap).trim() !== '') return String(fromMap).trim();

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return digits;

  return null;
}

/**
 * @param {unknown} s
 */
function parseMoneyString(s) {
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  const n = Number(String(s == null ? '' : s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * All NUBAN-like ids on an account row (CBA uses AccountNumber and/or NUBAN).
 * @param {object} row
 * @returns {string[]}
 */
function accountIdentifiers(row) {
  if (!row || typeof row !== 'object') return [];
  const nums = [row.AccountNumber, row.NUBAN, row.accountNumber, row.nuban]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());
  return [...new Set(nums)];
}

/**
 * Primary NUBAN for debits / display.
 * @param {object} row
 */
function primaryAccountNumber(row) {
  const ids = accountIdentifiers(row);
  return ids[0] || '';
}

/**
 * Normalize GetAccountsByCustomerId (and similar) payloads — some CBA builds return
 * a top-level array, wrap { Data: { Accounts } }, or HTTP 200 + IsSuccessful:false.
 * @param {unknown} json
 * @returns {{ accounts: object[], cbaMessage?: string }}
 */
function extractAccountsArray(json) {
  if (json == null) {
    return { accounts: [], cbaMessage: 'Empty CBA response' };
  }

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return { accounts: [], cbaMessage: 'No customer data (empty array)' };
    }
    const first = json[0];
    if (first && typeof first === 'object' && Array.isArray(first.Accounts)) {
      return { accounts: first.Accounts };
    }
    return { accounts: [], cbaMessage: 'Unexpected array shape from CBA' };
  }

  if (typeof json !== 'object') {
    return { accounts: [], cbaMessage: 'Unexpected CBA response type' };
  }

  const msg =
    json.Message != null
      ? String(json.Message)
      : json.ResponseMessage != null
        ? String(json.ResponseMessage)
        : undefined;

  if (json.IsSuccessful === false) {
    return { accounts: [], cbaMessage: msg || 'CBA returned IsSuccessful: false' };
  }

  const nested =
    json.Accounts ||
    json.accounts ||
    (json.Data && json.Data.Accounts) ||
    (json.data && (json.data.Accounts || json.data.accounts)) ||
    (json.Result && json.Result.Accounts) ||
    (json.Value && json.Value.Accounts) ||
    (json.Payload && json.Payload.Accounts) ||
    (json.Customer && json.Customer.Accounts) ||
    (json.customer && json.customer.Accounts) ||
    (json.ResponseData && json.ResponseData.Accounts);

  const accounts = Array.isArray(nested) ? nested : [];

  if (accounts.length === 0 && msg) {
    return { accounts: [], cbaMessage: msg };
  }

  return { accounts };
}

/**
 * Pick the row for the logged-in user: match JWT NUBAN to any account id, else sole account.
 * @param {object[]} accounts
 * @param {string} jwtNuban
 * @returns {{ row: object, usedFallback: boolean } | null}
 */
function pickSenderAccountRow(accounts, jwtNuban) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  const want = String(jwtNuban || '').trim();
  const exact = accounts.find(
    (a) => a && typeof a === 'object' && accountIdentifiers(a).some((id) => id === want),
  );
  if (exact) return { row: exact, usedFallback: false };
  if (accounts.length === 1 && accounts[0] && typeof accounts[0] === 'object') {
    return { row: accounts[0], usedFallback: true };
  }
  return null;
}

/**
 * @param {{ sub: string, customerId?: string, accountNumber?: string }} auth
 */
async function getAccount(auth) {
  const customerId = auth.customerId;
  if (!customerId) {
    const err = new Error('JWT missing customerId — use /auth/token with a configured user');
    err.statusCode = 403;
    throw err;
  }
  const { res, json } = await cbaClient.getAccountsByCustomerId(customerId);
  if (res.status === 404) return null;
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json.Message != null
        ? String(json.Message)
        : json && typeof json === 'object' && json.ResponseMessage != null
          ? String(json.ResponseMessage)
          : `CBA account request failed (${res.status})`;
    const err = new Error(msg);
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }

  const { accounts, cbaMessage } = extractAccountsArray(json);
  if (!accounts.length) {
    if (cbaMessage) {
      const err = new Error(cbaMessage);
      if (/unauthorized|invalid.*auth/i.test(cbaMessage)) err.statusCode = 401;
      else if (/not found/i.test(cbaMessage)) err.statusCode = 404;
      else err.statusCode = 502;
      throw err;
    }
    return null;
  }

  const picked = pickSenderAccountRow(accounts, auth.accountNumber);
  const row = picked?.row;
  if (!row || typeof row !== 'object') return null;

  const bal = parseMoneyString(row.AccountBalance);
  const balanceMinor = Number.isFinite(bal) ? Math.round(bal * 100) : 0;

  return {
    userId: auth.sub,
    balanceMinor,
    currency: config.cbaCurrency,
    accountNumber: primaryAccountNumber(row) || String(auth.accountNumber || '').trim(),
  };
}

/**
 * Resolves payee via CBA_PAYEE_ACCOUNT_MAP or a 10-digit NUBAN, then calls LocalFundsTransfer (not Credit).
 *
 * @param {{ auth: { sub: string, customerId?: string, accountNumber?: string }, receiverUsername: string, amountMinor: number }} p
 * `receiverUsername` is a misnomer: value is a payee alias or raw destination NUBAN (CBA has no bank username field).
 */
async function initiateTransfer(p) {
  const { auth, receiverUsername, amountMinor } = p;
  if (!auth.accountNumber) {
    return { ok: false, code: 'invalid_input', message: 'JWT missing accountNumber (NUBAN)' };
  }
  if (!auth.customerId) {
    return { ok: false, code: 'invalid_input', message: 'JWT missing customerId' };
  }
  if (!receiverUsername || !amountMinor) {
    return { ok: false, code: 'invalid_input', message: 'Missing transfer fields' };
  }

  const toAccountNumber = resolveDestinationNuban(receiverUsername);
  if (!toAccountNumber) {
    return {
      ok: false,
      code: 'receiver_not_found',
      message: `Unknown payee "${receiverUsername}". Either map this alias to a NUBAN in CBA_PAYEE_ACCOUNT_MAP in .env, or enter the payee's full 10-digit account number from the simulator (customer ids like 000168 are not valid here).`,
    };
  }

  let fromAccountNumber = String(auth.accountNumber).trim();
  let fromAccBalanceMinor = null;

  const { res: accRes, json: accJson } = await cbaClient.getAccountsByCustomerId(auth.customerId);
  if (!accRes.ok) {
    const msg =
      accJson && typeof accJson === 'object' && accJson.Message != null
        ? String(accJson.Message)
        : `CBA could not load accounts (${accRes.status})`;
    return { ok: false, code: 'upstream_error', message: msg };
  }

  const { accounts, cbaMessage } = extractAccountsArray(accJson);
  if (!accounts.length) {
    return {
      ok: false,
      code: 'account_not_found',
      message:
        cbaMessage ||
        `No accounts returned from CBA for customer ${auth.customerId}. Align CBA_USERS_* customerId with the simulator, or create the customer in CBA.`,
    };
  }

  const picked = pickSenderAccountRow(accounts, auth.accountNumber);
  if (!picked) {
    const list = accounts
      .map((a) => (a && typeof a === 'object' ? accountIdentifiers(a)[0] || '?' : '?'))
      .join(', ');
    return {
      ok: false,
      code: 'account_not_found',
      message: list
        ? `JWT NUBAN ${fromAccountNumber} does not match CBA for customer ${cbaClient.normalizeCustomerIdForCba(auth.customerId)}. Simulator accounts: ${list}. Update CBA_USERS_* / JWT or use accounts from the simulator.`
        : `No accounts returned from CBA for customer ${auth.customerId}.`,
    };
  }

  fromAccountNumber = primaryAccountNumber(picked.row);
  if (!fromAccountNumber) {
    return { ok: false, code: 'account_not_found', message: 'CBA account row has no AccountNumber/NUBAN' };
  }

  if (picked.usedFallback) {
    // eslint-disable-next-line no-console
    console.warn(
      `[transfer] JWT NUBAN ${auth.accountNumber} not in CBA; using sole simulator account ${fromAccountNumber}`,
    );
  }

  const bal = parseMoneyString(picked.row.AccountBalance);
  if (Number.isFinite(bal)) {
    fromAccBalanceMinor = Math.round(bal * 100);
  }

  if (String(toAccountNumber).trim() === fromAccountNumber) {
    return { ok: false, code: 'invalid_receiver', message: 'Cannot transfer to yourself' };
  }

  if (fromAccBalanceMinor != null && fromAccBalanceMinor < amountMinor) {
    return { ok: false, code: 'insufficient_funds', message: 'Insufficient balance' };
  }

  const major = amountMinor / 100;
  const amountMajorStr = Number.isInteger(major) ? String(major) : major.toFixed(2);
  const retrievalReference = `lft_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  const body = {
    FromAccountNumber: fromAccountNumber,
    ToAccountNumber: String(toAccountNumber),
    Amount: amountMajorStr,
    RetrievalReference: retrievalReference,
    Narration: 'Assistant local funds transfer',
    AuthenticationKey: config.cbaAuthToken,
  };

  let res;
  let json;
  try {
    ({ res, json } = await cbaClient.localFundsTransfer(body));
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      ok: false,
      code: aborted ? 'timeout' : 'upstream_error',
      message: aborted ? 'CBA simulator timeout' : e instanceof Error ? e.message : 'Transfer failed',
    };
  }

  const success =
    json &&
    typeof json === 'object' &&
    (json.IsSuccessful === true || json.IsSuccessful === 'true');
  const msg =
    json && typeof json === 'object' && json.ResponseMessage != null
      ? String(json.ResponseMessage)
      : 'Transfer failed';

  if (!res.ok || !success) {
    let code =
      /insufficient/i.test(msg) || (json && String(json.ResponseCode) === '51')
        ? 'insufficient_funds'
        : 'upstream_error';
    let outMsg = msg;
    if (code === 'upstream_error' && /account not found|invalid account|unknown account/i.test(msg)) {
      outMsg = `${msg} — Check that FromAccountNumber (${fromAccountNumber}) and ToAccountNumber (${String(toAccountNumber)}) exist in the CBA simulator and that payee NUBANs in CBA_PAYEE_ACCOUNT_MAP match.`;
    }
    return { ok: false, code, message: outMsg };
  }

  const ref =
    json && typeof json === 'object' && json.Reference != null ? String(json.Reference) : retrievalReference;

  return {
    ok: true,
    code: 'success',
    transferId: ref,
    amountMinor,
    currency: config.cbaCurrency,
    destinationNuban: String(toAccountNumber),
    receiver: {
      username: receiverUsername,
      displayName: receiverUsername,
    },
  };
}

module.exports = {
  getAccount,
  initiateTransfer,
  extractAccountsArray,
  primaryAccountNumber,
  accountIdentifiers,
};
