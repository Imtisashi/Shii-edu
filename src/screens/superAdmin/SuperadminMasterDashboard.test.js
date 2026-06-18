/* global describe, expect, it */

const fs = require('fs');
const path = require('path');

describe('Superadmin master dashboard motion stability', () => {
  it('does not use animated layout primitives that can jitter the dashboard', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'screens', 'superAdmin', 'SuperadminMasterDashboard.js'),
      'utf8'
    );

    expect(source).not.toContain('Animated');
    expect(source).not.toContain('useNativeDriver');
    expect(source).not.toContain('onLayout={(event) => setWidth');
  });

  it('requires payout bank details when creating an institute', () => {
    const dashboard = fs.readFileSync(
      path.join(process.cwd(), 'src', 'screens', 'superAdmin', 'SuperadminMasterDashboard.js'),
      'utf8'
    );
    const service = fs.readFileSync(
      path.join(process.cwd(), 'src', 'services', 'firebaseAdminService.js'),
      'utf8'
    );

    expect(dashboard).toContain('bankAccountHolderName');
    expect(dashboard).toContain('bankAccountNumber');
    expect(dashboard).toContain('bankIfsc');
    expect(dashboard).toContain('Bank details are required for institute payout setup.');
    expect(service).toContain('payoutBankAccount');
  });
});
