import { authenticatedFetch, getApiBaseUrl } from './apiClient';

export type PasswordResetRole = 'driver' | 'institute' | 'parent';
export type PasswordResetStatus = 'approved' | 'pending' | 'rejected';

export type PasswordResetRequestRecord = {
  approvedAt?: string | null;
  contact: string;
  createdAt?: string | null;
  id: string;
  instituteId: string;
  note: string;
  rejectedAt?: string | null;
  rejectedReason: string;
  resetLinkAvailable: boolean;
  role: PasswordResetRole;
  status: PasswordResetStatus;
  updatedAt?: string | null;
  userId: string;
  userName: string;
};

export type PasswordResetTicket = {
  requestId: string;
  status: PasswordResetStatus;
  token: string;
};

export type PasswordResetStatusResult = {
  rejectedReason?: string;
  resetLink?: string;
  status: PasswordResetStatus;
  updatedAt?: string | null;
};

const PASSWORD_RESET_PATH = '/api/auth/password-reset';

const parseApiResponse = async (response: Response) => {
  const text = await response.text();
  let data: Record<string, unknown> = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok || data.success === false) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Password reset request failed.');
  }

  return data;
};

const publicPasswordResetFetch = async (body: Record<string, unknown>) => {
  const response = await fetch(`${getApiBaseUrl()}${PASSWORD_RESET_PATH}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  return parseApiResponse(response);
};

export const submitPasswordResetRequest = async ({
  contact = '',
  instituteId,
  note = '',
  role,
  userId,
  webPushSubscription = null,
}: {
  contact?: string;
  instituteId: string;
  note?: string;
  role: PasswordResetRole;
  userId: string;
  webPushSubscription?: unknown;
}): Promise<PasswordResetTicket> => {
  const data = await publicPasswordResetFetch({
    action: 'request',
    contact,
    instituteId,
    note,
    role,
    userId,
    webPushSubscription,
  });

  return {
    requestId: String(data.requestId || ''),
    status: (data.status as PasswordResetStatus) || 'pending',
    token: String(data.token || ''),
  };
};

export const fetchPasswordResetStatus = async ({
  requestId,
  token,
}: {
  requestId: string;
  token: string;
}): Promise<PasswordResetStatusResult> => {
  const data = await publicPasswordResetFetch({
    action: 'status',
    requestId,
    token,
  });

  return {
    rejectedReason: typeof data.rejectedReason === 'string' ? data.rejectedReason : '',
    resetLink: typeof data.resetLink === 'string' ? data.resetLink : '',
    status: (data.status as PasswordResetStatus) || 'pending',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  };
};

export const listPasswordResetRequests = async (
  currentUser: unknown,
  status: PasswordResetStatus | 'all' = 'all'
): Promise<PasswordResetRequestRecord[]> => {
  const data = await authenticatedFetch(PASSWORD_RESET_PATH, currentUser, {
    body: { action: 'list', status },
    method: 'POST',
    retryCount: 0,
  });

  return Array.isArray(data.requests) ? data.requests as PasswordResetRequestRecord[] : [];
};

export const approvePasswordResetRequest = async (
  currentUser: unknown,
  requestId: string
): Promise<{ resetLink: string; status: PasswordResetStatus }> => {
  const data = await authenticatedFetch(PASSWORD_RESET_PATH, currentUser, {
    body: { action: 'approve', requestId },
    method: 'POST',
    retryCount: 0,
    timeoutMs: 45000,
  });

  return {
    resetLink: String(data.resetLink || ''),
    status: (data.status as PasswordResetStatus) || 'approved',
  };
};

export const rejectPasswordResetRequest = async (
  currentUser: unknown,
  requestId: string,
  reason = ''
): Promise<{ status: PasswordResetStatus }> => {
  const data = await authenticatedFetch(PASSWORD_RESET_PATH, currentUser, {
    body: { action: 'reject', reason, requestId },
    method: 'POST',
    retryCount: 0,
  });

  return {
    status: (data.status as PasswordResetStatus) || 'rejected',
  };
};
