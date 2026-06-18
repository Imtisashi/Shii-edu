const handler = require('./record-payment');

describe('offline fee payment audit helpers', () => {
  it('keeps the visible student ID on payment and allocation audit records', () => {
    const student = {
      id: 'uid-a',
      loginId: '260602',
      name: 'Test Student',
    };
    const allocation = handler.__test.buildAllocationAudit({
      allocationMinor: 5000,
      invoice: { id: 'invoice-1' },
      student,
    });

    expect(handler.__test.getStudentLedgerId(student)).toBe('260602');
    expect(allocation).toEqual({
      amountMinor: 5000,
      invoiceId: 'invoice-1',
      studentId: '260602',
      studentName: 'Test Student',
      studentUid: 'uid-a',
    });
  });
});
