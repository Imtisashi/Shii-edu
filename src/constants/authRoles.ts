import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type AuthRoleId = 'driver' | 'institute' | 'parent';

export type AuthRoleOption = {
  accent: string;
  authPath: string;
  border: string;
  copy: string;
  features: string[];
  helper: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  id: AuthRoleId;
  label: string;
  manifestHref: string;
  placeholder: string;
  routeName: string;
  shortName: string;
  soft: string;
  title: string;
};

export const AUTH_ROLE_OPTIONS: AuthRoleOption[] = [
  {
    accent: '#635BFF',
    authPath: '/auth/institute',
    border: '#D9D7FF',
    copy: 'For admins, teachers, and students entering their institute workspace.',
    features: [
      'Attendance, notices, routines, fees, reports, and uploads',
      'Admin controls and teacher workflows scoped by institute ID',
      'Role-aware navigation with campus branding',
    ],
    helper: 'Institute accounts open the workspace tools assigned by your campus.',
    icon: 'business-outline',
    id: 'institute',
    label: 'Institute',
    manifestHref: '/manifest-institute.webmanifest',
    placeholder: 'Admin, teacher, or student User ID',
    routeName: 'InstituteAuth',
    shortName: 'Institute',
    soft: '#F7F6FF',
    title: 'Institute workspace access',
  },
  {
    accent: '#0F766E',
    authPath: '/auth/parents',
    border: '#B6E3D8',
    copy: 'For parents and guardians checking fees, notices, messages, and route updates.',
    features: [
      'Student-linked notices, fee status, and learning updates',
      'Transport visibility without admin-only controls',
      'Plain account recovery guidance through the institute',
    ],
    helper: 'Parents only see records linked to their registered student profile.',
    icon: 'people-outline',
    id: 'parent',
    label: 'Parents',
    manifestHref: '/manifest-parents.webmanifest',
    placeholder: 'Parent or guardian User ID',
    routeName: 'ParentsAuth',
    shortName: 'Parents',
    soft: '#ECFDF5',
    title: 'Parent access',
  },
  {
    accent: '#B45309',
    authPath: '/auth/driver',
    border: '#F2D49B',
    copy: 'For drivers broadcasting live route status and checking assigned destinations.',
    features: [
      'Live route console and map-first driver workspace',
      'Assigned destinations, vehicle notes, and route status',
      'Large controls designed for quick field use',
    ],
    helper: 'Driver accounts open the route console after institute verification.',
    icon: 'bus-outline',
    id: 'driver',
    label: 'Driver',
    manifestHref: '/manifest-driver.webmanifest',
    placeholder: 'Driver User ID',
    routeName: 'DriverAuth',
    shortName: 'Driver',
    soft: '#FFFBEB',
    title: 'Driver route access',
  },
];

export const DEFAULT_AUTH_ROLE: AuthRoleId = 'institute';

export const normalizeAuthRole = (value: unknown): AuthRoleId => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'driver') return 'driver';
  if (key === 'parent' || key === 'parents') return 'parent';
  return DEFAULT_AUTH_ROLE;
};

export const getAuthRoleOption = (value: unknown): AuthRoleOption => {
  const role = normalizeAuthRole(value);
  return AUTH_ROLE_OPTIONS.find((option) => option.id === role) || AUTH_ROLE_OPTIONS[0];
};
