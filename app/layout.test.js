const fs = require('fs');
const path = require('path');

describe('Next root layout asset policy', () => {
  it('does not import Bootstrap into the production shell', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'layout.jsx'), 'utf8');

    expect(source).not.toMatch(/bootstrap\/dist\/css\/bootstrap\.min\.css/);
  });
});
