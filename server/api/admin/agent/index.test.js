const createResponse = () => {
  const res = {
    body: null,
    headers: {},
    statusCode: 200,
    json: jest.fn((value) => {
      res.body = value;
      return res;
    }),
    setHeader: jest.fn((key, value) => {
      res.headers[key] = value;
    }),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
  };
  return res;
};

describe('admin agent usage limits', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('charges the Max admin agent against the daily AI usage counter before running reports', async () => {
    const docs = [];
    const firestore = {
      collection: jest.fn((name) => ({
        add: jest.fn(() => Promise.resolve()),
        where: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn(() => Promise.resolve({ docs, size: docs.length })),
            })),
          })),
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ docs, size: docs.length })),
          })),
        })),
      })),
    };
    const assertAiDailyUsage = jest.fn(() => Promise.resolve({ limit: 1500, requestCount: 1 }));

    jest.doMock('../../_lib/firebaseAdmin', () => ({
      admin: {
        firestore: {
          FieldValue: {
            serverTimestamp: jest.fn(() => 'server-time'),
          },
        },
      },
      authenticateUserProfile: jest.fn(() => Promise.resolve({
        profile: { instituteId: 'TESTSC' },
        role: 'admin',
        uid: 'admin-uid',
      })),
      createRequestId: jest.fn(() => 'request-1'),
      getAdminServices: jest.fn(() => ({ firestore })),
      getBody: jest.fn(() => Promise.resolve({
        exportFormat: 'none',
        prompt: 'Fetch students with attendance below 75%',
      })),
      handleOptions: jest.fn(() => false),
      sendError: jest.fn((res, error) => res.status(error.statusCode || 500).json({ success: false })),
      setCorsHeaders: jest.fn(),
    }));
    jest.doMock('../../_lib/featureEntitlements', () => ({
      assertFeatureEnabled: jest.fn(() => Promise.resolve()),
    }));
    jest.doMock('../../_lib/rateLimit', () => ({
      assertRateLimit: jest.fn(() => Promise.resolve()),
    }));
    jest.doMock('../../_lib/subscriptionEntitlements', () => ({
      assertAiDailyUsage,
    }));

    const handler = require('./index');
    const req = { headers: {}, method: 'POST', socket: {}, url: '/api/admin/agent' };
    const res = createResponse();

    await handler(req, res);

    expect(assertAiDailyUsage).toHaveBeenCalledWith(expect.objectContaining({
      featureKey: 'ai_agent',
      instituteId: 'TESTSC',
      requestCount: 1,
    }));
    expect(res.statusCode).toBe(200);
  });
});
