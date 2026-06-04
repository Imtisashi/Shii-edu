const { getSupabaseAdmin } = require('./supabaseAdmin');
const { toIdentifierKey } = require('./loginIdentifiers');

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const optionalText = (value, max = 1000) => {
  if (value === null || value === undefined) return null;
  const text = normalizeText(value);
  if (!text) return null;
  return text.slice(0, max);
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const requireText = (value, label, max = 500) => {
  const text = optionalText(value, max);
  if (!text) {
    const error = new Error(`${label} is required for Supabase profile sync.`);
    error.statusCode = 400;
    throw error;
  }
  return text;
};

const resolveActorRole = (actor) => normalizeRole(actor?.role || actor?.profile?.role);

const resolveInstituteId = (actor, profile) => {
  const actorRole = resolveActorRole(actor);
  const actorInstituteId = optionalText(actor?.profile?.instituteId || actor?.profile?.institute_id, 120);
  const profileInstituteId = requireText(profile.instituteId || profile.institute_id, 'Institute ID', 120);

  if (actorRole !== 'superadmin' && actorInstituteId && actorInstituteId !== profileInstituteId) {
    const error = new Error('Admins can only sync Supabase profiles inside their own institute.');
    error.statusCode = 403;
    throw error;
  }

  return profileInstituteId;
};

const resolveSupabaseInstituteId = async ({ cache, instituteId, supabase }) => {
  const publicInstituteId = requireText(instituteId, 'Institute ID', 120);
  if (cache.has(publicInstituteId)) return cache.get(publicInstituteId);

  let data = null;
  let error = null;

  if (isUuid(publicInstituteId)) {
    const result = await supabase
      .from('institutes')
      .select('id')
      .eq('id', publicInstituteId)
      .maybeSingle();
    data = result.data;
    error = result.error;
  }

  if (!data && !error) {
    const result = await supabase
      .from('institutes')
      .select('id')
      .eq('institute_code', publicInstituteId)
      .maybeSingle();
    data = result.data;
    error = result.error;
  }

  if (!data && !error) {
    const result = await supabase
      .from('institutes')
      .select('id')
      .eq('legacy_firestore_id', publicInstituteId)
      .maybeSingle();
    data = result.data;
    error = result.error;
  }

  if (error) {
    error.statusCode = 502;
    throw error;
  }

  if (!data?.id) {
    const notFound = new Error(`Supabase institute ${publicInstituteId} was not found.`);
    notFound.statusCode = 404;
    throw notFound;
  }

  cache.set(publicInstituteId, data.id);
  return data.id;
};

const buildProfileMetadata = (profile) => ({
  authEmail: optionalText(profile.authEmail, 320),
  createdBy: optionalText(profile.createdBy, 180),
  fleetStatus: optionalText(profile.fleetStatus, 80),
  importJobId: optionalText(profile.importJobId, 180),
  linkedStudentName: optionalText(profile.linkedStudentName, 180),
  linkedStudentUid: optionalText(profile.linkedStudentUid, 180),
  linkedStudentUserId: optionalText(profile.linkedStudentUserId, 80),
  parentContact: profile.parentContact && typeof profile.parentContact === 'object' ? profile.parentContact : null,
  relationship: optionalText(profile.relationship, 80),
  routeName: optionalText(profile.routeName, 180),
  vehicleId: optionalText(profile.vehicleId, 120),
  class: optionalText(profile.class || profile.standard, 80),
  section: optionalText(profile.section, 80),
  dept: optionalText(profile.dept || profile.department, 120),
  sem: optionalText(profile.sem || profile.semester, 80),
});

const buildProfileRow = ({ actor, profile, supabaseInstituteId }) => {
  const role = normalizeRole(profile.role);
  if (!['admin', 'driver', 'parent', 'student', 'teacher'].includes(role)) {
    const error = new Error('Role must be admin, student, teacher, parent, or driver for Supabase profile sync.');
    error.statusCode = 400;
    throw error;
  }

  const loginId = requireText(profile.loginId || profile.uniqueId || profile.teacherCode, 'User ID', 80);

  return {
    assigned_class: optionalText(profile.assignedClass || profile.class || profile.standard, 80),
    assigned_department: optionalText(profile.assignedDept || profile.dept || profile.department, 120),
    assigned_section: optionalText(profile.assignedSection || profile.section, 80),
    assigned_semester: optionalText(profile.assignedSem || profile.sem || profile.semester, 80),
    degree: optionalText(profile.degree, 180),
    email: optionalText(profile.email, 320),
    experience: optionalText(profile.experience, 80),
    full_name: requireText(profile.name || profile.fullName, 'Name', 180),
    institute_id: supabaseInstituteId,
    legacy_firestore_id: requireText(profile.uid || profile.id, 'Firebase UID', 180),
    login_id: loginId,
    login_id_key: optionalText(profile.loginIdKey, 80) || toIdentifierKey(loginId),
    metadata: buildProfileMetadata(profile),
    phone: optionalText(profile.phone, 80),
    photo_url: optionalText(profile.photoURL || profile.photoUrl || profile.profilePic, 2000),
    role,
    status: optionalText(profile.status, 80) || 'active',
    teacher_code: optionalText(profile.teacherCode, 80),
    teaching_scope: profile.teachingScope && typeof profile.teachingScope === 'object' ? profile.teachingScope : {},
    total_fee: Number(profile.totalFee || 0) || null,
    fee_paid: Number(profile.feePaid || 0) || null,
    fee_breakdown: Array.isArray(profile.feeBreakdown) ? profile.feeBreakdown : [],
    unique_id: requireText(profile.uniqueId || profile.loginId || loginId, 'User ID', 80),
    updated_at: new Date().toISOString(),
  };
};

const mirrorProfilesToSupabase = async ({ actor, profiles }) => {
  const profileList = Array.isArray(profiles) ? profiles : [profiles].filter(Boolean);
  if (profileList.length === 0) return { count: 0, profiles: [] };

  const supabase = getSupabaseAdmin();
  const instituteCache = new Map();
  const rows = [];

  for (const profile of profileList) {
    const publicInstituteId = resolveInstituteId(actor, profile);
    const supabaseInstituteId = await resolveSupabaseInstituteId({
      cache: instituteCache,
      instituteId: publicInstituteId,
      supabase,
    });
    rows.push(buildProfileRow({ actor, profile, supabaseInstituteId }));
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(rows, { onConflict: 'legacy_firestore_id' })
    .select('id,legacy_firestore_id,login_id,role,institute_id');

  if (error) {
    error.statusCode = 502;
    throw error;
  }

  return {
    count: data?.length || 0,
    profiles: data || [],
  };
};

const normalizeInstitutionType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'college' ? 'college' : 'school';
};

const resolveBrandingValue = (branding, key, fallback) => optionalText(branding?.[key], 80) || fallback;

const buildInstituteRow = (institute) => {
  const publicInstituteId = requireText(institute.instituteId || institute.id, 'Institute ID', 120);
  const branding = institute.branding && typeof institute.branding === 'object' ? institute.branding : {};
  const settings = institute.settings && typeof institute.settings === 'object' ? institute.settings : {};
  const configuration = {
    ...(institute.configuration && typeof institute.configuration === 'object' ? institute.configuration : {}),
    branding,
    instituteId: publicInstituteId,
  };

  return {
    academic_model: institute.academicModel && typeof institute.academicModel === 'object' ? institute.academicModel : {},
    configuration,
    dark_primary_color: resolveBrandingValue(branding, 'darkPrimaryColor', '#020617'),
    dark_secondary_color: resolveBrandingValue(branding, 'darkSecondaryColor', '#0F172A'),
    institute_code: publicInstituteId,
    institution_type: normalizeInstitutionType(institute.institutionType || institute.type),
    legacy_firestore_id: publicInstituteId,
    logo_url: optionalText(branding.logoUrl || institute.logoUrl, 2000),
    name: requireText(institute.name, 'Institute name', 220),
    name_key: optionalText(institute.nameKey, 240) || requireText(institute.name, 'Institute name', 220).toLowerCase(),
    primary_color: resolveBrandingValue(branding, 'primaryColor', '#2563EB'),
    schema_version: Number(institute.schemaVersion || 3) || 3,
    secondary_color: resolveBrandingValue(branding, 'secondaryColor', '#7C3AED'),
    settings: {
      ...settings,
      branding: settings.branding || branding,
      institutionType: String(institute.institutionType || institute.type || 'SCHOOL').toUpperCase(),
    },
    updated_at: new Date().toISOString(),
  };
};

const mirrorInstituteToSupabase = async ({ institute }) => {
  const supabase = getSupabaseAdmin();
  const row = buildInstituteRow(institute);
  const { data, error } = await supabase
    .from('institutes')
    .upsert(row, { onConflict: 'legacy_firestore_id' })
    .select('id,institute_code,legacy_firestore_id,name,institution_type')
    .single();

  if (error) {
    error.statusCode = 502;
    throw error;
  }

  return data;
};

const mirrorInstituteWithProfilesToSupabase = async ({ actor, institute, profiles }) => {
  const mirroredInstitute = await mirrorInstituteToSupabase({ institute });
  const mirroredProfiles = await mirrorProfilesToSupabase({ actor, profiles });
  return {
    institute: mirroredInstitute,
    profiles: mirroredProfiles.profiles,
    profileCount: mirroredProfiles.count,
  };
};

module.exports = {
  mirrorInstituteToSupabase,
  mirrorInstituteWithProfilesToSupabase,
  mirrorProfilesToSupabase,
};
