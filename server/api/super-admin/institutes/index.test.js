/* global describe, expect, it */

const handler = require('./index');

describe('super-admin institute payout bank validation', () => {
  it('normalizes payout bank account without retaining raw account numbers', () => {
    const normalizePayoutBankAccount = handler.__test?.normalizePayoutBankAccount;

    expect(typeof normalizePayoutBankAccount).toBe('function');

    const normalized = normalizePayoutBankAccount({
      accountHolderName: 'Shii Public School',
      accountNumber: '1234 5678 9012',
      bankName: 'State Bank',
      ifsc: 'SBIN0123456',
    }, 'inst_123');

    expect(normalized.accountHolderName).toBe('Shii Public School');
    expect(normalized.bankName).toBe('State Bank');
    expect(normalized.ifsc).toBe('SBIN0123456');
    expect(normalized.accountNumberLast4).toBe('9012');
    expect(normalized.accountNumber).toBeUndefined();
    expect(normalized.rawAccountStored).toBe(false);
    expect(normalized.accountNumberFingerprint).toHaveLength(64);
  });

  it('rejects invalid payout bank account fields', () => {
    const normalizePayoutBankAccount = handler.__test?.normalizePayoutBankAccount;

    expect(() => normalizePayoutBankAccount({
      accountHolderName: 'A',
      accountNumber: '123',
      bankName: '',
      ifsc: 'BAD',
    }, 'inst_123')).toThrow(/bank account/i);
  });
});
