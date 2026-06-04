import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { importX509, jwtVerify } from "https://esm.sh/jose@5.9.6";

type OperationAction =
  | "createRoutine"
  | "deleteRoutine"
  | "listRoutines";

type ProfileRow = {
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
const READ_ACTIONS = new Set<OperationAction>(["listRoutines"]);
const WRITE_ACTIONS = new Set<OperationAction>(["createRoutine", "deleteRoutine", "listRoutines"]);
const DAY_TO_NUMBER: Record<string, number> = {
  friday: 5,
  monday: 1,
  saturday: 6,
  sunday: 0,
  thursday: 4,
  tuesday: 2,
  wednesday: 3,
};
const NUMBER_TO_DAY: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

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
  const certificate = (await loadFirebaseCerts())[header.kid];
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
    .select("full_name,id,institute_id,legacy_firestore_id,login_id,metadata,role,status,unique_id")
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

const assertCanPerform = (actor: ActorContext, action: OperationAction) => {
  if (actor.role === "superadmin") return;
  if (actor.role === "admin" && WRITE_ACTIONS.has(action)) return;
  if ((actor.role === "teacher" || actor.role === "professor" || actor.role === "student" || actor.role === "parent") && READ_ACTIONS.has(action)) return;
  throw new Error("You do not have permission to perform this operational action.");
};

const normalizeDay = (value: unknown): number => {
  const text = String(value || "Monday").trim().toLowerCase();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (numeric >= 0 && numeric <= 6) return numeric;
  }
  return DAY_TO_NUMBER[text] ?? 1;
};

const formatTime = (hours: number, minutes: number) => {
  const safeHours = Math.max(0, Math.min(23, hours));
  const safeMinutes = Math.max(0, Math.min(59, minutes));
  return `${String(safeHours).padStart(2, "0")}:${String(safeMinutes).padStart(2, "0")}:00`;
};

const parseSingleTime = (value: string, fallbackHour: number) => {
  const match = value.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return formatTime(fallbackHour, 0);
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return formatTime(hours, minutes);
};

const addOneHour = (value: string) => {
  const [hoursText, minutesText] = value.split(":");
  return formatTime((Number(hoursText) + 1) % 24, Number(minutesText || 0));
};

const parseTimeRange = (value: unknown) => {
  const rawTime = requireText(value, "Time", 80);
  const [startText, endText] = rawTime.split(/\s*(?:-|\u2013|\u2014|to)\s*/i);
  const startTime = parseSingleTime(startText || rawTime, 9);
  const endTime = endText ? parseSingleTime(endText, 10) : addOneHour(startTime);
  return { endTime, rawTime, startTime };
};

const mapRoutine = (item: Record<string, unknown>) => {
  const metadata = readObject(item.metadata);
  const targetPrimary = item.class_id || item.target_primary || metadata.targetPrimary || metadata.class || metadata.dept;
  const targetSecondary = item.section || item.semester || item.target_secondary || metadata.targetSecondary || metadata.section || metadata.sem;
  return {
    ...(metadata),
    createdAt: item.created_at,
    dataSource: "supabase",
    day: NUMBER_TO_DAY[Number(item.day_of_week)] || metadata.day || "Monday",
    dept: item.department || metadata.dept || null,
    id: item.legacy_firestore_id || item.id,
    room: item.room_number,
    section: item.section || metadata.section || null,
    sem: item.semester || metadata.sem || null,
    subject: item.subject,
    supabaseId: item.id,
    targetPrimary,
    targetSecondary,
    teacherId: item.teacher_legacy_id || item.teacher_id,
    teacherName: metadata.teacherName || null,
    teacherUid: item.teacher_legacy_id || item.teacher_id,
    time: metadata.rawTime || `${String(item.start_time).slice(0, 5)} - ${String(item.end_time).slice(0, 5)}`,
  };
};

const listRoutines = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  const instituteId = requireInstituteId(actor);
  const { data, error } = await supabase
    .from("routines")
    .select("*")
    .eq("institute_id", instituteId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return { routines: (data || []).map((row) => mapRoutine(row as Record<string, unknown>)) };
};

const createRoutine = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const instituteId = requireInstituteId(actor);
  const primary = requireText(payload.targetPrimary || payload.class || payload.dept || payload.department, "Target", 120);
  const secondary = optionalText(payload.targetSecondary || payload.section || payload.sem || payload.semester, 120);
  const { endTime, rawTime, startTime } = parseTimeRange(payload.time || payload.rawTime);
  const metadata = {
    ...payload,
    day: optionalText(payload.day, 40) || "Monday",
    rawTime,
    targetPrimary: primary,
    targetSecondary: secondary,
    teacherName: optionalText(payload.teacherName, 180),
    mirroredAt: new Date().toISOString(),
    provider: "supabase",
  };

  const row = {
    class_id: primary,
    day_of_week: normalizeDay(payload.day),
    department: optionalText(payload.dept || payload.department, 120),
    end_time: endTime,
    institute_id: instituteId,
    legacy_firestore_id: optionalText(payload.legacyFirestoreId || payload.id, 180),
    metadata,
    raw_time: rawTime,
    room_number: optionalText(payload.room || payload.roomNumber, 80),
    section: optionalText(payload.section, 80),
    semester: optionalText(payload.sem || payload.semester, 80),
    start_time: startTime,
    subject: requireText(payload.subject, "Subject", 180),
    teacher_id: optionalText(payload.teacherSupabaseId, 80),
  };

  const { data, error } = await supabase
    .from("routines")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return { routine: mapRoutine(data as Record<string, unknown>) };
};

const deleteRoutine = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const instituteId = requireInstituteId(actor);
  const routineId = requireText(payload.id || payload.routineId, "Routine ID", 180);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routineId);

  if (isUuid) {
    const { error } = await supabase
      .from("routines")
      .delete()
      .eq("id", routineId)
      .eq("institute_id", instituteId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("routines")
      .delete()
      .eq("legacy_firestore_id", routineId)
      .eq("institute_id", instituteId);
    if (error) throw error;
  }

  return { deleted: true, id: routineId };
};

const handleAction = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  action: OperationAction,
  payload: Record<string, unknown>
) => {
  assertCanPerform(actor, action);
  switch (action) {
    case "createRoutine":
      return createRoutine(supabase, actor, payload);
    case "deleteRoutine":
      return deleteRoutine(supabase, actor, payload);
    case "listRoutines":
      return listRoutines(supabase, actor);
    default:
      throw new Error("Unsupported operational action.");
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req), status: 204 });
  if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed." });

  try {
    const token = readAuthToken(req);
    const [verified, body] = await Promise.all([
      verifyFirebaseToken(token),
      req.json() as Promise<{ action?: OperationAction; payload?: Record<string, unknown> }>,
    ]);
    if (!body?.action) throw new Error("An operational action is required.");

    const supabase = getSupabaseClient();
    const actor = await loadActor(supabase, verified.uid);
    const result = await handleAction(supabase, actor, body.action, body.payload || {});

    return json(req, 200, {
      ...result,
      dataSource: "supabase",
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase operational request failed.";
    const status = /permission|not active|not found|missing firebase|invalid firebase/i.test(message) ? 403 : 400;
    return json(req, status, {
      success: false,
      error: message,
    });
  }
});
