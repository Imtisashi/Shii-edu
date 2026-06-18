/* global describe, expect, it */

const fs = require('fs');
const path = require('path');

describe('role app showcase configuration', () => {
  it('keeps Superadmin out of the public role chooser', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'roles', 'RoleAppShowcase.jsx'), 'utf8');

    expect(source).toContain("key: 'institute'");
    expect(source).toContain("key: 'parents'");
    expect(source).toContain("key: 'driver'");
    expect(source).not.toContain("key: 'superadmin'");
    expect(source).not.toContain('/app/superadmin');
    expect(source).not.toContain('shii-edu-superadmin.apk');
    expect(source).not.toContain('Shii-Edu-Superadmin.exe');
  });

  it('keeps the role chooser stable instead of swapping cards on hover or pointer movement', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'roles', 'RoleAppShowcase.jsx'), 'utf8');
    const styles = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');

    expect(source).not.toContain('onPointerMove');
    expect(source).not.toContain('onMouseEnter');
    expect(source).not.toContain('setActiveIndex(index)');
    expect(styles).toContain('role-app-showcase-grid');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(styles).not.toMatch(/\.role-app-card\.is-dimmed[\s\S]*?pointer-events:\s*none;/);
  });
});
