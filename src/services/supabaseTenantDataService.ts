import type { User } from 'firebase/auth';

type TenantAction =
  | 'createAssignment'
  | 'createAttendanceRecords'
  | 'createGalleryItem'
  | 'createGrade'
  | 'createRoutine'
  | 'createProfile'
  | 'createProfiles'
  | 'createPyq'
  | 'deleteGalleryItem'
  | 'deletePyq'
  | 'deleteRoutine'
  | 'listAssignments'
  | 'listAttendance'
  | 'listGallery'
  | 'listGrades'
  | 'listPyqs'
  | 'listRoutines'
  | 'listUsers'
  | 'saveBranding'
  | 'updateOwnProfile'
  | 'updateProfileMedia';

type TenantPayload = Record<string, unknown>;

const getSupabaseFunctionsBaseUrl = (): string => {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!url) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required for Supabase workspace functions.');
  }
  return `${url}/functions/v1`;
};

const getTenantFunctionUrl = (slug: 'tenant-academics' | 'tenant-data' | 'tenant-operations'): string => (
  `${getSupabaseFunctionsBaseUrl()}/${slug}`
);
const ACADEMIC_ACTIONS = new Set<TenantAction>([
  'createAssignment',
  'createAttendanceRecords',
  'createGrade',
  'listAssignments',
  'listAttendance',
  'listGrades',
]);
const OPERATION_ACTIONS = new Set<TenantAction>([
  'createRoutine',
  'deleteRoutine',
  'listRoutines',
]);

export const callSupabaseTenantData = async <T = Record<string, unknown>>({
  action,
  currentUser,
  payload = {},
}: {
  action: TenantAction;
  currentUser: User | null | undefined;
  payload?: TenantPayload;
}): Promise<T> => {
  if (!currentUser) {
    throw new Error('A signed-in user is required for Supabase workspace data.');
  }

  const token = await currentUser.getIdToken();
  const functionUrl = ACADEMIC_ACTIONS.has(action)
    ? getTenantFunctionUrl('tenant-academics')
    : OPERATION_ACTIONS.has(action)
      ? getTenantFunctionUrl('tenant-operations')
      : getTenantFunctionUrl('tenant-data');
  const response = await fetch(functionUrl, {
    body: JSON.stringify({ action, payload }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Supabase workspace data failed with status ${response.status}.`);
  }

  return data as T;
};

export const listSupabaseUsers = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ users: unknown[] }>({
    action: 'listUsers',
    currentUser,
  })
);

export const listSupabaseGrades = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ grades: unknown[] }>({
    action: 'listGrades',
    currentUser,
  })
);

export const createSupabaseGrade = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'createGrade',
    currentUser,
    payload,
  })
);

export const listSupabaseAttendance = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ attendance: unknown[] }>({
    action: 'listAttendance',
    currentUser,
  })
);

export const createSupabaseAttendanceRecords = (
  currentUser: User | null | undefined,
  records: TenantPayload[],
  payload: TenantPayload = {}
) => (
  callSupabaseTenantData({
    action: 'createAttendanceRecords',
    currentUser,
    payload: { ...payload, records },
  })
);

export const listSupabaseAssignments = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ assignments: unknown[] }>({
    action: 'listAssignments',
    currentUser,
  })
);

export const createSupabaseAssignment = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'createAssignment',
    currentUser,
    payload,
  })
);

export const listSupabaseRoutines = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ routines: unknown[] }>({
    action: 'listRoutines',
    currentUser,
  })
);

export const createSupabaseRoutine = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'createRoutine',
    currentUser,
    payload,
  })
);

export const deleteSupabaseRoutine = (
  currentUser: User | null | undefined,
  id: string
) => (
  callSupabaseTenantData({
    action: 'deleteRoutine',
    currentUser,
    payload: { id },
  })
);

export const createSupabaseProfile = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'createProfile',
    currentUser,
    payload,
  })
);

export const createSupabaseProfiles = (
  currentUser: User | null | undefined,
  profiles: TenantPayload[]
) => (
  callSupabaseTenantData({
    action: 'createProfiles',
    currentUser,
    payload: { profiles },
  })
);

export const updateSupabaseOwnProfile = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'updateOwnProfile',
    currentUser,
    payload,
  })
);

export const updateSupabaseProfileMedia = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'updateProfileMedia',
    currentUser,
    payload,
  })
);

export const listSupabasePyqs = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ papers: unknown[] }>({
    action: 'listPyqs',
    currentUser,
  })
);

export const createSupabasePyq = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'createPyq',
    currentUser,
    payload,
  })
);

export const deleteSupabasePyq = (
  currentUser: User | null | undefined,
  id: string
) => (
  callSupabaseTenantData({
    action: 'deletePyq',
    currentUser,
    payload: { id },
  })
);

export const listSupabaseGallery = (currentUser: User | null | undefined) => (
  callSupabaseTenantData<{ images: unknown[] }>({
    action: 'listGallery',
    currentUser,
  })
);

export const createSupabaseGalleryItem = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'createGalleryItem',
    currentUser,
    payload,
  })
);

export const deleteSupabaseGalleryItem = (
  currentUser: User | null | undefined,
  id: string
) => (
  callSupabaseTenantData({
    action: 'deleteGalleryItem',
    currentUser,
    payload: { id },
  })
);

export const saveSupabaseBranding = (
  currentUser: User | null | undefined,
  payload: TenantPayload
) => (
  callSupabaseTenantData({
    action: 'saveBranding',
    currentUser,
    payload,
  })
);
