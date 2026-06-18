import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe conditionally to prevent build errors when env vars are missing
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

// Mock function to get institute ID from request (replace with actual auth)
function getInstituteIdFromRequest(request) {
  // In a real app, you would get this from session, JWT, etc.
  // For now, we'll use a header or query param for demo
  const instituteId = request.headers.get('x-institute-id') ||
                     new URL(request.url).searchParams.get('instituteId');
  if (!instituteId) {
    throw new Error('Institute ID not found in request');
  }
  return instituteId;
}

// Mock function to get institute data from Firestore (replace with actual implementation)
async function getInstituteData(instituteId) {
  // This is a placeholder - replace with actual Firestore call
  // For demo, we'll return a mock object
  return {
    id: instituteId,
    settings: {
      tier: 'free', // default
      overrides: {}
    }
  };
}

// Mock function to update institute data in Firestore
async function updateInstituteData(instituteId, data) {
  // Replace with actual Firestore update
  return { id: instituteId, ...data };
}

// Plan pricing mapping (amount in cents for Stripe)
const PLAN_PRICING = {
  free: 0,
  pro: 4900, // $49.00
  enterprise: 24900 // $249.00
};

// Plan IDs for Stripe products (you would create these in Stripe Dashboard)
const PLAN_STRIPE_IDS = {
  free: 'price_free', // Actually, free plan doesn't need a Stripe price
  pro: 'price_pro_annual',
  enterprise: 'price_enterprise_annual'
};

export async function GET(request) {
  try {
    let instituteId;
    try {
      instituteId = getInstituteIdFromRequest(request);
    } catch (_e) {
      // No institute context (e.g. public landing page) — return safe default
      return NextResponse.json({
        tier: 'free',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }
    const instituteData = await getInstituteData(instituteId);
    const tier = instituteData.settings?.tier || 'free';

    return NextResponse.json({
      tier,
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const instituteId = getInstituteIdFromRequest(request);
    const { planId } = await request.json();

    if (!planId || !['free', 'pro', 'enterprise'].includes(planId)) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get current institute data
    const instituteData = await getInstituteData(instituteId);
    const currentTier = instituteData.settings?.tier || 'free';

    // If plan is free, just update locally (no Stripe)
    if (planId === 'free') {
      await updateInstituteData(instituteId, {
        settings: {
          ...instituteData.settings,
          tier: 'free',
          overrides: {}
        }
      });
      return NextResponse.json({ success: true, tier: 'free' });
    }

    // For paid plans, create a Stripe checkout session
    const stripePriceId = PLAN_STRIPE_IDS[planId];
    if (!stripePriceId) {
      throw new Error(`Stripe price not configured for plan ${planId}`);
    }

    if (!stripe) {
      throw new Error('Stripe is not configured on the server');
    }

    // In a real app, you would get or create a Stripe customer ID for the institute
    // For demo, we'll assume we have a function to get or create customer
    let customerId = instituteData.stripeCustomerId;
    if (!customerId) {
      // Create new customer
      const customer = await stripe.customers.create({
        email: instituteData.settings?.contactEmail || '',
        metadata: { instituteId }
      });
      customerId = customer.id;
      // Save customer ID to institute data
      await updateInstituteData(instituteId, {
        settings: {
          ...instituteData.settings,
          stripeCustomerId: customerId
        }
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL}/subscription?success=1`,
      cancel_url: `${process.env.NEXTAUTH_URL}/subscription?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

