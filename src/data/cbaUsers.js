/**
 * Built-in demo users (fallback when CBA_USERS_FILE / CBA_USERS_JSON are not set).
 * For real simulator data use cba-users.json — see cba-users.example.json and cbaUserRegistry.js.
 */
const usersByUsername = new Map(
  Object.entries({
    alice: {
      id: 'usr_alice',
      username: 'alice',
      displayName: 'Alice',
      password: 'alice123',
      customerId: '075529',
      accountNumber: '1100755299',
    },
    mahesh: {
      id: 'usr_mahesh',
      username: 'mahesh',
      displayName: 'Mahesh',
      password: 'mahesh123',
      customerId: '000168',
      accountNumber: '1101425367',
    },
    bob: {
      id: 'usr_bob',
      username: 'bob',
      displayName: 'Bob',
      password: 'bob123',
      customerId: '031385',
      accountNumber: '1100313855',
    },
  }),
);

function getUserByUsername(username) {
  if (!username) return null;
  return usersByUsername.get(String(username).toLowerCase()) || null;
}

module.exports = { usersByUsername, getUserByUsername };
