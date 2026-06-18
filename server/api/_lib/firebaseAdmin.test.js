const {
  assertBearerTokenFormat,
  assertDecodedTokenFresh,
} = require('./firebaseAdmin');

describe('firebase admin auth hardening helpers', () => {
  it('rejects malformed bearer tokens before Firebase verification', () => {
    expect(() => assertBearerTokenFormat('abc.def')).toThrow('Invalid Firebase ID token format.');
    expect(() => assertBearerTokenFormat('abc.def.ghi')).not.toThrow();
  });

  it('rejects decoded tokens older than the maximum accepted session age', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    expect(() => assertDecodedTokenFresh({ auth_time: nowSeconds - (25 * 60 * 60) })).toThrow(
      'Firebase ID token is too old. Sign in again.'
    );
    expect(() => assertDecodedTokenFresh({ auth_time: nowSeconds - 60 })).not.toThrow();
  });
});
