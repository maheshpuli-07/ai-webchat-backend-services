const { extractAccountsArray, primaryAccountNumber } = require('../cba/cbaBankingRepository');

/**
 * @param {object | undefined | null} auth
 */
function displayUserName(auth) {
  if (auth && auth.username != null && String(auth.username).trim()) {
    return String(auth.username).trim();
  }
  if (auth && auth.sub != null && String(auth.sub).trim()) {
    return String(auth.sub).trim();
  }
  return 'there';
}

/**
 * @param {object | null | undefined} record
 * @param {string[]} keys
 */
function pick(record, keys) {
  if (!record || typeof record !== 'object') return '';
  for (const k of keys) {
    if (record[k] != null && String(record[k]).trim() !== '') {
      return String(record[k]).trim();
    }
  }
  return '';
}

/**
 * @param {object | null | undefined} record
 */
function otherNamesFrom(record) {
  const direct = pick(record, [
    'OtherNames',
    'otherNames',
    'OtherName',
    'otherName',
    'FirstName',
    'firstName',
    'GivenName',
    'givenName',
  ]);
  if (direct) return direct;
  const mid = pick(record, ['MiddleName', 'middleName']);
  return mid || '';
}

/**
 * Required-style fields for manager-facing summaries: last name, other names, customer id, accounts, mobile.
 * @param {object | null | undefined} record
 * @returns {{ lastName: string, otherNames: string, customerId: string, mobileNumber: string, accountNumbers: string[] }}
 */
function summarizeCustomerRecord(record) {
  const lastName = pick(record, ['LastName', 'lastName', 'Surname', 'surname']);
  const otherNames = otherNamesFrom(record);
  const customerId = pick(record, [
    'CustomerId',
    'customerId',
    'CustomerID',
    'customerID',
    'CustId',
    'custId',
  ]);
  const mobileNumber = pick(record, [
    'PhoneNumber',
    'phoneNumber',
    'MobilePhone',
    'mobilePhone',
    'GSM',
    'gsm',
    'Phone',
    'phone',
    'Mobile',
    'mobile',
    'MobileNumber',
    'mobileNumber',
  ]);

  let accounts = [];
  if (record && typeof record === 'object') {
    if (Array.isArray(record.Accounts)) accounts = record.Accounts;
    else if (Array.isArray(record.accounts)) accounts = record.accounts;
  }

  const accountNumbers = [];
  for (const row of accounts) {
    if (row && typeof row === 'object') {
      const id = primaryAccountNumber(row);
      if (id) accountNumbers.push(id);
    }
  }

  return { lastName, otherNames, customerId, mobileNumber, accountNumbers };
}

/** Plain summary line for the spoken-style `reply` field. */
function formatSummarySentencePlain(s) {
  const parts = [];
  if (s.lastName) parts.push(`last name ${s.lastName}`);
  if (s.otherNames) parts.push(`other names ${s.otherNames}`);
  if (s.customerId) parts.push(`customer ID ${s.customerId}`);
  if (s.mobileNumber) parts.push(`mobile ${s.mobileNumber}`);
  if (s.accountNumbers.length) {
    parts.push(`account number(s) ${s.accountNumbers.join(', ')}`);
  }
  if (!parts.length) return '';
  return `I’ve got ${parts.join(', ')} on file for you.`;
}

/**
 * @param {unknown} json
 * @returns {object[]}
 */
function unwrapCustomerRecords(json) {
  if (json == null) return [];
  if (Array.isArray(json)) {
    return json.filter((x) => x && typeof x === 'object');
  }
  if (typeof json !== 'object') return [];
  const inner = json.Data || json.data || json.Result || json.Value || json.Customer || json.customer;
  if (Array.isArray(inner)) {
    return inner.filter((x) => x && typeof x === 'object');
  }
  if (inner && typeof inner === 'object') {
    return [inner];
  }
  return [json];
}

/**
 * @param {unknown} json
 * @param {object | undefined} auth
 */
function humanCustomerByPhoneReply(json, auth) {
  const name = displayUserName(auth);
  const records = unwrapCustomerRecords(json);
  if (records.length === 0) {
    return {
      reply: `Hey ${name} — I couldn’t make sense of that response. Want to try again, or check the simulator?`,
      customerDetails: [],
    };
  }

  const summaries = records.map(summarizeCustomerRecord);
  if (summaries.length === 1) {
    const plain = formatSummarySentencePlain(summaries[0]);
    const body = plain || 'The record did not include the usual name and account fields.';
    return {
      reply: `Hi ${name} — here’s what came back for that number. ${body}`,
      customerDetails: summaries,
    };
  }

  const chunks = summaries.map((s, i) => {
    const p = formatSummarySentencePlain(s);
    return p ? `Customer ${i + 1}: ${p}` : `Customer ${i + 1}: (limited fields in response)`;
  });
  return {
    reply: `Hi ${name} — here’s what I found: ${chunks.join(' ')}`,
    customerDetails: summaries,
  };
}

/**
 * @param {unknown} json
 * @param {string} contextCustomerId
 * @param {object | undefined} auth
 */
function humanAccountsListReply(json, contextCustomerId, auth) {
  const name = displayUserName(auth);
  const { accounts } = extractAccountsArray(json);
  const nums = accounts.map((row) => primaryAccountNumber(row)).filter(Boolean);

  let topRecord = null;
  if (Array.isArray(json) && json[0] && typeof json[0] === 'object') {
    topRecord = json[0];
  } else if (json && typeof json === 'object' && !Array.isArray(json)) {
    topRecord = json.Customer || json.customer || json;
  }

  const fromTop = topRecord ? summarizeCustomerRecord(topRecord) : null;
  const cid =
    (fromTop && fromTop.customerId) || contextCustomerId || '';

  if (
    fromTop &&
    (fromTop.lastName ||
      fromTop.otherNames ||
      fromTop.mobileNumber ||
      fromTop.customerId ||
      fromTop.accountNumbers.length)
  ) {
    const plain = formatSummarySentencePlain(fromTop);
    return {
      reply: `Hi ${name} — pulled the account details for this customer. ${plain || `Customer ID ${cid || '—'}.`}`,
      customerDetails: [fromTop],
    };
  }

  const acctLine = nums.length
    ? `Account number(s): ${nums.join(', ')}.`
    : 'No account rows were returned.';
  return {
    reply: `Hi ${name} — for customer ${cid || 'this profile'}, ${acctLine}`,
    customerDetails: [
      {
        lastName: '',
        otherNames: '',
        customerId: cid,
        mobileNumber: '',
        accountNumbers: nums,
      },
    ],
  };
}

/**
 * @param {object} json
 */
function flattenCustomerNested(json) {
  const c = json.Customer || json.customer;
  if (c && typeof c === 'object') {
    return {
      ...c,
      ...json,
      Accounts: json.Accounts || json.accounts || c.Accounts || c.accounts,
    };
  }
  return json;
}

/**
 * @param {unknown} json
 * @param {object | undefined} auth
 */
function humanAccountByTrackingRefReply(json, auth) {
  const name = displayUserName(auth);
  if (!json || typeof json !== 'object') {
    return {
      reply: `Hi ${name} — I couldn’t get usable account info for that tracking reference.`,
      customerDetails: [],
    };
  }
  const flat = flattenCustomerNested(json);
  const s = summarizeCustomerRecord(flat);
  const plain = formatSummarySentencePlain(s);
  const acct = pick(flat, ['AccountNumber', 'NUBAN', 'accountNumber', 'nuban']);
  if (acct && !s.accountNumbers.includes(acct)) {
    s.accountNumbers = [acct, ...s.accountNumbers];
  }
  const body =
    plain ||
    (acct ? `Account number ${acct} is linked to this reference.` : 'Here is what the simulator returned for that reference.');
  return {
    reply: `Hi ${name} — from that transaction reference, ${body.charAt(0).toLowerCase()}${body.slice(1)}`,
    customerDetails: [s],
  };
}

/**
 * @param {object | undefined} auth
 * @param {string} balanceLine
 */
function humanBalanceReply(auth, balanceLine) {
  const n = displayUserName(auth);
  return `Hi ${n}, ${balanceLine}`;
}

/**
 * Format CBA AccountEnquiry JSON for chat.
 * @param {object | null | undefined} json
 * @param {object | undefined} auth
 * @param {string} requestedNuban
 */
function humanAccountEnquiryReply(json, auth, requestedNuban) {
  const name = displayUserName(auth);
  const j = json && typeof json === 'object' ? json : {};
  const ok =
    j.IsSuccessful === true ||
    j.IsSuccessful === 'true' ||
    j.RequestStatus === true ||
    j.RequestStatus === 'true';
  if (!ok) {
    const msg =
      j.ResponseMessage != null
        ? String(j.ResponseMessage)
        : j.ResponseDescription != null
          ? String(j.ResponseDescription)
          : j.Message != null
            ? String(j.Message)
            : 'Account enquiry did not return a successful result.';
    return {
      reply: `Hi ${name} — ${msg}`,
      customerDetails: [],
    };
  }

  const nuban = j.Nuban != null ? String(j.Nuban) : requestedNuban;
  const acctName = j.Name != null ? String(j.Name) : '';
  const fmtBal = (v) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(v);
  };
  const avail = fmtBal(j.AvailableBalance);
  const ledger = fmtBal(j.LedgerBalance);
  const status = j.Status != null ? String(j.Status) : '';
  const product = j.ProductCode != null ? String(j.ProductCode) : '';
  const phone = j.PhoneNo != null ? String(j.PhoneNo) : j.PhoneNuber != null ? String(j.PhoneNuber) : '';
  const bvn = j.BVN != null ? String(j.BVN) : '';

  return {
    reply: `Hi ${name} — here are the account details below.`,
    customerDetails: [
      {
        lastName: '',
        otherNames: acctName,
        customerId: '',
        bvn: bvn || undefined,
        mobileNumber: phone,
        accountNumbers: nuban ? [nuban] : [],
        productCode: product,
        availableBalance: avail,
        ledgerBalance: ledger,
        accountStatus: status,
      },
    ],
  };
}

module.exports = {
  displayUserName,
  summarizeCustomerRecord,
  humanCustomerByPhoneReply,
  humanAccountsListReply,
  humanAccountByTrackingRefReply,
  humanBalanceReply,
  humanAccountEnquiryReply,
};
