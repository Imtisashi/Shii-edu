import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { importX509, jwtVerify } from "https://esm.sh/jose@5.9.6";

type UploadResourceType = "image" | "raw" | "video";

type UploadRequest = {
  context?: Record<string, boolean | number | string>;
  fileName: string;
  fileSize?: number;
  folder: string;
  instituteId?: string;
  mimeType: string;
  resourceType?: UploadResourceType;
};

type ProfileRow = {
  id: string;
  institute_id: string | null;
  legacy_firestore_id: string | null;
  role: string;
  status: string | null;
};

type InstituteRow = {
  id: string;
  institute_code: string | null;
  legacy_firestore_id: string | null;
};

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "edu-hub-1fce7";
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};

const SAFE_FOLDERS = new Set([
  "assignments",
  "course-media",
  "gallery",
  "institute-branding",
  "profile-pictures",
  "pyqs",
  "syllabi",
]);

const FOLDER_BUCKETS: Record<string, "assets" | "avatars" | "course-media" | "logos"> = {
  assignments: "assets",
  "course-media": "course-media",
  gallery: "assets",
  "institute-branding": "logos",
  "profile-pictures": "avatars",
  pyqs: "assets",
  syllabi: "assets",
};

const FOLDER_ROLES: Record<string, Set<string>> = {
  assignments: new Set(["admin", "superadmin", "teacher", "professor"]),
  "course-media": new Set(["admin", "superadmin", "teacher", "professor"]),
  gallery: new Set(["admin", "superadmin"]),
  "institute-branding": new Set(["admin", "superadmin"]),
  "profile-pictures": new Set(["admin", "driver", "parent", "professor", "student", "superadmin", "teacher"]),
  pyqs: new Set(["admin", "superadmin", "teacher", "professor"]),
  syllabi: new Set(["admin", "superadmin", "teacher", "professor"]),
};

const MAX_BYTES_BY_FOLDER: Record<string, number> = {
  assignments: 25 * 1024 * 1024,
  "course-media": 100 * 1024 * 1024,
  gallery: 12 * 1024 * 1024,
  "institute-branding": 8 * 1024 * 1024,
  "profile-pictures": 8 * 1024 * 1024,
  pyqs: 25 * 1024 * 1024,
  syllabi: 25 * 1024 * 1024,
};

let cachedCerts: { certs: Record<string, string>; expiresAt: number } = {
  certs: {},
  expiresAt: 0,
};

const configuredOrigins = (): string[] => {
  const origins = [
    Deno.env.get("APP_ORIGIN") || "https://shii-edu.vercel.app",
    ...(Deno.env.get("ALLOWED_ORIGINS") || "").split(","),
  ];
  return origins.map((origin) => origin.trim()).filter(Boolean);
};

const isLocalOrigin = (origin: string): boolean => (
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
);

const corsHeaders = (req: Request): HeadersInit => {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = configuredOrigins().includes(origin) || isLocalOrigin(origin)
    ? origin
    : configuredOrigins()[0];

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

const cleanPathPart = (value: string, fallback = ""): string => {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "").trim())
    .filter(Boolean)
    .join("-");

  return cleaned || fallback;
};

const resolveFolderKey = (folder: string): string => {
  const segments = String(folder || "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  const exact = segments.find((segment) => SAFE_FOLDERS.has(segment));
  if (exact) return exact;

  const direct = segments.join("-");
  if (SAFE_FOLDERS.has(direct)) return direct;

  throw new Error("This upload destination is not allowed.");
};

const parseUploadRequest = async (req: Request): Promise<UploadRequest> => {
  const body = await req.json().catch(() => null) as Partial<UploadRequest> | null;
  if (!body || typeof body !== "object") throw new Error("Invalid upload request body.");

  const fileName = String(body.fileName || "").trim();
  const folder = String(body.folder || "").trim();
  const mimeType = String(body.mimeType || "").trim().toLowerCase();
  const resourceType = body.resourceType === "raw" || body.resourceType === "video" ? body.resourceType : "image";
  const fileSize = Number(body.fileSize || 0);

  if (!fileName || fileName.length > 240) throw new Error("A valid file name is required.");
  if (!folder || folder.length > 240) throw new Error("A valid upload folder is required.");
  if (!mimeType || mimeType.length > 120 || !mimeType.includes("/")) throw new Error("A valid file MIME type is required.");
  if (fileSize < 0) throw new Error("File size is invalid.");

  return {
    context: body.context || {},
    fileName,
    fileSize,
    folder,
    instituteId: String(body.instituteId || "").trim(),
    mimeType,
    resourceType,
  };
};

const assertRoleCanUpload = (role: string, folderKey: string) => {
  if (FOLDER_ROLES[folderKey]?.has(role)) return;
  throw new Error("You do not have permission to upload media to this area.");
};

const assertMimeTypeIsAllowed = (folderKey: string, mimeType: string, resourceType: UploadResourceType) => {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf" || mimeType.endsWith("/pdf");
  const isVideo = mimeType.startsWith("video/");

  if (["gallery", "institute-branding", "profile-pictures"].includes(folderKey) && resourceType === "image" && isImage) return;
  if (["pyqs", "syllabi"].includes(folderKey) && resourceType === "raw" && isPdf) return;
  if (folderKey === "assignments" && ((resourceType === "raw" && isPdf) || (resourceType === "image" && isImage))) return;
  if (folderKey === "course-media" && ((resourceType === "video" && isVideo) || (resourceType === "raw" && isPdf) || (resourceType === "image" && isImage))) return;

  throw new Error("The selected file type is not allowed for this upload.");
};

const assertFileSizeIsAllowed = (folderKey: string, fileSize = 0) => {
  const maxBytes = MAX_BYTES_BY_FOLDER[folderKey];
  if (!fileSize || fileSize <= maxBytes) return;
  throw new Error(`Selected file is too large. The limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
};

const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase Edge Function service credentials are missing.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const loadProfile = async (supabase: ReturnType<typeof getSupabaseClient>, uid: string): Promise<ProfileRow> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,institute_id,legacy_firestore_id,role,status")
    .eq("legacy_firestore_id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Authenticated user profile was not found in Supabase.");
  if (String(data.status || "active").toLowerCase() !== "active") throw new Error("This user profile is not active.");
  return data as ProfileRow;
};

const loadInstitute = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  profile: ProfileRow
): Promise<InstituteRow | null> => {
  if (!profile.institute_id) return null;

  const { data, error } = await supabase
    .from("institutes")
    .select("id,institute_code,legacy_firestore_id")
    .eq("id", profile.institute_id)
    .maybeSingle();

  if (error) throw error;
  return data as InstituteRow | null;
};

const resolveStorageTenantId = ({
  folderKey,
  institute,
  profile,
}: {
  folderKey: string;
  institute: InstituteRow | null;
  profile: ProfileRow;
}): string => {
  const tenantId = institute?.legacy_firestore_id || institute?.institute_code || institute?.id || profile.institute_id || "";
  if (tenantId) return tenantId;
  if (folderKey === "profile-pictures") return `profile-${profile.legacy_firestore_id || profile.id}`;
  throw new Error("Your profile is not linked to an institute.");
};

const buildStoragePath = (tenantId: string, folderKey: string, fileName: string): string => {
  const safeTenantId = cleanPathPart(tenantId, "unknown-institute");
  const safeFileName = cleanPathPart(fileName, `upload-${Date.now()}`);
  const random = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(random).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${safeTenantId}/${folderKey}/${Date.now()}-${suffix}-${safeFileName}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req), status: 204 });
  if (req.method !== "POST") return json(req, 405, { success: false, error: "Method not allowed." });

  try {
    const token = readAuthToken(req);
    const [{ uid }, body] = await Promise.all([
      verifyFirebaseToken(token),
      parseUploadRequest(req),
    ]);
    const folderKey = resolveFolderKey(body.folder);
    const supabase = getSupabaseClient();
    const profile = await loadProfile(supabase, uid);
    const role = String(profile.role || "").toLowerCase();
    const institute = await loadInstitute(supabase, profile);
    const tenantId = resolveStorageTenantId({ folderKey, institute, profile });
    const bucket = FOLDER_BUCKETS[folderKey];
    const path = buildStoragePath(tenantId, folderKey, body.fileName);

    assertRoleCanUpload(role, folderKey);
    assertMimeTypeIsAllowed(folderKey, body.mimeType, body.resourceType || "image");
    assertFileSizeIsAllowed(folderKey, body.fileSize);

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) throw error;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl || null;

    return json(req, 200, {
      bucket,
      contentType: body.mimeType,
      deliveryType: "upload",
      expiresInSeconds: 7200,
      folder: folderKey,
      instituteId: tenantId,
      maxBytes: MAX_BYTES_BY_FOLDER[folderKey],
      path,
      provider: "supabase",
      publicUrl,
      resourceType: body.resourceType || "image",
      signedUrl: data.signedUrl,
      storageUrl: Deno.env.get("SUPABASE_URL"),
      token: data.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare Supabase upload.";
    const status = /permission|not active|not found|missing firebase|invalid firebase/i.test(message) ? 403 : 400;
    return json(req, status, {
      success: false,
      error: message,
    });
  }
});
