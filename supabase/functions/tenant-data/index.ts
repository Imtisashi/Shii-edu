import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { importX509, jwtVerify } from "https://esm.sh/jose@5.9.6";

type WorkspaceAction =
  | "createGalleryItem"
  | "createInstituteWithProfiles"
  | "createNotification"
  | "createProfile"
  | "createProfiles"
  | "createPyq"
  | "deleteGalleryItem"
  | "deleteNotification"
  | "deletePyq"
  | "getOfficeHours"
  | "listConversationMessages"
  | "listConversations"
  | "listGallery"
  | "listNotifications"
  | "listPyqs"
  | "listUsers"
  | "markAllNotificationsRead"
  | "markNotificationRead"
  | "saveBranding"
  | "saveInstituteFeatures"
  | "updateOwnProfile"
  | "updateProfileMedia";

type ProfileRow = {
  assigned_class: string | null;
  assigned_department: string | null;
  assigned_section: string | null;
  assigned_semester: string | null;
  degree: string | null;
  email: string | null;
  experience: string | null;
  fee_breakdown: unknown;
  fee_paid: string | number | null;
  full_name: string;
  id: string;
  institute_id: string | null;
  legacy_firestore_id: string | null;
  login_id: string | null;
  metadata: Record<string, unknown> | null;
  phone: string | null;
  photo_url: string | null;
  role: string;
  status: string | null;
  teacher_code: string | null;
  teaching_scope: Record<string, unknown> | null;
  total_fee: string | number | null;
  unique_id: string | null;
};

type ActorContext = {
  institute: Record<string, unknown> | null;
  profile: ProfileRow;
  role: string;
  uid: string;
};

type RequestBody = {
  action?: WorkspaceAction;
  payload?: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "edu-hub-1fce7";
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};

const SELF_PROFILE_ACTIONS = new Set<WorkspaceAction>(["updateOwnProfile", "updateProfileMedia"]);
const STUDENT_READ_ACTIONS = new Set<WorkspaceAction>([
  "listConversationMessages",
  "listConversations",
  "listGallery",
  "listNotifications",
  "listPyqs",
  "markAllNotificationsRead",
  "markNotificationRead",
]);
const FACULTY_ACTIONS = new Set<WorkspaceAction>([
  "getOfficeHours",
  "listConversationMessages",
  "listConversations",
  "createPyq",
  "deletePyq",
  "listGallery",
  "listNotifications",
  "listPyqs",
  "listUsers",
  "markAllNotificationsRead",
  "markNotificationRead",
  "updateOwnProfile",
  "updateProfileMedia",
]);
const ADMIN_ACTIONS = new Set<WorkspaceAction>([
  "createGalleryItem",
  "createNotification",
  "createProfile",
  "createProfiles",
  "createPyq",
  "deleteGalleryItem",
  "deleteNotification",
  "deletePyq",
  "getOfficeHours",
  "listConversationMessages",
  "listConversations",
  "listGallery",
  "listNotifications",
  "listPyqs",
  "listUsers",
  "markAllNotificationsRead",
  "markNotificationRead",
  "saveBranding",
  "saveInstituteFeatures",
  "updateOwnProfile",
  "updateProfileMedia",
]);

let cachedCerts: { certs: Record<string, string>; expiresAt: number } = {
  certs: {},
  expiresAt: 0,
};

const configuredOrigins = (): string[] => (
  (Deno.env.get("APP_ORIGIN") || Deno.env.get("ALLOWED_ORIGINS") || "https://shii-edu.vercel.app")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);

const isLocalOrigin = (origin: string): boolean => (
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
);

const corsHeaders = (req: Request): HeadersInit => {
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

const toNumberOrNull = (value: unknown): number | null => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const compactStrings = (values: unknown[]): string[] => Array.from(new Set(
  values
    .map((value) => optionalText(value, 320))
    .filter((value): value is string => Boolean(value))
));

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
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("legacy_firestore_id", uid)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Authenticated user profile was not found in Supabase.");
  if (String(profile.status || "active").toLowerCase() !== "active") throw new Error("This user profile is not active.");

  let institute = null;
  if (profile.institute_id) {
    const { data, error } = await supabase
      .from("institutes")
      .select("id,institute_code,legacy_firestore_id,name,configuration,settings")
      .eq("id", profile.institute_id)
      .maybeSingle();

    if (error) throw error;
    institute = data;
  }

  return {
    institute,
    profile: profile as ProfileRow,
    role: String(profile.role || "").toLowerCase(),
    uid,
  };
};

const assertCanPerform = (actor: ActorContext, action: WorkspaceAction) => {
  if (actor.role === "superadmin") return;
  if (SELF_PROFILE_ACTIONS.has(action)) return;
  if (actor.role === "admin" && ADMIN_ACTIONS.has(action)) return;
  if ((actor.role === "teacher" || actor.role === "professor") && FACULTY_ACTIONS.has(action)) return;
  if ((actor.role === "student" || actor.role === "parent") && STUDENT_READ_ACTIONS.has(action)) return;
  throw new Error("You do not have permission to perform this Supabase workspace action.");
};

const requireInstituteId = (actor: ActorContext): string => {
  if (actor.profile.institute_id) return actor.profile.institute_id;
  throw new Error("Your profile is not linked to an institute.");
};

const findInstituteId = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  identifier: string
): Promise<string> => {
  const { data, error } = await supabase
    .from("institutes")
    .select("id")
    .or(`id.eq.${identifier},institute_code.eq.${identifier},legacy_firestore_id.eq.${identifier}`)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Institute was not found in Supabase.");
  return data.id as string;
};

const resolveTargetInstituteId = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  value: unknown,
  explicitTargetInstituteId?: string
): Promise<string> => {
  if (explicitTargetInstituteId) return explicitTargetInstituteId;
  const requestedInstituteId = optionalText(value, 180);

  if (actor.role === "superadmin") {
    return findInstituteId(supabase, requireText(requestedInstituteId, "Institute ID", 180));
  }

  const actorInstituteId = requireInstituteId(actor);
  const allowedIds = compactStrings([
    actorInstituteId,
    actor.institute?.id,
    actor.institute?.institute_code,
    actor.institute?.legacy_firestore_id,
  ]);
  if (requestedInstituteId && !allowedIds.includes(requestedInstituteId)) {
    throw new Error("You can only write profiles inside your own institute.");
  }
  return actorInstituteId;
};

const mapProfile = (row: ProfileRow) => {
  const metadata = row.metadata || {};
  return {
    id: row.legacy_firestore_id || row.id,
    supabaseId: row.id,
    uid: row.legacy_firestore_id || row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    loginId: row.login_id,
    uniqueId: row.unique_id,
    photoURL: row.photo_url,
    profilePic: row.photo_url,
    class: row.assigned_class || metadata.class || null,
    section: row.assigned_section || metadata.section || null,
    assignedClass: row.assigned_class,
    assignedSection: row.assigned_section,
    dept: row.assigned_department || metadata.dept || metadata.department || null,
    department: row.assigned_department || metadata.department || metadata.dept || null,
    sem: row.assigned_semester || metadata.sem || metadata.semester || null,
    semester: row.assigned_semester || metadata.semester || metadata.sem || null,
    degree: row.degree,
    experience: row.experience,
    teacherCode: row.teacher_code,
    teachingScope: row.teaching_scope || {},
    feePaid: row.fee_paid,
    totalFee: row.total_fee,
    feeBreakdown: row.fee_breakdown || [],
    linkedStudentName: metadata.linkedStudentName || null,
    linkedStudentUserId: metadata.linkedStudentUserId || null,
    relationship: metadata.relationship || null,
    vehicleId: metadata.vehicleId || null,
    routeName: metadata.routeName || null,
    fleetStatus: metadata.fleetStatus || null,
    dataSource: "supabase",
  };
};

const buildProfileRow = (payload: Record<string, unknown>, instituteId: string, actor: ActorContext) => {
  const role = String(payload.role || "").trim().toLowerCase();
  const allowedRoles = actor.role === "superadmin"
    ? ["admin", "driver", "parent", "student", "teacher"]
    : ["driver", "parent", "student", "teacher"];
  if (!allowedRoles.includes(role)) {
    throw new Error(`Role must be ${actor.role === "superadmin" ? "admin, " : ""}student, teacher, parent, or driver.`);
  }

  const loginId = requireText(payload.loginId || payload.uniqueId, "User ID", 80);
  const metadata = {
    authEmail: optionalText(payload.authEmail, 320),
    createdBy: optionalText(payload.createdBy, 180),
    importJobId: optionalText(payload.importJobId, 180),
    linkedStudentName: optionalText(payload.linkedStudentName, 180),
    linkedStudentUid: optionalText(payload.linkedStudentUid, 180),
    linkedStudentUserId: optionalText(payload.linkedStudentUserId, 80),
    parentContact: payload.parentContact && typeof payload.parentContact === "object" ? payload.parentContact : null,
    relationship: optionalText(payload.relationship, 80),
    routeName: optionalText(payload.routeName, 180),
    vehicleId: optionalText(payload.vehicleId, 120),
    fleetStatus: optionalText(payload.fleetStatus, 80),
    class: optionalText(payload.class, 80),
    section: optionalText(payload.section, 80),
    dept: optionalText(payload.dept, 120),
    sem: optionalText(payload.sem, 80),
  };

  return {
    assigned_class: optionalText(payload.assignedClass || payload.class || payload.standard, 80),
    assigned_department: optionalText(payload.assignedDept || payload.dept || payload.department, 120),
    assigned_section: optionalText(payload.assignedSection || payload.section, 80),
    assigned_semester: optionalText(payload.assignedSem || payload.sem || payload.semester, 80),
    degree: optionalText(payload.degree, 180),
    email: optionalText(payload.email, 320),
    experience: optionalText(payload.experience, 80),
    fee_breakdown: payload.feeBreakdown || [],
    fee_paid: optionalText(payload.feePaid, 80),
    full_name: requireText(payload.name || payload.fullName, "Name", 180),
    institute_id: instituteId,
    legacy_firestore_id: requireText(payload.uid, "Firebase UID", 180),
    login_id: loginId,
    login_id_key: requireText(payload.loginIdKey || loginId, "User ID", 80).toLowerCase(),
    metadata,
    phone: optionalText(payload.phone, 80),
    photo_url: optionalText(payload.photoURL || payload.profilePic || payload.photoUrl, 2000),
    role,
    status: optionalText(payload.status, 80) || "active",
    teacher_code: optionalText(payload.teacherCode, 80),
    teaching_scope: payload.teachingScope && typeof payload.teachingScope === "object" ? payload.teachingScope : {},
    total_fee: optionalText(payload.totalFee, 80),
    unique_id: requireText(payload.uniqueId || loginId, "User ID", 80),
    updated_at: new Date().toISOString(),
  };
};

const createProfile = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>,
  explicitTargetInstituteId?: string
) => {
  const instituteId = await resolveTargetInstituteId(supabase, actor, payload.instituteId, explicitTargetInstituteId);
  const row = buildProfileRow(payload, instituteId, actor);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "legacy_firestore_id" })
    .select("*")
    .single();

  if (error) throw error;
  return { profile: mapProfile(data as ProfileRow) };
};

const createProfiles = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>,
  explicitTargetInstituteId?: string
) => {
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  if (!profiles.length) throw new Error("At least one profile is required.");
  if (profiles.length > 500) throw new Error("A single Supabase mirror batch can contain at most 500 profiles.");

  const rows = await Promise.all(profiles.map(async (profile) => {
    if (!profile || typeof profile !== "object") throw new Error("Each profile must be an object.");
    const profilePayload = profile as Record<string, unknown>;
    const instituteId = await resolveTargetInstituteId(supabase, actor, profilePayload.instituteId, explicitTargetInstituteId);
    return buildProfileRow(profilePayload, instituteId, actor);
  }));

  const { data, error } = await supabase
    .from("profiles")
    .upsert(rows, { onConflict: "legacy_firestore_id" })
    .select("*");

  if (error) throw error;
  return { count: data?.length || 0, profiles: (data || []).map((row) => mapProfile(row as ProfileRow)) };
};

const listUsers = async (supabase: ReturnType<typeof getSupabaseClient>, actor: ActorContext) => {
  const instituteId = requireInstituteId(actor);
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("institute_id", instituteId)
    .neq("role", "superadmin")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return { users: (data || []).map((row) => mapProfile(row as ProfileRow)) };
};

const textArray = (value: unknown): string[] => (
  Array.isArray(value) ? compactStrings(value) : []
);

const isAdminRole = (role: string): boolean => role === "admin" || role === "superadmin";

const appNotificationRole = (role: string): string => (
  role === "professor" ? "teacher" : role
);

const notificationVisibleForActor = (
  notification: Record<string, unknown>,
  actor: ActorContext
): boolean => {
  if (isAdminRole(actor.role)) return true;

  const targetRoles = textArray(notification.target_roles).map((role) => role.toLowerCase());
  const recipientIds = textArray(notification.recipient_ids);
  const role = appNotificationRole(actor.role);
  const roleMatches = targetRoles.length === 0 || targetRoles.includes("all") || targetRoles.includes(role);
  const recipientMatches = recipientIds.length === 0 || recipientIds.includes(actor.profile.id);

  return roleMatches && recipientMatches;
};

const mapNotification = (row: Record<string, unknown>, actor: ActorContext) => {
  const readByProfileIds = textArray(row.read_by);
  const recipientProfileIds = textArray(row.recipient_ids);
  const actorHasRead = readByProfileIds.includes(actor.profile.id);
  const actorIsRecipient = recipientProfileIds.includes(actor.profile.id);

  return {
    ...(readObject(row.metadata)),
    author: readObject(row.author),
    createdAt: row.created_at,
    data: readObject(row.data),
    dataSource: "supabase",
    id: String(row.id || ""),
    isRead: actorHasRead,
    message: String(row.message || ""),
    notificationType: row.notification_type || "general",
    readBy: actorHasRead ? [actor.uid, actor.profile.id] : [],
    readByProfileIds,
    recipientProfileIds,
    recipientUids: actorIsRecipient ? [actor.uid] : [],
    relatedId: row.related_id || null,
    relatedType: row.related_type || null,
    supabaseId: String(row.id || ""),
    targetRoles: textArray(row.target_roles),
    title: String(row.title || "Notification"),
    type: row.notification_type || "info",
    updatedAt: row.updated_at,
  };
};

const findVisibleNotification = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  id: unknown
) => {
  const notificationId = requireText(id, "Notification ID", 80);
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("institute_id", requireInstituteId(actor))
    .maybeSingle();

  if (error) throw error;
  if (!data || !notificationVisibleForActor(data as Record<string, unknown>, actor)) {
    throw new Error("Notification not found.");
  }

  return data as Record<string, unknown>;
};

const listNotifications = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const requestedLimit = Number(payload.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("institute_id", requireInstituteId(actor))
    .order("created_at", { ascending: false })
    .limit(isAdminRole(actor.role) ? limit : Math.min(limit * 4, 200));

  if (error) throw error;
  return {
    notifications: (data || [])
      .filter((row) => notificationVisibleForActor(row as Record<string, unknown>, actor))
      .slice(0, limit)
      .map((row) => mapNotification(row as Record<string, unknown>, actor)),
  };
};

const resolveRecipientProfileIds = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
): Promise<string[]> => {
  const directIds = textArray(payload.recipientIds || payload.recipientProfileIds);
  const legacyIds = textArray(payload.recipientUids || payload.recipientLegacyIds);
  if (!legacyIds.length) return directIds;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("institute_id", requireInstituteId(actor))
    .in("legacy_firestore_id", legacyIds);

  if (error) throw error;
  return Array.from(new Set([
    ...directIds,
    ...(data || []).map((row) => String(row.id)),
  ]));
};

const createNotification = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  if (!isAdminRole(actor.role)) throw new Error("Only administrators can create notifications.");

  const targetRoles = textArray(payload.targetRoles || payload.target_roles);
  const row = {
    author: readObject(payload.author) || {
      name: actor.profile.full_name,
      role: actor.role,
      uid: actor.uid,
    },
    data: readObject(payload.data),
    institute_id: requireInstituteId(actor),
    message: requireText(payload.message, "Message", 4000),
    metadata: readObject(payload.metadata),
    notification_type: optionalText(payload.type || payload.notificationType || payload.notification_type, 80) || "info",
    recipient_ids: await resolveRecipientProfileIds(supabase, actor, payload),
    related_id: optionalText(payload.relatedId || payload.related_id, 200),
    related_type: optionalText(payload.relatedType || payload.related_type, 100),
    target_roles: targetRoles.length ? targetRoles : ["all"],
    title: requireText(payload.title, "Title", 240),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return { notification: mapNotification(data as Record<string, unknown>, actor) };
};

const markNotificationRead = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const notification = await findVisibleNotification(supabase, actor, payload.id);
  const readBy = Array.from(new Set([...textArray(notification.read_by), actor.profile.id]));
  const { error } = await supabase
    .from("notifications")
    .update({ read_by: readBy, updated_at: new Date().toISOString() })
    .eq("id", notification.id)
    .eq("institute_id", requireInstituteId(actor));

  if (error) throw error;
  return { id: notification.id, read: true };
};

const markAllNotificationsRead = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  const { notifications } = await listNotifications(supabase, actor, { limit: 100 });
  await Promise.all(notifications.map((notification) => markNotificationRead(supabase, actor, {
    id: (notification as Record<string, unknown>).id,
  })));
  return { count: notifications.length, read: true };
};

const deleteNotification = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  if (!isAdminRole(actor.role)) throw new Error("Only administrators can delete notifications.");
  const id = requireText(payload.id, "Notification ID", 80);
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("institute_id", requireInstituteId(actor));

  if (error) throw error;
  return { deleted: true, id };
};

const conversationVisibleForActor = (
  conversation: Record<string, unknown>,
  actor: ActorContext
): boolean => {
  const participantIds = textArray(conversation.participant_ids);
  const participantLegacyIds = textArray(conversation.participant_legacy_ids);
  return participantIds.includes(actor.profile.id) || participantLegacyIds.includes(actor.uid);
};

const loadParticipantProfiles = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  instituteId: string,
  conversations: Record<string, unknown>[]
) => {
  const profileIds = Array.from(new Set(conversations.flatMap((conversation) => textArray(conversation.participant_ids))));
  const legacyIds = Array.from(new Set(conversations.flatMap((conversation) => textArray(conversation.participant_legacy_ids))));
  let rows: ProfileRow[] = [];

  if (profileIds.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("institute_id", instituteId)
      .in("id", profileIds);
    if (error) throw error;
    rows = [...rows, ...((data || []) as ProfileRow[])];
  }

  if (legacyIds.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("institute_id", instituteId)
      .in("legacy_firestore_id", legacyIds);
    if (error) throw error;
    rows = [...rows, ...((data || []) as ProfileRow[])];
  }

  return new Map(rows.map((row) => [row.id, mapProfile(row)]));
};

const mapConversation = (
  conversation: Record<string, unknown>,
  profilesById: Map<string, ReturnType<typeof mapProfile>>
) => {
  const participantIds = textArray(conversation.participant_ids);
  const participantProfiles = participantIds
    .map((id) => profilesById.get(id))
    .filter(Boolean);

  return {
    createdAt: conversation.created_at,
    dataSource: "supabase",
    id: String(conversation.id || ""),
    lastMessage: conversation.last_message || "",
    lastMessageAt: conversation.last_message_at || conversation.updated_at || conversation.created_at,
    metadata: readObject(conversation.metadata),
    participantProfiles,
    participants: participantProfiles.map((profile) => profile?.uid).filter(Boolean),
    supabaseId: String(conversation.id || ""),
    title: conversation.title || null,
    updatedAt: conversation.updated_at,
  };
};

const listConversations = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  const instituteId = requireInstituteId(actor);
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("institute_id", instituteId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  const visibleConversations = (data || [])
    .map((row) => row as Record<string, unknown>)
    .filter((row) => conversationVisibleForActor(row, actor));
  const profilesById = await loadParticipantProfiles(supabase, instituteId, visibleConversations);

  return {
    conversations: visibleConversations.map((row) => mapConversation(row, profilesById)),
  };
};

const findVisibleConversation = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  id: unknown
) => {
  const conversationId = requireText(id, "Conversation ID", 100);
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("institute_id", requireInstituteId(actor))
    .maybeSingle();

  if (error) throw error;
  if (!data || !conversationVisibleForActor(data as Record<string, unknown>, actor)) {
    throw new Error("Conversation not found.");
  }

  return data as Record<string, unknown>;
};

const listConversationMessages = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const conversation = await findVisibleConversation(supabase, actor, payload.conversationId);
  const { data, error } = await supabase
    .from("messages")
    .select("*,sender:profiles!messages_sender_id_fkey(*)")
    .eq("conversation_id", conversation.id)
    .eq("institute_id", requireInstituteId(actor))
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) throw error;
  return {
    messages: (data || []).map((row) => {
      const record = row as Record<string, unknown>;
      const sender = readObject(record.sender);
      return {
        createdAt: record.created_at,
        dataSource: "supabase",
        id: String(record.id || ""),
        message: String(record.body || ""),
        readByProfileIds: textArray(record.read_by),
        senderName: sender.full_name || "User",
        senderRole: sender.role || "user",
        senderUid: record.sender_legacy_id || sender.legacy_firestore_id || record.sender_id,
        supabaseId: String(record.id || ""),
      };
    }),
  };
};

const getOfficeHours = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext
) => {
  if (!["admin", "teacher", "professor"].includes(actor.role)) {
    throw new Error("Only faculty and administrators can view office hours.");
  }

  const { data, error } = await supabase
    .from("office_hour_policies")
    .select("*")
    .eq("teacher_id", actor.profile.id)
    .maybeSingle();

  if (error) throw error;
  const policy = readObject(data?.policy);
  return {
    officeHours: data ? {
      days: Array.isArray(policy.days) ? policy.days : ["mon", "tue", "wed", "thu", "fri"],
      endTime: policy.endTime || "17:00",
      startTime: policy.startTime || "09:00",
      timeZone: policy.timeZone || "Asia/Kolkata",
      updatedAt: data.updated_at,
    } : null,
  };
};

const updateOwnProfile = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined || payload.fullName !== undefined) {
    update.full_name = requireText(payload.name || payload.fullName, "Name", 180);
  }
  if (payload.degree !== undefined) update.degree = optionalText(payload.degree, 180);
  if (payload.experience !== undefined) update.experience = optionalText(payload.experience, 80);
  if (payload.phone !== undefined) update.phone = optionalText(payload.phone, 80);

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", actor.profile.id)
    .select("*")
    .single();

  if (error) throw error;
  return { profile: mapProfile(data as ProfileRow) };
};

const updateProfileMedia = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const secureUrl = requireText(payload.secureUrl || payload.photoURL || payload.profilePic, "Profile image URL", 2000);
  const metadata = {
    ...(actor.profile.metadata || {}),
    supabaseProfileImage: {
      assetId: optionalText(payload.assetId, 120),
      bytes: toNumberOrNull(payload.bytes),
      format: optionalText(payload.format, 40),
      height: toNumberOrNull(payload.height),
      mimeType: optionalText(payload.mimeType, 120),
      provider: optionalText(payload.provider, 40) || "supabase",
      publicId: optionalText(payload.publicId, 1000),
      secureUrl,
      storageBucket: optionalText(payload.storageBucket, 80),
      storagePath: optionalText(payload.storagePath, 1000),
      supabasePath: optionalText(payload.supabasePath, 1000),
      transformation: optionalText(payload.transformation, 200),
      updatedAt: new Date().toISOString(),
      width: toNumberOrNull(payload.width),
    },
  };

  const { data, error } = await supabase
    .from("profiles")
    .update({ metadata, photo_url: secureUrl, updated_at: new Date().toISOString() })
    .eq("id", actor.profile.id)
    .select("*")
    .single();

  if (error) throw error;
  return { profile: mapProfile(data as ProfileRow) };
};

const listPyqs = async (supabase: ReturnType<typeof getSupabaseClient>, actor: ActorContext) => {
  const { data, error } = await supabase
    .from("pyqs")
    .select("*")
    .eq("institute_id", requireInstituteId(actor))
    .order("created_at", { ascending: false });

  if (error) throw error;
  return {
    papers: (data || []).map((item) => ({
      ...(item.metadata || {}),
      assetProvider: "supabase",
      createdAt: item.created_at,
      fileUrl: item.file_url,
      id: item.id,
      publicId: item.public_id,
      storagePath: item.public_id,
      subject: item.subject,
      supabaseId: item.id,
      title: item.title,
      uploadedBy: item.uploaded_by_name,
      year: item.year,
      dataSource: "supabase",
    })),
  };
};

const listGallery = async (supabase: ReturnType<typeof getSupabaseClient>, actor: ActorContext) => {
  const { data, error } = await supabase
    .from("gallery")
    .select("*")
    .eq("institute_id", requireInstituteId(actor))
    .order("created_at", { ascending: false });

  if (error) throw error;
  return {
    images: (data || []).map((item) => ({
      ...(item.metadata || {}),
      assetProvider: "supabase",
      createdAt: item.created_at,
      id: item.id,
      imageUrl: item.image_url,
      storagePath: item.metadata?.storagePath || null,
      supabaseId: item.id,
      title: item.title,
      uploadedBy: item.uploaded_by_name,
      dataSource: "supabase",
    })),
  };
};

const createMediaAsset = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>,
  purpose: string
) => {
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      bucket: optionalText(payload.storageBucket || payload.bucket, 80),
      byte_size: toNumberOrNull(payload.fileSize || payload.bytes),
      file_name: optionalText(payload.fileName, 240),
      height: toNumberOrNull(payload.height),
      institute_id: requireInstituteId(actor),
      metadata: payload,
      mime_type: optionalText(payload.mimeType, 120),
      owner_id: actor.profile.id,
      provider: "supabase",
      public_url: requireText(payload.fileUrl || payload.imageUrl || payload.secureUrl, "File URL", 2000),
      purpose,
      resource_type: optionalText(payload.resourceType, 40) || (purpose === "gallery" ? "image" : "raw"),
      storage_path: optionalText(payload.storagePath || payload.supabasePath || payload.publicId, 1000),
      title: optionalText(payload.title, 240),
      width: toNumberOrNull(payload.width),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
};

const createPyq = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const mediaId = await createMediaAsset(supabase, actor, payload, "pyq");
  const { data, error } = await supabase
    .from("pyqs")
    .insert({
      document_media_id: mediaId,
      file_url: requireText(payload.fileUrl || payload.secureUrl, "File URL", 2000),
      institute_id: requireInstituteId(actor),
      metadata: payload,
      public_id: optionalText(payload.storagePath || payload.supabasePath || payload.publicId, 1000),
      subject: requireText(payload.subject, "Subject", 180),
      title: requireText(payload.title, "Title", 220),
      uploaded_by: actor.profile.id,
      uploaded_by_name: actor.profile.full_name,
      year: requireText(payload.year, "Year", 20),
    })
    .select("*")
    .single();

  if (error) throw error;
  return { paper: data };
};

const createGalleryItem = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const mediaId = await createMediaAsset(supabase, actor, payload, "gallery");
  const { data, error } = await supabase
    .from("gallery")
    .insert({
      image_url: requireText(payload.imageUrl || payload.fileUrl || payload.secureUrl, "Image URL", 2000),
      institute_id: requireInstituteId(actor),
      media_id: mediaId,
      metadata: payload,
      title: optionalText(payload.title, 220),
      uploaded_by: actor.profile.id,
      uploaded_by_name: actor.profile.full_name,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { image: data };
};

const deleteById = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  table: "gallery" | "pyqs",
  id: unknown
) => {
  const itemId = requireText(id, "Item ID", 80);
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", itemId)
    .eq("institute_id", requireInstituteId(actor));

  if (error) throw error;
  return { deleted: true, id: itemId };
};

const saveBranding = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  const instituteId = requireInstituteId(actor);
  const logoUrl = optionalText(payload.logoUrl, 2000);
  const paletteId = requireText(payload.paletteId, "Palette", 120);

  const { data: institute, error: loadError } = await supabase
    .from("institutes")
    .select("configuration,settings")
    .eq("id", instituteId)
    .single();

  if (loadError) throw loadError;

  const configuration = {
    ...(institute?.configuration || {}),
    branding: {
      ...((institute?.configuration || {}).branding || {}),
      logoUrl,
      paletteId,
      provider: "supabase",
      updatedAt: new Date().toISOString(),
    },
  };
  const settings = {
    ...(institute?.settings || {}),
    branding: {
      ...((institute?.settings || {}).branding || {}),
      logoUrl,
      paletteId,
      provider: "supabase",
      updatedAt: new Date().toISOString(),
    },
    theme: "white-label",
  };

  const { data, error } = await supabase
    .from("institutes")
    .update({ configuration, logo_url: logoUrl, settings, updated_at: new Date().toISOString() })
    .eq("id", instituteId)
    .select("*")
    .single();

  if (error) throw error;
  return { institute: data };
};

const loadInstituteByPublicId = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  instituteId: string
) => {
  const byLegacy = await supabase
    .from("institutes")
    .select("id,configuration,settings")
    .eq("legacy_firestore_id", instituteId)
    .maybeSingle();

  if (byLegacy.error) throw byLegacy.error;
  if (byLegacy.data) return byLegacy.data;

  const byCode = await supabase
    .from("institutes")
    .select("id,configuration,settings")
    .eq("institute_code", instituteId)
    .maybeSingle();

  if (byCode.error) throw byCode.error;
  if (byCode.data) return byCode.data;

  throw new Error("Institute not found.");
};

const saveInstituteFeatures = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  if (actor.role !== "superadmin") throw new Error("Only Superadmin can update institute feature access.");

  const publicInstituteId = requireText(payload.instituteId, "Institute ID", 160);
  const features = readObject(payload.features);
  const institute = await loadInstituteByPublicId(supabase, publicInstituteId);
  const configuration = {
    ...((institute?.configuration || {}) as Record<string, unknown>),
    features,
  };
  const settings = {
    ...((institute?.settings || {}) as Record<string, unknown>),
    features,
  };

  const { data, error } = await supabase
    .from("institutes")
    .update({ configuration, settings, updated_at: new Date().toISOString() })
    .eq("id", institute.id)
    .select("id,institute_code,legacy_firestore_id,name,configuration,settings")
    .single();

  if (error) throw error;
  return { institute: data };
};

const normalizeInstitutionType = (value: unknown): "school" | "college" => (
  String(value || "").trim().toLowerCase() === "college" ? "college" : "school"
);

const buildInstituteRow = (payload: Record<string, unknown>) => {
  const branding = readObject(payload.branding);
  const configuration = readObject(payload.configuration);
  const settings = readObject(payload.settings);
  const publicInstituteId = requireText(payload.instituteId || payload.id, "Institute ID", 120);
  const institutionType = normalizeInstitutionType(payload.institutionType || payload.type);
  const name = requireText(payload.name || payload.instituteName, "Institute name", 220);

  return {
    academic_model: readObject(payload.academicModel),
    configuration: { ...configuration, branding, instituteId: publicInstituteId },
    dark_primary_color: optionalText(branding.darkPrimaryColor, 80) || "#09090B",
    dark_secondary_color: optionalText(branding.darkSecondaryColor, 80) || "#18181B",
    institute_code: publicInstituteId,
    institution_type: institutionType,
    legacy_firestore_id: publicInstituteId,
    logo_url: optionalText(branding.logoUrl || payload.logoUrl, 2000),
    name,
    name_key: optionalText(payload.nameKey, 240) || name.toLowerCase(),
    primary_color: optionalText(branding.primaryColor, 80) || "#2563EB",
    schema_version: Number(payload.schemaVersion || 3) || 3,
    secondary_color: optionalText(branding.secondaryColor, 80) || "#475569",
    settings: {
      ...settings,
      branding: readObject(settings.branding).primaryColor ? settings.branding : branding,
      institutionType: institutionType.toUpperCase(),
    },
    updated_at: new Date().toISOString(),
  };
};

const createInstituteWithProfiles = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  payload: Record<string, unknown>
) => {
  if (actor.role !== "superadmin") throw new Error("Only Superadmin can create institutes.");

  const institutePayload = readObject(payload.institute);
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  if (!profiles.length) throw new Error("At least one administrator profile is required.");

  const { data: institute, error: instituteError } = await supabase
    .from("institutes")
    .upsert(buildInstituteRow(institutePayload), { onConflict: "legacy_firestore_id" })
    .select("id,institute_code,legacy_firestore_id,name,institution_type")
    .single();

  if (instituteError) throw instituteError;

  const profileResult = await createProfiles(supabase, actor, { profiles }, institute.id as string);
  return {
    institute,
    profileCount: profileResult.count,
    profiles: profileResult.profiles,
  };
};

const handleAction = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  actor: ActorContext,
  body: RequestBody
) => {
  if (!body.action) throw new Error("A Supabase workspace action is required.");
  assertCanPerform(actor, body.action);
  const payload = body.payload || {};

  switch (body.action) {
    case "createGalleryItem":
      return createGalleryItem(supabase, actor, payload);
    case "createInstituteWithProfiles":
      return createInstituteWithProfiles(supabase, actor, payload);
    case "createNotification":
      return createNotification(supabase, actor, payload);
    case "createProfile":
      return createProfile(supabase, actor, payload);
    case "createProfiles":
      return createProfiles(supabase, actor, payload);
    case "createPyq":
      return createPyq(supabase, actor, payload);
    case "deleteGalleryItem":
      return deleteById(supabase, actor, "gallery", payload.id);
    case "deleteNotification":
      return deleteNotification(supabase, actor, payload);
    case "deletePyq":
      return deleteById(supabase, actor, "pyqs", payload.id);
    case "getOfficeHours":
      return getOfficeHours(supabase, actor);
    case "listConversationMessages":
      return listConversationMessages(supabase, actor, payload);
    case "listConversations":
      return listConversations(supabase, actor);
    case "listGallery":
      return listGallery(supabase, actor);
    case "listNotifications":
      return listNotifications(supabase, actor, payload);
    case "listPyqs":
      return listPyqs(supabase, actor);
    case "listUsers":
      return listUsers(supabase, actor);
    case "markAllNotificationsRead":
      return markAllNotificationsRead(supabase, actor);
    case "markNotificationRead":
      return markNotificationRead(supabase, actor, payload);
    case "saveBranding":
      return saveBranding(supabase, actor, payload);
    case "saveInstituteFeatures":
      return saveInstituteFeatures(supabase, actor, payload);
    case "updateOwnProfile":
      return updateOwnProfile(supabase, actor, payload);
    case "updateProfileMedia":
      return updateProfileMedia(supabase, actor, payload);
    default:
      throw new Error("Unsupported Supabase workspace action.");
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req), status: 204 });
  if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed." });

  try {
    const token = readAuthToken(req);
    const [verified, body] = await Promise.all([
      verifyFirebaseToken(token),
      req.json() as Promise<RequestBody>,
    ]);
    const supabase = getSupabaseClient();
    const actor = await loadActor(supabase, verified.uid);
    const result = await handleAction(supabase, actor, body);

    return json(req, 200, {
      ...result,
      dataSource: "supabase",
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase workspace request failed.";
    const status = /permission|not active|not found|missing firebase|invalid firebase/i.test(message) ? 403 : 400;
    return json(req, status, {
      success: false,
      error: message,
    });
  }
});
