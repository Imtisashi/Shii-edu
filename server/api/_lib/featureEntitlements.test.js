/* global describe, expect, it */

const {
  buildFeatureSettings,
  isFeatureEnabled,
  normalizeFeatureTier,
  resolveFeatureEntitlements,
} = require('./featureEntitlements');

describe('feature entitlement subscription plans', () => {
  it('normalizes Basic, Pro, and Max as the canonical superadmin plans', () => {
    expect(normalizeFeatureTier('basic')).toBe('basic');
    expect(normalizeFeatureTier('pro')).toBe('pro');
    expect(normalizeFeatureTier('max')).toBe('max');
    expect(normalizeFeatureTier('free')).toBe('basic');
    expect(normalizeFeatureTier('enterprise')).toBe('max');

    expect(buildFeatureSettings({ tier: 'Max' })).toEqual(
      expect.objectContaining({ tier: 'max' })
    );
  });

  it('reports whether each effective entitlement comes from the plan or an institute override', () => {
    const access = resolveFeatureEntitlements({
      settings: {
        features: {
          tier: 'pro',
          overrides: {
            ai_agent: true,
            bus_tracking: false,
          },
        },
      },
    });

    expect(access.featureSources.ai_tools).toEqual({
      enabled: true,
      source: 'plan',
      tier: 'pro',
    });
    expect(access.featureSources.ai_agent).toEqual({
      enabled: true,
      source: 'override',
      tier: 'pro',
    });
    expect(access.featureSources.bus_tracking).toEqual({
      enabled: false,
      source: 'override',
      tier: 'pro',
    });
  });

  it('includes customization capabilities in the backend entitlement map', () => {
    const basic = resolveFeatureEntitlements({
      settings: { features: { tier: 'basic' } },
    });
    const max = resolveFeatureEntitlements({
      settings: { features: { tier: 'max' } },
    });

    expect(basic.enabledFeatures.custom_subdomain).toBe(false);
    expect(basic.featureSources.custom_subdomain).toEqual({
      enabled: false,
      source: 'plan',
      tier: 'basic',
    });
    expect(max.enabledFeatures.custom_subdomain).toBe(true);
    expect(max.featureSources.advanced_customization).toEqual({
      enabled: true,
      source: 'plan',
      tier: 'max',
    });
  });

  it('does not allow unknown feature keys by default', () => {
    expect(isFeatureEnabled({
      settings: { features: { tier: 'max' } },
    }, 'not_a_real_feature')).toBe(false);
  });
});
