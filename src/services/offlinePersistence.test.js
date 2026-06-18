/* global beforeEach, describe, expect, it, jest */

describe('installFirestoreOfflinePersistence', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not reconfigure IndexedDB persistence after Firestore localCache is configured', async () => {
    const enableIndexedDbPersistence = jest.fn(() => Promise.resolve(true));

    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));
    jest.doMock('firebase/firestore', () => ({
      enableIndexedDbPersistence,
      getFirestore: jest.fn(),
    }));

    const { installFirestoreOfflinePersistence } = require('./offlinePersistence');

    await expect(installFirestoreOfflinePersistence()).resolves.toBe(true);
    expect(enableIndexedDbPersistence).not.toHaveBeenCalled();
  });
});
