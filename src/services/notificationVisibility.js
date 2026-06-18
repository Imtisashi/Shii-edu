import { collection, query, where } from 'firebase/firestore';

const ROLE_FILTERS = ['student', 'teacher', 'admin', 'parent', 'driver'];

export const normalizeNotificationRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return ROLE_FILTERS.includes(normalized) ? normalized : 'student';
};

export const isNotificationAuditor = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'superadmin';
};

export const getParentRecipientUids = (userData = {}) => {
  const uids = [
    userData.linkedStudentUid,
    ...(Array.isArray(userData.childUids) ? userData.childUids : []),
    ...(Array.isArray(userData.linkedStudents)
      ? userData.linkedStudents.map((student) => student?.uid || student?.studentUid || student?.id)
      : []),
  ]
    .map((uid) => String(uid || '').trim())
    .filter(Boolean);

  return [...new Set(uids)];
};

export const notificationMatchesAudience = (notification, currentUser, userData) => {
  if (!notification || !currentUser?.uid || !userData?.role) return false;
  if (isNotificationAuditor(userData.role)) return true;

  const notificationRole = normalizeNotificationRole(userData.role);
  const targets = Array.isArray(notification.targetRoles) ? notification.targetRoles : [];
  const recipientUids = Array.isArray(notification.recipientUids) ? notification.recipientUids : [];
  const parentStudentMatch = userData.role === 'parent' &&
    getParentRecipientUids(userData).some((uid) => recipientUids.includes(uid));
  const recipientMatch = recipientUids.length === 0 ||
    recipientUids.includes(currentUser.uid) ||
    parentStudentMatch;

  return recipientMatch && (targets.includes(notificationRole) || targets.includes('all'));
};

export const buildVisibleNotificationQueries = ({ currentUser, db, userData }) => {
  if (!currentUser?.uid || !userData?.instituteId) return [];

  const notificationsRef = collection(db, 'notifications');
  const instituteFilter = where('instituteId', '==', userData.instituteId);

  if (isNotificationAuditor(userData.role)) {
    return [query(notificationsRef, instituteFilter)];
  }

  const role = normalizeNotificationRole(userData.role);
  const queries = [
    query(
      notificationsRef,
      instituteFilter,
      where('targetRoles', 'array-contains-any', [role, 'all']),
      where('recipientUids', '==', [])
    ),
    query(
      notificationsRef,
      instituteFilter,
      where('recipientUids', 'array-contains', currentUser.uid)
    ),
  ];

  if (userData.role === 'parent') {
    getParentRecipientUids(userData).slice(0, 10).forEach((childUid) => {
      queries.push(query(
        notificationsRef,
        instituteFilter,
        where('recipientUids', 'array-contains', childUid)
      ));
    });
  }

  return queries;
};

export const mergeNotificationSnapshots = (snapshots, currentUser, userData, limitCount = 50) => {
  const byId = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((document) => {
      byId.set(document.id, {
        id: document.id,
        ...document.data(),
      });
    });
  });

  return [...byId.values()]
    .filter((notification) => notificationMatchesAudience(notification, currentUser, userData))
    .sort((a, b) => {
      const left = createdAtToMillis(a.createdAt);
      const right = createdAtToMillis(b.createdAt);
      return right - left;
    })
    .slice(0, limitCount || undefined);
};

export const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};
