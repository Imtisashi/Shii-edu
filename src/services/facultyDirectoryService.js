import { authenticatedFetch } from './apiClient';

export const fetchFacultyDirectory = async (currentUser) => {
  const response = await authenticatedFetch('/api/institute/faculty', currentUser, {
    method: 'POST',
    retryCount: 1,
  });

  return Array.isArray(response.faculty) ? response.faculty : [];
};
