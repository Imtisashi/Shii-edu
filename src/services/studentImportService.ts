import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DocumentPickerAsset } from 'expo-document-picker';
import Papa from 'papaparse';
import type { User } from 'firebase/auth';
import { authenticatedFetch } from './apiClient';

export type StudentImportInstitutionType = 'COLLEGE' | 'SCHOOL';

export type StudentImportRow = {
  department?: string;
  firstName: string;
  lastName?: string;
  parentName?: string;
  parentPhone?: string;
  password: string;
  section?: string;
  semester?: string;
  standard?: string;
  userId: string;
};

export type StudentImportError = {
  error: string;
  row: number;
  userId?: string;
};

export type StudentImportHeaderMapping = {
  confidence: number;
  source: string;
  target: string;
};

export type StudentImportMappingReview = {
  autoApprove: boolean;
  mappings: StudentImportHeaderMapping[];
  overallConfidence: number;
  reviewReasons: string[];
};

export type StudentImportParseResult = {
  mappingReview: StudentImportMappingReview;
  rows: StudentImportRow[];
};

export type StudentImportResult = {
  createdStudents: number;
  errors: StudentImportError[];
  importJobId: string;
  requestId: string;
  skippedRows: number;
  success: true;
};

export type StudentImportBackgroundResult = {
  background: true;
  requestId: string;
  status: string;
  success: true;
  taskId: string;
};

const MAX_IMPORT_ROWS = 500;
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const BASE_HEADERS = ['firstName', 'lastName', 'userId', 'password', 'parentName', 'parentPhone'];
const SCHOOL_HEADERS = [...BASE_HEADERS, 'standard', 'section'];
const COLLEGE_HEADERS = [...BASE_HEADERS, 'department', 'semester'];

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const requiredHeaders = (institutionType: StudentImportInstitutionType): string[] => (
  institutionType === 'COLLEGE' ? COLLEGE_HEADERS : SCHOOL_HEADERS
);

const templateRows = (institutionType: StudentImportInstitutionType): StudentImportRow[] => (
  institutionType === 'COLLEGE'
    ? [{
      firstName: 'Aarav',
      lastName: 'Sharma',
      userId: 'STU-CSE-001',
      password: 'ChangeMe123',
      parentName: 'Riya Sharma',
      parentPhone: '+91 9000000000',
      department: 'CSE',
      semester: '1',
    }]
    : [{
      firstName: 'Aarav',
      lastName: 'Sharma',
      userId: 'STU-10A-001',
      password: 'ChangeMe123',
      parentName: 'Riya Sharma',
      parentPhone: '+91 9000000000',
      standard: '10',
      section: 'A',
    }]
);

const buildCsv = (institutionType: StudentImportInstitutionType): string => {
  const headers = requiredHeaders(institutionType);
  const rows = templateRows(institutionType);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof StudentImportRow])).join(',')),
  ].join('\n');
};

const downloadOnWeb = (csv: string, fileName: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const downloadStudentImportTemplate = async (
  institutionType: StudentImportInstitutionType
) => {
  const csv = buildCsv(institutionType);
  const fileName = institutionType === 'COLLEGE'
    ? 'shii-edu-college-student-import-template.csv'
    : 'shii-edu-school-student-import-template.csv';

  if (Platform.OS === 'web') {
    downloadOnWeb(csv, fileName);
    return;
  }

  const file = new File(Paths.cache, fileName);
  file.create({ intermediates: true, overwrite: true });
  file.write(csv);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('File sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Download Student Import Template',
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
};

const assertCsvAsset = (asset: DocumentPickerAsset) => {
  const name = String(asset.name || '').toLowerCase();
  const mimeType = String(asset.mimeType || '').toLowerCase();
  const validType = name.endsWith('.csv') ||
    mimeType === 'text/csv' ||
    mimeType === 'application/csv' ||
    mimeType === 'application/vnd.ms-excel';

  if (!validType) {
    throw new Error('Select a valid .csv file.');
  }

  if (asset.size && asset.size > MAX_CSV_BYTES) {
    throw new Error('Student import CSV files must be smaller than 2 MB.');
  }
};

const readCsvAsset = async (asset: DocumentPickerAsset): Promise<string> => {
  assertCsvAsset(asset);
  if (Platform.OS === 'web' && asset.file) {
    return asset.file.text();
  }

  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('The selected CSV file could not be read.');
  }
  return response.text();
};

const normalizeRecord = (record: Record<string, unknown>): StudentImportRow => ({
  department: String(record.department || '').trim(),
  firstName: String(record.firstName || '').trim(),
  lastName: String(record.lastName || '').trim(),
  parentName: String(record.parentName || '').trim(),
  parentPhone: String(record.parentPhone || '').trim(),
  password: String(record.password || ''),
  section: String(record.section || '').trim(),
  semester: String(record.semester || '').trim(),
  standard: String(record.standard || '').trim(),
  userId: String(record.userId || '').trim(),
});

const identityMappingReview = (headers: string[]): StudentImportMappingReview => ({
  autoApprove: true,
  mappings: headers.map((header) => ({
    confidence: 1,
    source: header,
    target: header,
  })),
  overallConfidence: 1,
  reviewReasons: [],
});

const applyHeaderMappings = (
  record: Record<string, unknown>,
  mappings: StudentImportHeaderMapping[]
): Record<string, unknown> => Object.fromEntries(
  mappings.map((mapping) => [mapping.target, record[mapping.source]])
);

export const parseStudentImportCsv = async ({
  asset,
  currentUser,
  institutionType,
}: {
  asset: DocumentPickerAsset;
  currentUser: User;
  institutionType: StudentImportInstitutionType;
}): Promise<StudentImportParseResult> => {
  const csv = await readCsvAsset(asset);
  const result = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message || 'The CSV file could not be parsed.');
  }

  const headers = result.meta.fields || [];
  const missingHeaders = requiredHeaders(institutionType).filter((header) => !headers.includes(header));
  const mappingReview = missingHeaders.length === 0
    ? identityMappingReview(headers)
    : await authenticatedFetch('/api/ai/csv-map', currentUser, {
      method: 'POST',
      retryCount: 0,
      body: {
        headers,
        institutionType,
      },
    }) as StudentImportMappingReview;

  const rows = result.data
    .map((record) => applyHeaderMappings(record, mappingReview.mappings))
    .map(normalizeRecord)
    .filter((row: StudentImportRow) => row.firstName || row.userId);
  if (rows.length === 0 && mappingReview.autoApprove) {
    throw new Error('The CSV file does not contain any student rows.');
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`A single import can contain at most ${MAX_IMPORT_ROWS} students.`);
  }
  return { mappingReview, rows };
};

export const importStudentsFromCsv = async ({
  currentUser,
  instituteId,
  rows,
}: {
  currentUser: User;
  instituteId: string;
  rows: StudentImportRow[];
}): Promise<StudentImportResult | StudentImportBackgroundResult> => (
  authenticatedFetch('/api/admin/users/bulk', currentUser, {
    method: 'POST',
    timeoutMs: 120000,
    retryCount: 0,
    body: {
      idempotencyKey: [
        'student-import',
        instituteId,
        rows.length,
        rows[0]?.userId || 'none',
        rows[rows.length - 1]?.userId || 'none',
      ].join(':'),
      instituteId,
      rows,
    },
  }) as Promise<StudentImportResult | StudentImportBackgroundResult>
);
