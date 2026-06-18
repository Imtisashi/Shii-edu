import {
  buildVisibleNotificationQueries,
  notificationMatchesAudience,
} from './notificationVisibility';

describe('notification visibility for multi-child parents', () => {
  it('shows notifications addressed to any linked child UID', () => {
    const notification = {
      instituteId: 'TESTSC',
      recipientUids: ['child-2'],
      targetRoles: ['student', 'parent'],
    };

    expect(notificationMatchesAudience(
      notification,
      { uid: 'parent-1' },
      { childUids: ['child-1', 'child-2'], instituteId: 'TESTSC', role: 'parent' }
    )).toBe(true);
  });

  it('builds one recipient query per linked child plus the parent', () => {
    const queries = buildVisibleNotificationQueries({
      currentUser: { uid: 'parent-1' },
      db: {},
      userData: { childUids: ['child-1', 'child-2'], instituteId: 'TESTSC', linkedStudentUid: 'child-1', role: 'parent' },
    });

    expect(queries).toHaveLength(4);
  });
});
