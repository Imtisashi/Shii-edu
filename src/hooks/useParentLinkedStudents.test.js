import {
  getParentChildReferences,
  studentMatchesParentReference,
} from './useParentLinkedStudents';

describe('parent linked student helpers', () => {
  it('dedupes linked students from legacy single-child and multi-child profiles', () => {
    const refs = getParentChildReferences({
      childUids: ['uid-a', 'uid-b', 'uid-a'],
      linkedStudentUid: 'uid-a',
      linkedStudentUserId: '260602',
      linkedStudents: [
        { uid: 'uid-b', userId: '260603', name: 'Second Child' },
        { studentUid: 'uid-c', studentId: '260604' },
      ],
    });

    expect(refs).toEqual([
      { uid: 'uid-a', userId: '260602', name: '' },
      { uid: 'uid-b', userId: '260603', name: 'Second Child' },
      { uid: 'uid-c', userId: '260604', name: '' },
    ]);
  });

  it('matches children by Firebase UID or visible student ID', () => {
    const ref = { uid: 'uid-a', userId: '260602' };

    expect(studentMatchesParentReference({ id: 'uid-a' }, ref)).toBe(true);
    expect(studentMatchesParentReference({ loginId: '260602' }, ref)).toBe(true);
    expect(studentMatchesParentReference({ uniqueId: '260602' }, ref)).toBe(true);
    expect(studentMatchesParentReference({ studentId: '260602' }, ref)).toBe(true);
    expect(studentMatchesParentReference({ loginIdKey: '260602' }, ref)).toBe(true);
    expect(studentMatchesParentReference({ loginId: 'other' }, ref)).toBe(false);
  });
});
