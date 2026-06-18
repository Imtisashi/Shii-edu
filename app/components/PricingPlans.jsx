import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'next/react';

export default function PricingPlans() {
  const { subscription, isLoading } = useSubscription();

  if (isLoading) {
    return <div>Loading subscription information...</div>;
  }

  const currentTier = subscription?.tier || 'free';

  const plans = [
    {
      id: 'free',
      label: 'Free',
      price: '$0',
      description: 'Basic institute operations with limited features',
      features: [
        'Core institute operations',
        'Up to 100 users',
        '1 GB storage',
        'Community support'
      ],
      limits: {
        aiRequestsPerDay: 0,
        storageQuotaGB: 1,
        smsQuotaPerMonth: 0
      },
      recommended: false
    },
    {
      id: 'pro',
      label: 'Pro',
      price: '$49',
      description: 'Everything in Free plus AI tools, bus tracking, and priority support',
      features: [
        'Everything in Free',
        'AI tools (100 requests/day)',
        'Bus tracking',
        'Advanced reports',
        'Priority support',
        'Up to 500 users',
        '10 GB storage',
        '100 SMS/month'
      ],
      limits: {
        aiRequestsPerDay: 100,
        storageQuotaGB: 10,
        smsQuotaPerMonth: 100
      },
      recommended: true
    },
    {
      id: 'enterprise',
      label: 'Enterprise',
      price: '$249',
      description: 'Everything in Pro plus advanced analytics, white-labeling, API access, and dedicated support',
      features: [
        'Everything in Pro',
        'Advanced analytics dashboard',
        'White-labeling & custom domain',
        'API access for SIS/LMS integrations',
        'Marketplace access',
        'Dedicated account manager',
        'Unlimited users',
        '100 GB storage',
        '5,000 SMS/month'
      ],
      limits: {
        aiRequestsPerDay: 1000,
        storageQuotaGB: 100,
        smsQuotaPerMonth: 5000
      },
      recommended: false
    }
  ];

  return (
    <section className="pricing-plans">
      <h2 className="pricing-title">Choose Your Plan</h2>
      <p className="pricing-subtitle">
        Select the plan that fits your institute's needs. All plans are billed annually.
      </p>
      <div className="pricing-cards">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`pricing-card ${plan.id === currentTier ? 'active' : ''} ${plan.recommended ? 'recommended' : ''}`}
          >
            <h3>{plan.label}</h3>
            <p className="pricing-price">{plan.price} <span className="pricing-period">/ month</span></p>
            <p className="pricing-description">{plan.description}</p>
            <ul className="pricing-features">
              {plan.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
            {plan.id !== currentTier ? (
              <Link
                href={`/api/subscription?plan=${plan.id}`}
                passHref
                className="pricing-button"
              >
                Choose {plan.label}
              </Link>
            ) : (
              <p className="pricing-active">Current plan</p>
            )}
          </div>
        ))}
      </div>
      <p className="pricing-footer">
        * All plans include access to core features. Overage charges may apply for AI requests, storage, and SMS.
      </p>
    </section>
  );
}