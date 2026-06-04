import type { User } from 'firebase/auth';
import { authenticatedFetch } from './apiClient';

export const ensureInstituteClaims = async (currentUser: User): Promise<void> => {
  const tokenResult = await currentUser.getIdTokenResult();
  const claims = tokenResult.claims || {};
  if (claims.instituteVerified === true && claims.instituteId && claims.role) return;

  await authenticatedFetch('/api/auth/institute-claims', currentUser, {
    method: 'POST',
    retryCount: 1,
  });
  await currentUser.getIdToken(true);
};
