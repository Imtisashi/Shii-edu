const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const COLLECTIONS = [
  'institutes',
  'users',
  'assignments',
  'attendance',
  'courseProgress',
  'courses',
  'gallery',
  'grades',
  'holidays',
  'notices',
  'notifications',
  'pyqs',
  'routines',
];

const ROLE_MAP = {
  instituteadmin: 'admin',
  professor: 'teacher',
  superadmin: 'superadmin',
};

const DEFAULT_HEX = {
  primary: '#2563EB',
  secondary: '#14B8A6',
  darkPrimary: '#0B0F19',
  darkSecondary: '#111827',
};

const loadEnv = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = process.env[key] || value;
  });
};

const getServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  return {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };
};

const uuidFrom = (seed) => {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
};

const sql = (value) => {
  if (value === undefined || value === null || value === '') return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const sqlUuid = (value) => (value ? `${sql(value)}::uuid` : 'null');
const sqlJson = (value) => `${sql(JSON.stringify(value ?? {}))}::jsonb`;
const sqlTextArray = (items) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (normalized.length === 0) return "array[]::text[]";
  return `array[${normalized.map(sql).join(', ')}]::text[]`;
};

const normalizeFirestoreValue = (value) => {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeFirestoreValue(item)]));
  }
  return value;
};

const timestampSql = (value) => {
  if (!value) return 'now()';
  if (typeof value.toDate === 'function') return `${sql(value.toDate().toISOString())}::timestamptz`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'now()' : `${sql(parsed.toISOString())}::timestamptz`;
};

const dateSql = (value) => {
  if (!value) return 'null';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return `${sql(value)}::date`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'null' : `${sql(parsed.toISOString().slice(0, 10))}::date`;
};

const numberSql = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? String(parsed) : String(fallback);
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const normalizeRole = (role) => {
  const compact = normalizeKey(role);
  return ROLE_MAP[compact] || compact || 'student';
};

const itemRoleCanFloat = (role) => normalizeRole(role) === 'superadmin';

const normalizeInstitutionType = (value) => {
  const compact = normalizeKey(value);
  return compact === 'college' ? 'college' : 'school';
};

const pickHex = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback);

const getInstituteLegacyId = (profile) => profile?.instituteId || profile?.instituteID || profile?.institutionId || null;

const parseTimeRange = (raw, index = 0) => {
  const fallbackHour = 8 + (index % 8);
  const fallbackStart = `${String(fallbackHour).padStart(2, '0')}:00`;
  const fallbackEnd = `${String(fallbackHour + 1).padStart(2, '0')}:00`;
  const value = String(raw || '').trim();
  const matches = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi) || [];

  const normalize = (timeText) => {
    if (!timeText) return null;
    const match = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const period = String(match[3] || '').toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const start = normalize(matches[0]) || fallbackStart;
  let end = normalize(matches[1]) || fallbackEnd;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  if (endTotal <= startTotal) {
    const normalizedEndTotal = Math.min(startTotal + 60, 23 * 60 + 59);
    end = `${String(Math.floor(normalizedEndTotal / 60)).padStart(2, '0')}:${String(normalizedEndTotal % 60).padStart(2, '0')}`;
  }

  return { start, end };
};

const dayFromValue = (value, index = 0) => {
  const text = normalizeKey(value);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const found = days.findIndex((day) => text.includes(day));
  return found >= 0 ? found : index % 6 + 1;
};

const collectMedia = (mediaRows, row) => {
  if (!row.public_url && !row.source_url && !row.storage_path) return null;
  const id = row.id || uuidFrom(`media:${row.provider}:${row.source_url || row.public_url || row.storage_path}`);
  mediaRows.set(id, {
    id,
    institute_id: row.institute_id || null,
    owner_id: row.owner_id || null,
    provider: row.provider || 'cloudinary',
    bucket: row.bucket || null,
    storage_path: row.storage_path || null,
    public_url: row.public_url || row.source_url || null,
    source_url: row.source_url || row.public_url || null,
    legacy_public_id: row.legacy_public_id || null,
    resource_type: row.resource_type || 'image',
    mime_type: row.mime_type || null,
    file_name: row.file_name || null,
    title: row.title || null,
    purpose: row.purpose || 'general',
    metadata: row.metadata || {},
    migrated_at: row.migrated_at || new Date().toISOString(),
  });
  return id;
};

const values = (rows, mapper) => rows.map(mapper).join(',\n');

const insertBlock = (title, table, columns, rows, mapper, conflictTarget, updateColumns) => {
  if (rows.length === 0) return `-- ${title}: no rows found\n`;
  const updates = updateColumns.map((column) => `${column} = excluded.${column}`).join(', ');
  return [
    `-- ${title}`,
    `insert into public.${table} (${columns.join(', ')})`,
    'values',
    values(rows, mapper),
    `on conflict (${conflictTarget}) do update set ${updates};`,
    '',
  ].join('\n');
};

const main = async () => {
  loadEnv(path.join(process.cwd(), '.env'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount()),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  const db = admin.firestore();
  const data = {};
  for (const collectionName of COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    data[collectionName] = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  }

  const instituteIdByLegacy = new Map();
  const userIdByLegacy = new Map();
  const mediaRows = new Map();
  const placeholderInstitutes = new Map();

  const ensurePlaceholderInstitute = (legacyCode) => {
    const cleanedCode = String(legacyCode || '').trim() || 'UNKNOWN';
    if (instituteIdByLegacy.has(cleanedCode)) return instituteIdByLegacy.get(cleanedCode);

    const id = uuidFrom(`institute:${cleanedCode}`);
    instituteIdByLegacy.set(cleanedCode, id);
    placeholderInstitutes.set(cleanedCode, {
      id: cleanedCode,
      supabaseId: id,
      instituteCode: cleanedCode,
      legacyFirestoreId: cleanedCode,
      name: `Legacy Institute ${cleanedCode}`,
      logoUrl: null,
      institutionType: 'school',
      nameKey: normalizeKey(`Legacy Institute ${cleanedCode}`),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configuration: {
        generatedFromOrphanReference: true,
        legacyInstituteCode: cleanedCode,
      },
    });
    return id;
  };

  const resolveInstituteId = (legacyCode, { required = false } = {}) => {
    const cleanedCode = String(legacyCode || '').trim();
    if (cleanedCode && instituteIdByLegacy.has(cleanedCode)) return instituteIdByLegacy.get(cleanedCode);
    if (cleanedCode) return ensurePlaceholderInstitute(cleanedCode);
    return required ? ensurePlaceholderInstitute('UNKNOWN') : null;
  };

  const institutes = data.institutes.map((institute) => {
    const legacyId = institute.id;
    const instituteCode = institute.instituteId || legacyId;
    const id = uuidFrom(`institute:${legacyId}`);
    instituteIdByLegacy.set(legacyId, id);
    instituteIdByLegacy.set(instituteCode, id);
    const branding = institute.branding || {};
    const settingsBranding = institute.settings?.branding || {};
    const logoUrl = branding.logoUrl || settingsBranding.logoUrl || institute.logoUrl || null;

    collectMedia(mediaRows, {
      id: uuidFrom(`media:logo:${legacyId}`),
      institute_id: id,
      provider: logoUrl && logoUrl.includes('cloudinary') ? 'cloudinary' : 'external',
      public_url: logoUrl,
      source_url: logoUrl,
      title: `${institute.name || instituteCode} logo`,
      purpose: 'institute-logo',
      metadata: { legacyFirestoreId: legacyId },
    });

    return {
      ...institute,
      supabaseId: id,
      instituteCode,
      logoUrl,
      institutionType: normalizeInstitutionType(institute.institutionType || institute.type),
    };
  });

  COLLECTIONS
    .filter((collectionName) => collectionName !== 'institutes')
    .forEach((collectionName) => {
      data[collectionName].forEach((row) => {
        const legacyCode = String(row.instituteId || '').trim();
        if (legacyCode && !instituteIdByLegacy.has(legacyCode)) {
          ensurePlaceholderInstitute(legacyCode);
        }
        if (!legacyCode && collectionName !== 'users') {
          ensurePlaceholderInstitute('UNKNOWN');
        }
      });
    });

  data.users.forEach((user) => {
    const legacyCode = String(getInstituteLegacyId(user) || '').trim();
    if (!legacyCode && !itemRoleCanFloat(user.role)) {
      ensurePlaceholderInstitute('UNKNOWN');
    }
  });

  const allInstitutes = [...institutes, ...placeholderInstitutes.values()];

  const profiles = data.users.map((user) => {
    const id = uuidFrom(`profile:${user.id}`);
    userIdByLegacy.set(user.id, id);
    if (user.uid) userIdByLegacy.set(user.uid, id);
    const instituteLegacyId = getInstituteLegacyId(user);
    const instituteId = itemRoleCanFloat(user.role)
      ? resolveInstituteId(instituteLegacyId, { required: false })
      : resolveInstituteId(instituteLegacyId, { required: true });
    const photoUrl = user.photoURL || user.photoUrl || user.profilePic || user.avatarUrl || null;
    collectMedia(mediaRows, {
      id: uuidFrom(`media:profile:${user.id}`),
      institute_id: instituteId,
      owner_id: id,
      provider: photoUrl && photoUrl.includes('cloudinary') ? 'cloudinary' : 'external',
      public_url: photoUrl,
      source_url: photoUrl,
      title: `${user.name || user.email || user.id} profile picture`,
      purpose: 'profile-picture',
      metadata: { legacyFirestoreId: user.id },
    });

    return {
      ...user,
      supabaseId: id,
      supabaseInstituteId: instituteId,
      normalizedRole: normalizeRole(user.role),
      loginId: user.loginId || user.uniqueId || user.teacherCode || user.email || user.id,
      photoUrl,
    };
  });

  const normalized = (collectionName) => (data[collectionName] || []).map((row) => normalizeFirestoreValue(row));

  const assignments = normalized('assignments');
  const attendance = normalized('attendance');
  const courseProgress = normalized('courseProgress');
  const courses = normalized('courses');
  const gallery = normalized('gallery');
  const grades = normalized('grades');
  const holidays = normalized('holidays');
  const notices = normalized('notices');
  const notifications = normalized('notifications');
  const pyqs = normalized('pyqs');
  const routines = normalized('routines');

  const mediaRowsForGallery = gallery.map((item) => {
    const instituteId = resolveInstituteId(item.instituteId, { required: true });
    const imageUrl = item.imageUrl || item.photoURL || item.url || null;
    const mediaId = collectMedia(mediaRows, {
      id: uuidFrom(`media:gallery:${item.id}`),
      institute_id: instituteId,
      provider: imageUrl && imageUrl.includes('cloudinary') ? 'cloudinary' : 'external',
      public_url: imageUrl,
      source_url: imageUrl,
      title: item.title || 'Gallery media',
      purpose: 'gallery',
      metadata: { legacyFirestoreId: item.id },
      migrated_at: item.createdAt || new Date().toISOString(),
    });
    return { ...item, supabaseMediaId: mediaId };
  });

  const pyqsWithMedia = pyqs.map((item) => {
    const instituteId = resolveInstituteId(item.instituteId, { required: true });
    const fileUrl = item.fileUrl || item.url || item.documentUrl || null;
    const mediaId = collectMedia(mediaRows, {
      id: uuidFrom(`media:pyq:${item.id}`),
      institute_id: instituteId,
      provider: fileUrl && fileUrl.includes('cloudinary') ? 'cloudinary' : 'external',
      public_url: fileUrl,
      source_url: fileUrl,
      legacy_public_id: item.publicId || null,
      title: item.title || 'Previous year question paper',
      purpose: 'pyq',
      resource_type: 'raw',
      metadata: { legacyFirestoreId: item.id },
      migrated_at: item.createdAt || new Date().toISOString(),
    });
    return { ...item, supabaseMediaId: mediaId };
  });

  const output = [];
  output.push('begin;');
  output.push("set local statement_timeout = '30s';");

  output.push(insertBlock(
    'Institutes',
    'institutes',
    ['id', 'name', 'logo_url', 'primary_color', 'secondary_color', 'dark_primary_color', 'dark_secondary_color', 'configuration', 'created_at', 'updated_at', 'institute_code', 'legacy_firestore_id', 'institution_type', 'name_key', 'about_us', 'tagline', 'location', 'settings', 'academic_model', 'schema_version'],
    allInstitutes,
    (item) => `(${sqlUuid(item.supabaseId)}, ${sql(item.name || item.instituteCode)}, ${sql(item.logoUrl)}, ${sql(pickHex(item.themeColor || item.branding?.primaryColor || item.settings?.branding?.primaryColor, DEFAULT_HEX.primary))}, ${sql(pickHex(item.branding?.secondaryColor || item.settings?.branding?.secondaryColor, DEFAULT_HEX.secondary))}, ${sql(pickHex(item.branding?.darkPrimaryColor || item.settings?.branding?.darkPrimaryColor, DEFAULT_HEX.darkPrimary))}, ${sql(pickHex(item.branding?.darkSecondaryColor || item.settings?.branding?.darkSecondaryColor, DEFAULT_HEX.darkSecondary))}, ${sqlJson(normalizeFirestoreValue(item))}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt)}, ${sql(item.instituteCode)}, ${sql(item.id)}, ${sql(item.institutionType)}::public.edu_shii_institution_type, ${sql(item.nameKey || normalizeKey(item.name || item.instituteCode))}, ${sql(item.aboutUs)}, ${sql(item.tagline)}, ${sql(item.location)}, ${sqlJson(normalizeFirestoreValue(item.settings || {}))}, ${sqlJson(normalizeFirestoreValue(item.academicModel || {}))}, ${Number(item.schemaVersion || 2)})`,
    'id',
    ['name', 'logo_url', 'primary_color', 'secondary_color', 'dark_primary_color', 'dark_secondary_color', 'configuration', 'updated_at', 'institute_code', 'legacy_firestore_id', 'institution_type', 'name_key', 'about_us', 'tagline', 'location', 'settings', 'academic_model', 'schema_version']
  ));

  output.push(insertBlock(
    'Profiles',
    'profiles',
    ['id', 'institute_id', 'email', 'full_name', 'role', 'metadata', 'created_at', 'updated_at', 'login_id', 'unique_id', 'legacy_firestore_id', 'photo_url', 'assigned_class', 'assigned_section', 'assigned_department', 'assigned_semester', 'degree', 'experience', 'teacher_code', 'teaching_scope', 'fee_paid', 'total_fee', 'fee_breakdown'],
    profiles,
    (item) => `(${sqlUuid(item.supabaseId)}, ${sqlUuid(item.supabaseInstituteId)}, ${sql(item.email)}, ${sql(item.name || item.email || item.loginId || item.id)}, ${sql(item.normalizedRole)}::public.edu_shii_profile_role, ${sqlJson(normalizeFirestoreValue(item))}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt)}, ${sql(item.loginId)}, ${sql(item.uniqueId)}, ${sql(item.id)}, ${sql(item.photoUrl)}, ${sql(item.class || item.assignedClass)}, ${sql(item.section || item.assignedSection || item['section '])}, ${sql(item.dept || item.assignedDept || item.assignedDepartment)}, ${sql(item.sem || item.assignedSem || item.assignedSemester)}, ${sql(item.degree)}, ${sql(item.experience)}, ${sql(item.teacherCode)}, ${sqlJson(normalizeFirestoreValue(item.teachingScope || {}))}, ${numberSql(item.feePaid)}, ${numberSql(item.totalFee)}, ${sqlJson(normalizeFirestoreValue(item.feeBreakdown || []))})`,
    'id',
    ['institute_id', 'email', 'full_name', 'role', 'metadata', 'updated_at', 'login_id', 'unique_id', 'legacy_firestore_id', 'photo_url', 'assigned_class', 'assigned_section', 'assigned_department', 'assigned_semester', 'degree', 'experience', 'teacher_code', 'teaching_scope', 'fee_paid', 'total_fee', 'fee_breakdown']
  ));

  output.push(insertBlock(
    'Media assets',
    'media_assets',
    ['id', 'institute_id', 'owner_id', 'provider', 'bucket', 'storage_path', 'public_url', 'source_url', 'legacy_public_id', 'resource_type', 'mime_type', 'file_name', 'title', 'purpose', 'metadata', 'migrated_at'],
    Array.from(mediaRows.values()),
    (item) => `(${sqlUuid(item.id)}, ${sqlUuid(item.institute_id)}, ${sqlUuid(item.owner_id)}, ${sql(item.provider)}::public.edu_shii_upload_provider, ${sql(item.bucket)}, ${sql(item.storage_path)}, ${sql(item.public_url)}, ${sql(item.source_url)}, ${sql(item.legacy_public_id)}, ${sql(item.resource_type)}, ${sql(item.mime_type)}, ${sql(item.file_name)}, ${sql(item.title)}, ${sql(item.purpose)}, ${sqlJson(item.metadata)}, ${timestampSql(item.migrated_at)})`,
    'id',
    ['institute_id', 'owner_id', 'provider', 'bucket', 'storage_path', 'public_url', 'source_url', 'legacy_public_id', 'resource_type', 'mime_type', 'file_name', 'title', 'purpose', 'metadata', 'migrated_at']
  ));

  output.push(insertBlock(
    'Assignments',
    'assignments',
    ['id', 'institute_id', 'legacy_firestore_id', 'teacher_id', 'teacher_legacy_id', 'teacher_name', 'title', 'subject', 'description', 'due_on', 'metadata', 'created_at', 'updated_at'],
    assignments,
    (item) => `(${sqlUuid(uuidFrom(`assignment:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sqlUuid(userIdByLegacy.get(item.teacherId))}, ${sql(item.teacherId)}, ${sql(item.teacherName)}, ${sql(item.title || 'Assignment')}, ${sql(item.subject)}, ${sql(item.description)}, ${dateSql(item.dueDate)}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'teacher_id', 'teacher_legacy_id', 'teacher_name', 'title', 'subject', 'description', 'due_on', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Attendance',
    'attendance_records',
    ['id', 'institute_id', 'legacy_firestore_id', 'student_id', 'student_legacy_id', 'student_login_id', 'student_name', 'teacher_id', 'teacher_legacy_id', 'teacher_name', 'attendance_date', 'subject', 'attendance_type', 'status', 'is_present', 'target_primary', 'target_secondary', 'records', 'metadata', 'recorded_at', 'created_at', 'updated_at'],
    attendance,
    (item) => {
      const present = item.isPresent !== false && item.status !== 'absent';
      return `(${sqlUuid(uuidFrom(`attendance:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sqlUuid(userIdByLegacy.get(item.studentUid || item.studentDocId || item.studentId))}, ${sql(item.studentUid || item.studentDocId || item.studentId)}, ${sql(item.studentUniqueId || item.studentId)}, ${sql(item.studentName)}, ${sqlUuid(userIdByLegacy.get(item.teacherId))}, ${sql(item.teacherId)}, ${sql(item.teacherName)}, ${dateSql(item.date || item.timestamp || item.createdAt || new Date().toISOString())}, ${sql(item.subject)}, ${sql(item.type || 'daily')}, ${sql(present ? 'present' : 'absent')}::public.edu_shii_attendance_status, ${present ? 'true' : 'false'}, ${sql(item.targetPrimary)}, ${sql(item.targetSecondary)}, ${sqlJson(item.records || {})}, ${sqlJson(item)}, ${timestampSql(item.timestamp || item.createdAt)}, ${timestampSql(item.timestamp || item.createdAt)}, ${timestampSql(item.timestamp || item.createdAt)})`;
    },
    'id',
    ['institute_id', 'legacy_firestore_id', 'student_id', 'student_legacy_id', 'student_login_id', 'student_name', 'teacher_id', 'teacher_legacy_id', 'teacher_name', 'attendance_date', 'subject', 'attendance_type', 'status', 'is_present', 'target_primary', 'target_secondary', 'records', 'metadata', 'recorded_at', 'updated_at']
  ));

  output.push(insertBlock(
    'Grades',
    'grades',
    ['id', 'institute_id', 'legacy_firestore_id', 'student_id', 'student_legacy_id', 'student_name', 'teacher_id', 'teacher_legacy_id', 'teacher_name', 'subject', 'exam_type', 'marks', 'total_marks', 'percentage', 'metadata', 'recorded_at', 'created_at', 'updated_at'],
    grades,
    (item) => `(${sqlUuid(uuidFrom(`grade:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sqlUuid(userIdByLegacy.get(item.studentId))}, ${sql(item.studentId)}, ${sql(item.studentName)}, ${sqlUuid(userIdByLegacy.get(item.teacherId))}, ${sql(item.teacherId)}, ${sql(item.teacherName)}, ${sql(item.subject || 'General')}, ${sql(item.examType || item.type)}, ${numberSql(item.marks, 'null')}, ${numberSql(item.totalMarks, 'null')}, ${numberSql(item.percentage, 'null')}, ${sqlJson(item)}, ${timestampSql(item.timestamp)}, ${timestampSql(item.timestamp)}, ${timestampSql(item.timestamp)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'student_id', 'student_legacy_id', 'student_name', 'teacher_id', 'teacher_legacy_id', 'teacher_name', 'subject', 'exam_type', 'marks', 'total_marks', 'percentage', 'metadata', 'recorded_at', 'updated_at']
  ));

  output.push(insertBlock(
    'Courses',
    'courses',
    ['id', 'institute_id', 'legacy_firestore_id', 'instructor_id', 'instructor_legacy_id', 'instructor_name', 'title', 'description', 'status', 'published', 'institution_type', 'academic_year', 'classes', 'sections', 'modules', 'metadata', 'created_at', 'updated_at'],
    courses,
    (item) => `(${sqlUuid(uuidFrom(`course:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sqlUuid(userIdByLegacy.get(item.instructorId))}, ${sql(item.instructorId)}, ${sql(item.instructorName)}, ${sql(item.title || 'Course')}, ${sql(item.description)}, ${sql(item.status || 'draft')}, ${item.published ? 'true' : 'false'}, ${sql(normalizeInstitutionType(item.institutionType))}::public.edu_shii_institution_type, ${sql(item.academicYear)}, ${sqlJson(item.classes || [])}, ${sqlJson(item.sections || [])}, ${sqlJson(item.modules || [])}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'instructor_id', 'instructor_legacy_id', 'instructor_name', 'title', 'description', 'status', 'published', 'institution_type', 'academic_year', 'classes', 'sections', 'modules', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Course progress',
    'course_progress',
    ['id', 'institute_id', 'user_id', 'user_legacy_id', 'course_id', 'course_legacy_id', 'lesson_id', 'completed', 'position_seconds', 'duration_seconds', 'notes', 'metadata', 'created_at', 'updated_at'],
    courseProgress,
    (item) => `(${sqlUuid(uuidFrom(`courseProgress:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sqlUuid(userIdByLegacy.get(item.userId))}, ${sql(item.userId)}, ${sqlUuid(uuidFrom(`course:${item.courseId}`))}, ${sql(item.courseId)}, ${sql(item.lessonId || 'lesson')}, ${item.completed ? 'true' : 'false'}, ${Number(item.positionSeconds || 0)}, ${Number(item.durationSeconds || 0)}, ${sql(item.notes)}, ${sqlJson(item)}, ${timestampSql(item.updatedAt)}, ${timestampSql(item.updatedAt)})`,
    'id',
    ['institute_id', 'user_id', 'user_legacy_id', 'course_id', 'course_legacy_id', 'lesson_id', 'completed', 'position_seconds', 'duration_seconds', 'notes', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Gallery',
    'gallery',
    ['id', 'institute_id', 'legacy_firestore_id', 'title', 'image_url', 'media_id', 'uploaded_by_name', 'metadata', 'created_at', 'updated_at'],
    mediaRowsForGallery,
    (item) => `(${sqlUuid(uuidFrom(`gallery:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sql(item.title || 'Gallery media')}, ${sql(item.imageUrl || item.photoURL || item.url)}, ${sqlUuid(item.supabaseMediaId)}, ${sql(item.uploadedBy)}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'title', 'image_url', 'media_id', 'uploaded_by_name', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Holidays',
    'holidays',
    ['id', 'institute_id', 'legacy_firestore_id', 'title', 'holiday_date', 'holiday_type', 'created_by', 'created_by_name', 'metadata', 'created_at', 'updated_at'],
    holidays,
    (item) => `(${sqlUuid(uuidFrom(`holiday:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sql(item.title || 'Holiday')}, ${dateSql(item.date)}, ${sql(item.type)}, ${sqlUuid(userIdByLegacy.get(item.createdBy))}, ${sql(item.createdByName)}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'title', 'holiday_date', 'holiday_type', 'created_by', 'created_by_name', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Notices',
    'notices',
    ['id', 'institute_id', 'legacy_firestore_id', 'title', 'message', 'content', 'author_name', 'target_roles', 'target_level', 'notice_type', 'metadata', 'created_at', 'updated_at'],
    notices,
    (item) => `(${sqlUuid(uuidFrom(`notice:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sql(item.title || 'Notice')}, ${sql(item.message || item.content || '')}, ${sql(item.content)}, ${sql(item.author)}, ${sqlTextArray(item.targetRoles || [item.role || 'all'])}, ${sql(item.targetLevel)}, ${sql(item.type || 'notice')}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'title', 'message', 'content', 'author_name', 'target_roles', 'target_level', 'notice_type', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Notifications',
    'notifications',
    ['id', 'institute_id', 'legacy_firestore_id', 'title', 'message', 'notification_type', 'target_roles', 'recipient_legacy_ids', 'related_type', 'related_id', 'author', 'data', 'metadata', 'created_at', 'updated_at'],
    notifications,
    (item) => `(${sqlUuid(uuidFrom(`notification:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sql(item.title || 'Notification')}, ${sql(item.message || '')}, ${sql(item.type || 'general')}, ${sqlTextArray(item.targetRoles || ['all'])}, ${sqlTextArray(item.recipientUids || [])}, ${sql(item.relatedType)}, ${sql(item.relatedId)}, ${sqlJson(item.author || {})}, ${sqlJson(item.data || {})}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'title', 'message', 'notification_type', 'target_roles', 'recipient_legacy_ids', 'related_type', 'related_id', 'author', 'data', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'PYQs',
    'pyqs',
    ['id', 'institute_id', 'legacy_firestore_id', 'title', 'subject', 'year', 'uploaded_by_name', 'document_media_id', 'file_url', 'public_id', 'metadata', 'created_at', 'updated_at'],
    pyqsWithMedia,
    (item) => `(${sqlUuid(uuidFrom(`pyq:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(item.id)}, ${sql(item.title || 'Previous Year Paper')}, ${sql(item.subject)}, ${sql(item.year)}, ${sql(item.uploadedBy)}, ${sqlUuid(item.supabaseMediaId)}, ${sql(item.fileUrl || item.url || item.documentUrl)}, ${sql(item.publicId)}, ${sqlJson(item)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)})`,
    'id',
    ['institute_id', 'legacy_firestore_id', 'title', 'subject', 'year', 'uploaded_by_name', 'document_media_id', 'file_url', 'public_id', 'metadata', 'updated_at']
  ));

  output.push(insertBlock(
    'Routines',
    'routines',
    ['id', 'institute_id', 'class_id', 'day_of_week', 'start_time', 'end_time', 'subject', 'teacher_id', 'room_number', 'created_at', 'updated_at', 'legacy_firestore_id', 'section', 'department', 'semester', 'raw_time', 'metadata'],
    routines,
    (item, index) => {
      const time = parseTimeRange(item.time, index);
      const classId = item.class || item.dept || item.sem || 'General';
      return `(${sqlUuid(uuidFrom(`routine:${item.id}`))}, ${sqlUuid(resolveInstituteId(item.instituteId, { required: true }))}, ${sql(classId)}, ${dayFromValue(item.day, index)}, ${sql(time.start)}::time, ${sql(time.end)}::time, ${sql(item.subject || 'Subject')}, ${sqlUuid(userIdByLegacy.get(item.teacherId))}, ${sql(item.room)}, ${timestampSql(item.createdAt)}, ${timestampSql(item.updatedAt || item.createdAt)}, ${sql(item.id)}, ${sql(item.section)}, ${sql(item.dept)}, ${sql(item.sem)}, ${sql(item.time)}, ${sqlJson(item)})`;
    },
    'id',
    ['institute_id', 'class_id', 'day_of_week', 'start_time', 'end_time', 'subject', 'teacher_id', 'room_number', 'updated_at', 'legacy_firestore_id', 'section', 'department', 'semester', 'raw_time', 'metadata']
  ));

  output.push('commit;');

  const outputPath = path.join(process.cwd(), 'supabase', 'firebase-import.sql');
  fs.writeFileSync(outputPath, output.join('\n'), 'utf8');
  console.log(outputPath);
  console.log(JSON.stringify({
    institutes: institutes.length,
    profiles: profiles.length,
    mediaAssets: mediaRows.size,
    assignments: assignments.length,
    attendance: attendance.length,
    courses: courses.length,
    courseProgress: courseProgress.length,
    gallery: gallery.length,
    grades: grades.length,
    holidays: holidays.length,
    notices: notices.length,
    notifications: notifications.length,
    pyqs: pyqs.length,
    routines: routines.length,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
