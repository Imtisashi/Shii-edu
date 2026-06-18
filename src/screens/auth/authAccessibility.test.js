/* global describe, expect, it */

const fs = require('fs');
const path = require('path');

describe('auth screen accessibility contracts', () => {
  const loginSource = () =>
    fs.readFileSync(path.join(process.cwd(), 'src', 'screens', 'auth', 'LoginScreen.js'), 'utf8');

  const registerSource = () =>
    fs.readFileSync(path.join(process.cwd(), 'src', 'screens', 'auth', 'RegisterScreen.js'), 'utf8');

  it('keeps the superadmin login controls labelled for assistive technology', () => {
    const source = loginSource();

    expect(source).toContain('accessibilityLabel="User ID or email"');
    expect(source).toContain("accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}");
    expect(source).toContain("accessibilityRole=\"checkbox\"");
    expect(source).toContain('accessibilityState={{ checked: rememberMe }}');
  });

  it('keeps registration help reachable from auth without guessing support details', () => {
    const source = loginSource();

    expect(source).toContain('Contact for Registration');
    expect(source).toContain('mailto:sashimiofficials@gmail.com');
  });

  it('labels invite registration form fields and primary actions', () => {
    const source = registerSource();

    expect(source).toContain('accessibilityLabel="Full name"');
    expect(source).toContain('accessibilityLabel="Email address"');
    expect(source).toContain('accessibilityLabel="Password"');
    expect(source).toContain('accessibilityLabel="Confirm password"');
    expect(source).toContain('accessibilityLabel="Create account"');
  });
});
