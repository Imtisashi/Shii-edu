import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { importX509, jwtVerify } from "https://esm.sh/jose@5.9.6";

type AcademicAction =
  | "createAssignment"
  | "createAttendanceRecords"
  | "createGrade"
  | "listAssignments"
  | "listAttendance"
  | "listGrades";

type ProfileRow = {
  email: string | null;
  full_name: string;
  id: string;
  institute_id: string | null;
  legacy_firestore_id: string | null;
  login_id: string | null;
  metadata: Record<string, unknown> | null;
  role: string;
  status: string | null;
  unique_id: string | null;
};

type ActorContext = {
  profile: ProfileRow;
  role: string;
  uid: string;
};

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "edu-hub-1fce7";
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};
const STUDENT_ACTIONS = new Set<AcademicAction>(["listAssignments", "listAttendance", "listGrades"]);
const FACULTY_ACTIONS = new Set<AcademicAction>([
  "createAssignment",
  "createAttendanceRecords",
  "createGrade",
  "listAssignments",
  "listAttendance",
  "listGrades",
]);

let cachedCerts: { certs: Record<string, string>; expiresAt: number } = {
  certs: {},
  expiresAt: 0,
};

const configuredOrigins = () => (
  (Deno.env.get("APP_ORIGIN") || Deno.env.get("ALLOWED_ORIGINS") || "https://shii-edu.vercel.app")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);

const isLocalOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const corsHeaders = (req: Request) => {
  const allowedOrigins = configuredOrigins();
  const requestOrigin = (req.headers.get("origin") || "").replace(/\/+$/, "");
  const allowedOrigin = requestOrigin && (allowedOrigins.includes(requestOrigin) || isLocalOrigin(requestOrigin))
    ? requestOrigin
    : allowedOrigins[0] || "https://shii-edu.vercel.app";

  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": allowedOrigin,
  };
};

const json = (req: Request, status: number, body: Record<string, unknown>) => (
  new Response(JSON.stringify(body), {
    headers: corsHeaders(req),
    status,
  })
);

const readObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const optionalText = (value: unknown, max = 1000): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new Error("A text field is too long.");
  return text;
};

const requireText = (value: unknown, label: string, max = 500): string => {
  const text = optionalText(value, max);
  if (!text) throw new Error(`${label} is required.`);
  return text;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const compactStrings = (values: unknown[]): string[] => Array.from(new Set(
  values
    .map((value) => optionalText(value, 320))
    .filter((value): value is string => Boolean(value))
));

const normalizeDateText = (value: unknown, fallback = new Date().toISOString().slice(0, 10)): string => {
  const text = optionalText(value, 40);
  if (!text) return fallback;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return parsed.toISOString().slice(0, 10);
  }
  return text;
};

const optionalIsoDate = (value: unknown): string | null => {
  const text = optionalText(value, 40);
  if (!text || !/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const readAuthToken = (req: Request): string => {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Missing Firebase ID token.");
  return match[1];
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return atob(padded);
};

const readJwtHeader = (token: string): { kid?: string } => {
  const [header] = token.split(".");
  if (!header) throw new Error("Invalid Firebase ID token.");
  return JSON.parse(decodeBase64Url(header));
};

const loadFirebaseCerts = async (): Promise<Record<string, string>> => {
  if (Date.now() < cachedCerts.expiresAt && Object.keys(cachedCerts.certs).length > 0) {
    return cachedCerts.certs;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error("Could not load Firebase public certificates.");
  const maxAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  cachedCerts = {
    certs: await response.json(),
    expiresAt: Date.now() + Math.max(300, maxAge - 60) * 1000,
  };
  return cachedCerts.certs;
};

const verifyFirebaseToken = async (token: string): Promise<{ uid: string }> => {
  const header = readJwtHeader(token);
  if (!header.kid) throw new Error("Firebase token is missing a key id.");

  const certs = await loadFirebaseCerts();
  const certificate = certs[header.kid];
  if (!certificate) throw new Error("Firebase token key is no longer valid.");

  const publicKey = await importX509(certificate, "RS256");
  const { payload } = await jwtVerify(token, publicKey, {
    audience: FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  });

  const uid = String(payload.user_id || payload.sub || "").trim();
  if (!uid) throw new Error("Firebase token did not include a user id.");
  return { uid };
};

const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase runtime environment is missing.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const loadActor = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  uid: string
): Promise<ActorContext> => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email,full_name,id,institute_id,legacy_firestore_id,login_id,metadata,role,status,unique_id")
    .eq("legacy_firestore_id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!profile) throw new Error("Authenticated user profile was not found in Supabase.");
  if (String(profile.status || "active").toLowerCase() !== "active") throw new Error("This user profile is not active.");

  return {
    profile: profile as ProfileRow,
    role: String(profile.role || "").toLowerCase(),
    uid,
  };
};

const requireInstituteId = (actor: ActorContext): string => {
  if (actor.profile.institute_id) return actor.profile.institute_id;
  throw new Error("Your profile is not linked to an institute.");
};

const assertCanPerform = (actor: ActorContext, action: AcademicAction) => {
  if (actor.role === "superadmin") return;
  if ((actor.role === "admin" || actor.role === "teacher" || actor.role === "professor") && FACULTY_ACTIONS.has(action)) return;
  if (actor.role === "student" && STUDENT_ACTIONS.has(action)) return;
  throw new Error("You do not have permission to perform this academic action.");
};

const loadStudents = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  instituteId: string
) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("email,full_name,id,institute_id,legacy_firestore_id,login_id,metadata,role,status,unique_id")
    .eq("institute_id", instituteId)
    .eq("role", "student");

  if (error) throw error;
  return (data || []) as ProfileRow[];
};

const buildProfileLookup = (profiles: ProfileRow[]) => {
  const lookup = new Map<string, ProfileRow>();
  profiles.forEach((profile) => {
    const metadata = profile.metadata || {};
    compactStrings([
      profile.id,
      profile.legacy_firestore_id,
      profile.login_id,
      profile.unique_id,
      profile.email,
      metadata.authEmail,
    ]).forEach((key) => lookup.set(key.toLowerCase(), profile));
  });
  return lookup;
};

const resolveProfile = (
  lookup: Map<string, ProfileRow>,
  identifiers: unknown[]
): ProfileRow | null => {
  for (const key of compactStrings(identifiers).map((value) => value.toLowerCase())) {
    const profile = lookup.get(key);
    if (profile) return profile;
  }
  return null;
};

const mergeRowsById = (rows: Record<string, unknown>[][]) => {
  const merged = new Map<string, Record<string, unknown>>();
  rows.flat().forEach((row) => {
    const id = String(row.id || row.legacy_firestore_id || "");
    if (id) merged.set(id, row);
  });
  return Array.from(merged.values());
};

const mapGrade = (item: Record<string, unknown>) => ({
  ...(readObject(item.metadata)),
  createdAt: item.created_at || item.recorded_at,
  dataSource: "supabase",
  examType: item.exam_type || "Assessment",
  grade: item.grade_letter || null,
  gradePoints: item.grade_points || null,
  id: item.legacy_firestore_id || item.id,
  marks: item.marks,
  percentage: item.percentage,
  studentId: item.student_legacy_id || item.student_id,
  studentName: item.student_name,
  studentUid: item.student_legacy_id || item.student_id,
  subject: item.subject,
  supabaseId: item.id,
  teacherId: item.teacher_legacy_id || item.teacher_id,
  teacherName: item.teacher_name,
  timestamp: item.recorded_at || item.created_at,
  totalMarks: item.total_marks,
});

const mapAttendance = (item: Record<string, unknown>) => ({
  ...(readObject(item.metadata)),
  createdAt: item.created_at || item.recorded_at,
  dataSource: "supabase",
  date: item.attendance_date,
  id: item.legacy_firestore_id || item.id,
  instituteId: item.institute_id,
  isPresent: Boolean(item.is_present),
  status: item.status,
  studentDocId: item.student_id,
  studentId: item.student_legacy_id || item.student_login_id || item.student_id,
  studentName: item.student_name,
  studentUid: item.student_legacy_id || item.student_login_id || item.student_id,
  subject: item.subject,
  supabaseId: item.id,
  targetPrimary: item.target_primary,
  targetSecondary: item.target_secondary,
  teacherId: item.teacher_legacy_id || item.teacher_id,
  teacherName: item.teacher_name,
  timestamp: item.recorded_at || item.created_at,
  type: item.attendance_type,
});

const mapAssignment = (item: Record<string, unknown>) => ({
  ...(readObject(item.metadata)),
  createdAt: item.created_at,
  dataSource: "supabase",
  description: item.description,
  dueDate: item.due_on || readObject(item.metadata).dueDate || "No due date",
  id: item.legacy_firestore_id || item.id,
  subject: item.subject,
  supabaseId: item.id,
  teacherId: item.teacher_legacy_id || item.teacher_id,
  teacherName: item.teacher_name,
  title: item.title,
});

const listGrades = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  const instituteId = requireInstituteId(actor);
  if (actor.role === "student") {
    const legacyIds = compactStrings([actor.uid, actor.profile.login_id, actor.profile.unique_id]);
    const queries = [
      supabase
        .from("grades")
        .select("*")
        .eq("institute_id", instituteId)
        .eq("student_id", actor.profile.id)
        .order("created_at", { ascending: false }),
    ];
    if (legacyIds.length) {
      queries.push(
        supabase
          .from("grades")
          .select("*")
          .eq("institute_id", instituteId)
          .in("student_legacy_id", legacyIds)
          .order("created_at", { ascending: false })
      );
    }

    const results = await Promise.all(queries);
    results.forEach((result) => {
      if (result.error) throw result.error;
    });
    return { grades: mergeRowsById(results.map((result) => result.data || [])).map(mapGrade) };
  }

  const { data, error } = await supabase
    .from("grades")
    .select("*")
    .eq("institute_id", instituteId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return { grades: (data || []).map(mapGrade) };
};

const createGrade = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const instituteId = requireInstituteId(actor);
  const marks = toNumber(payload.marks, NaN);
  const totalMarks = toNumber(payload.totalMarks || payload.total_marks, NaN);
  if (!Number.isFinite(marks) || !Number.isFinite(totalMarks) || totalMarks <= 0) {
    throw new Error("Valid marks and total marks are required.");
  }

  const lookup = buildProfileLookup(await loadStudents(supabase, instituteId));
  const student = resolveProfile(lookup, [
    payload.studentSupabaseId,
    payload.studentId,
    payload.studentUid,
    payload.studentUniqueId,
    payload.loginId,
    payload.uniqueId,
  ]);
  if (!student) throw new Error("Student profile was not found in Supabase.");

  const row = {
    credit_hours: toNumber(payload.creditHours, 0) || null,
    exam_type: optionalText(payload.examType || payload.exam_type, 180) || "General Assessment",
    grade_letter: optionalText(payload.grade || payload.gradeLetter, 20),
    grade_points: toNumber(payload.gradePoints, 0) || null,
    institute_id: instituteId,
    legacy_firestore_id: optionalText(payload.legacyFirestoreId || payload.id, 180),
    marks,
    metadata: { ...payload, mirroredAt: new Date().toISOString(), provider: "supabase" },
    percentage: Math.max(0, Math.min(100, (marks / totalMarks) * 100)),
    recorded_at: new Date().toISOString(),
    student_id: student.id,
    student_legacy_id: student.legacy_firestore_id || student.login_id || student.unique_id,
    student_name: student.full_name,
    subject: requireText(payload.subject, "Subject", 180),
    teacher_id: actor.profile.id,
    teacher_legacy_id: actor.uid,
    teacher_name: actor.profile.full_name,
    total_marks: totalMarks,
  };

  const { data, error } = await supabase
    .from("grades")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return { grade: mapGrade(data as Record<string, unknown>) };
};

const listAttendance = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  const instituteId = requireInstituteId(actor);
  if (actor.role === "student") {
    const legacyIds = compactStrings([actor.uid, actor.profile.login_id, actor.profile.unique_id]);
    const queries = [
      supabase
        .from("attendance_records")
        .select("*")
        .eq("institute_id", instituteId)
        .eq("student_id", actor.profile.id)
        .order("attendance_date", { ascending: false }),
    ];
    if (legacyIds.length) {
      queries.push(
        supabase
          .from("attendance_records")
          .select("*")
          .eq("institute_id", instituteId)
          .in("student_legacy_id", legacyIds)
          .order("attendance_date", { ascending: false }),
        supabase
          .from("attendance_records")
          .select("*")
          .eq("institute_id", instituteId)
          .in("student_login_id", legacyIds)
          .order("attendance_date", { ascending: false })
      );
    }

    const results = await Promise.all(queries);
    results.forEach((result) => {
      if (result.error) throw result.error;
    });
    return { attendance: mergeRowsById(results.map((result) => result.data || [])).map(mapAttendance) };
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("institute_id", instituteId)
    .order("attendance_date", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return { attendance: (data || []).map(mapAttendance) };
};

const createAttendanceRecords = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const instituteId = requireInstituteId(actor);
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!records.length) throw new Error("At least one attendance record is required.");
  if (records.length > 500) throw new Error("A single attendance batch can contain at most 500 records.");

  const lookup = buildProfileLookup(await loadStudents(supabase, instituteId));
  const attendanceDate = normalizeDateText(payload.date || payload.attendanceDate);
  const subject = optionalText(payload.subject, 180) || "General";
  const attendanceType = optionalText(payload.attendanceType || payload.type, 40) || "daily";

  const rows = records.map((recordValue) => {
    const record = readObject(recordValue);
    const student = resolveProfile(lookup, [
      record.studentSupabaseId,
      record.studentId,
      record.studentUid,
      record.studentDocId,
      record.studentUniqueId,
      record.loginId,
      record.uniqueId,
    ]);
    if (!student) throw new Error(`Student profile was not found for ${optionalText(record.studentName, 180) || "one attendance row"}.`);

    const isPresent = record.isPresent === undefined
      ? String(record.status || "present").toLowerCase() !== "absent"
      : Boolean(record.isPresent);
    const status = optionalText(record.status, 20) || (isPresent ? "present" : "absent");
    if (!["present", "absent", "late", "excused"].includes(status)) {
      throw new Error("Attendance status must be present, absent, late, or excused.");
    }

    return {
      attendance_date: normalizeDateText(record.date || record.attendanceDate, attendanceDate),
      attendance_type: attendanceType,
      institute_id: instituteId,
      is_present: status === "present" || status === "late",
      legacy_firestore_id: optionalText(record.legacyFirestoreId || record.id, 220),
      metadata: { ...record, mirroredAt: new Date().toISOString(), provider: "supabase" },
      recorded_at: new Date().toISOString(),
      records: record,
      status,
      student_id: student.id,
      student_legacy_id: student.legacy_firestore_id || student.login_id || student.unique_id,
      student_login_id: student.login_id || student.unique_id,
      student_name: student.full_name,
      subject: optionalText(record.subject, 180) || subject,
      target_primary: optionalText(record.targetPrimary || record.class || record.dept, 120),
      target_secondary: optionalText(record.targetSecondary || record.section || record.sem, 120),
      teacher_id: actor.profile.id,
      teacher_legacy_id: actor.uid,
      teacher_name: actor.profile.full_name,
    };
  });

  const legacyIds = compactStrings(rows.map((row) => row.legacy_firestore_id));
  const existingByLegacy = new Map<string, string>();
  if (legacyIds.length) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id,legacy_firestore_id")
      .eq("institute_id", instituteId)
      .in("legacy_firestore_id", legacyIds);
    if (error) throw error;
    (data || []).forEach((item) => {
      if (item.legacy_firestore_id) existingByLegacy.set(String(item.legacy_firestore_id), item.id as string);
    });
  }

  const savedRows: Record<string, unknown>[] = [];
  const insertRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const existingId = row.legacy_firestore_id ? existingByLegacy.get(row.legacy_firestore_id) : null;
    if (existingId) {
      const { data, error } = await supabase
        .from("attendance_records")
        .update(row)
        .eq("id", existingId)
        .select("*")
        .single();
      if (error) throw error;
      savedRows.push(data as Record<string, unknown>);
    } else {
      insertRows.push(row);
    }
  }

  if (insertRows.length) {
    const { data, error } = await supabase
      .from("attendance_records")
      .insert(insertRows)
      .select("*");
    if (error) throw error;
    savedRows.push(...((data || []) as Record<string, unknown>[]));
  }

  return {
    attendance: savedRows.map(mapAttendance),
    count: rows.length,
  };
};

const listAssignments = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  const instituteId = requireInstituteId(actor);
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("institute_id", instituteId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return { assignments: (data || []).map(mapAssignment) };
};

const createAssignment = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const instituteId = requireInstituteId(actor);
  const dueDateText = optionalText(payload.dueDate || payload.due_on, 80);
  const row = {
    description: requireText(payload.description || payload.question, "Instructions", 4000),
    due_on: optionalIsoDate(dueDateText),
    institute_id: instituteId,
    legacy_firestore_id: optionalText(payload.legacyFirestoreId || payload.id, 180),
    metadata: { ...payload, dueDate: dueDateText || null, mirroredAt: new Date().toISOString(), provider: "supabase" },
    subject: optionalText(payload.subject || payload.course, 180),
    teacher_id: actor.profile.id,
    teacher_legacy_id: actor.uid,
    teacher_name: actor.profile.full_name,
    title: requireText(payload.title || payload.course || payload.subject, "Title", 220),
  };

  const { data, error } = await supabase
    .from("assignments")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return { assignment: mapAssignment(data as Record<string, unknown>) };
};

const handleAction = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  action: AcademicAction,
  payload: Record<string, unknown>
) => {
  assertCanPerform(actor, action);

  switch (action) {
    case "createAssignment":
      return createAssignment(supabase, actor, payload);
    case "createAttendanceRecords":
      return createAttendanceRecords(supabase, actor, payload);
    case "createGrade":
      return createGrade(supabase, actor, payload);
    case "listAssignments":
      return listAssignments(supabase, actor);
    case "listAttendance":
      return listAttendance(supabase, actor);
    case "listGrades":
      return listGrades(supabase, actor);
    default:
      throw new Error("Unsupported academic action.");
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req), status: 204 });
  if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed." });

  try {
    const token = readAuthToken(req);
    const [verified, body] = await Promise.all([
      verifyFirebaseToken(token),
      req.json() as Promise<{ action?: AcademicAction; payload?: Record<string, unknown> }>,
    ]);

    if (!body?.action) throw new Error("An academic action is required.");

    const supabase = getSupabaseClient();
    const actor = await loadActor(supabase, verified.uid);
    const result = await handleAction(supabase, actor, body.action, body.payload || {});

    return json(req, 200, {
      ...result,
      dataSource: "supabase",
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase academic request failed.";
    const status = /permission|not active|not found|missing firebase|invalid firebase/i.test(message) ? 403 : 400;
    return json(req, status, {
      success: false,
      error: message,
    });
  }
});
