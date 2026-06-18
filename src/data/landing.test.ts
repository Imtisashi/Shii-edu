import { landingContent } from './landing';

describe('landing pricing content', () => {
  it('publishes a full Basic, Pro, and Max comparison for institute buyers', () => {
    expect(landingContent.pricing.comparison.length).toBeGreaterThanOrEqual(10);

    const aspects = landingContent.pricing.comparison.map((row) => row.aspect);
    expect(aspects).toEqual(expect.arrayContaining([
      'Core role apps',
      'Transport',
      'AI usage ceiling',
      'Custom subdomain',
      'Best fit',
    ]));

    landingContent.pricing.comparison.forEach((row) => {
      expect(row.basic).toEqual(expect.any(String));
      expect(row.pro).toEqual(expect.any(String));
      expect(row.max).toEqual(expect.any(String));
      expect(row.basic.trim()).not.toHaveLength(0);
      expect(row.pro.trim()).not.toHaveLength(0);
      expect(row.max.trim()).not.toHaveLength(0);
    });
  });
});
