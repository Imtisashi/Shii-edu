const handler = require('./index');

describe('admin user creation multi-child parent helpers', () => {
  it('normalizes comma, newline, and array linked student IDs', () => {
    expect(handler.__test.parseLinkedStudentIds({
      linkedStudentIds: ['260602', '260603'],
      primaryTag: '260602, 260604\n260603',
    })).toEqual(['260602', '260604', '260603']);
  });

  it('builds a parent profile with legacy first child fields and multi-child fields', () => {
    const profile = handler.__test.buildParentLinkFields([
      { uid: 'uid-a', loginId: '260602', name: 'First Child' },
      { uid: 'uid-b', uniqueId: '260603', name: 'Second Child' },
    ], 'Mother');

    expect(profile.linkedStudentUid).toBe('uid-a');
    expect(profile.linkedStudentUserId).toBe('260602');
    expect(profile.childUids).toEqual(['uid-a', 'uid-b']);
    expect(profile.linkedStudents).toEqual([
      { name: 'First Child', uid: 'uid-a', userId: '260602' },
      { name: 'Second Child', uid: 'uid-b', userId: '260603' },
    ]);
  });
});
