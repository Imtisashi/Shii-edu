import { createClient } from 'jsr:@supabase/supabase-js@2';

type RoutineInput = {
  class_id: string;
  day_of_week: number;
  end_time: string;
  room_number?: string | null;
  start_time: string;
  subject: string;
  teacher_id?: string | null;
};

type RoutineCandidate = RoutineInput & {
  institute_id: string;
};

type Collision = {
  conflict: string;
  left: RoutineInput;
  right: RoutineInput;
};

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const configuredOrigins = (): string[] => {
  const origins = [
    Deno.env.get('APP_ORIGIN') || 'https://shii-edu.vercel.app',
    ...(Deno.env.get('ALLOWED_ORIGINS') || '').split(','),
  ];
  return origins.map((origin) => origin.trim()).filter(Boolean);
};

const isLocalOrigin = (origin: string): boolean => (
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
);

const corsHeaders = (req: Request): HeadersInit => {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = configuredOrigins().includes(origin) || isLocalOrigin(origin)
    ? origin
    : configuredOrigins()[0];

  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': allowedOrigin,
  };
};

const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
    },
    status,
  }
);

const asText = (value: unknown, label: string, min = 1, max = 180): string => {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${label} length is invalid.`);
  return text;
};

const asOptionalText = (value: unknown, label: string, max = 180): string | null => {
  if (value === undefined || value === null || value === '') return null;
  return asText(value, label, 1, max);
};

const asDay = (value: unknown): number => {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('day_of_week must be between 0 and 6.');
  return day;
};

const asTime = (value: unknown, label: string): string => {
  const text = asText(value, label, 4, 8);
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(text)) {
    throw new Error(`${label} must be a valid HH:MM time.`);
  }
  return text.length === 5 ? `${text}:00` : text;
};

const minutes = (time: string): number => {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
};

const overlaps = (left: RoutineInput, right: RoutineInput): boolean => (
  left.day_of_week === right.day_of_week &&
  minutes(left.start_time) < minutes(right.end_time) &&
  minutes(right.start_time) < minutes(left.end_time)
);

const normalizeRoutine = (value: unknown): RoutineInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Every routine entry must be an object.');
  }

  const row = value as Record<string, unknown>;
  const start_time = asTime(row.start_time, 'start_time');
  const end_time = asTime(row.end_time, 'end_time');
  if (minutes(start_time) >= minutes(end_time)) {
    throw new Error('start_time must be before end_time.');
  }

  return {
    class_id: asText(row.class_id, 'class_id', 1, 80),
    day_of_week: asDay(row.day_of_week),
    end_time,
    room_number: asOptionalText(row.room_number, 'room_number', 80),
    start_time,
    subject: asText(row.subject, 'subject', 1, 140),
    teacher_id: asOptionalText(row.teacher_id, 'teacher_id', 36),
  };
};

const findCollisions = (routines: RoutineInput[]): Collision[] => {
  const collisions: Collision[] = [];

  for (let leftIndex = 0; leftIndex < routines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < routines.length; rightIndex += 1) {
      const left = routines[leftIndex];
      const right = routines[rightIndex];
      if (!overlaps(left, right)) continue;

      if (left.teacher_id && left.teacher_id === right.teacher_id) {
        collisions.push({ conflict: 'teacher_double_booked', left, right });
      }

      if (left.room_number && left.room_number === right.room_number) {
        collisions.push({ conflict: 'room_double_booked', left, right });
      }
    }
  }

  return collisions;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json(req, 503, { error: 'Supabase runtime environment is not configured.' });
    }

    const authorization = req.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json(req, 401, { error: 'A valid Supabase user is required.' });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,institute_id,role')
      .eq('id', userData.user.id)
      .single();
    if (profileError || !profile?.institute_id) return json(req, 403, { error: 'A verified institute profile is required.' });
    if (!['admin', 'superadmin'].includes(profile.role)) return json(req, 403, { error: 'Only institute admins can build routines.' });

    const body = await req.json();
    const dryRun = body?.dryRun === true;
    const routines = Array.isArray(body?.routines)
      ? body.routines.map(normalizeRoutine)
      : [];
    if (routines.length === 0) return json(req, 400, { error: 'At least one routine entry is required.' });
    if (routines.length > 200) return json(req, 400, { error: 'A single routine build can contain at most 200 entries.' });

    const inputCollisions = findCollisions(routines);
    if (inputCollisions.length > 0) {
      return json(req, 409, {
        collisions: inputCollisions,
        error: 'Routine entries contain scheduling collisions.',
      });
    }

    const days = [...new Set(routines.map((routine) => routine.day_of_week))];
    const { data: existingRows, error: existingError } = await supabase
      .from('routines')
      .select('class_id,day_of_week,end_time,room_number,start_time,subject,teacher_id')
      .eq('institute_id', profile.institute_id)
      .in('day_of_week', days);
    if (existingError) throw existingError;

    const existing = (existingRows || []) as RoutineInput[];
    const databaseCollisions: Collision[] = [];
    routines.forEach((candidate) => {
      existing.forEach((current) => {
        if (!overlaps(candidate, current)) return;
        if (candidate.teacher_id && candidate.teacher_id === current.teacher_id) {
          databaseCollisions.push({ conflict: 'teacher_already_booked', left: candidate, right: current });
        }
        if (candidate.room_number && candidate.room_number === current.room_number) {
          databaseCollisions.push({ conflict: 'room_already_booked', left: candidate, right: current });
        }
      });
    });

    if (databaseCollisions.length > 0) {
      return json(req, 409, {
        collisions: databaseCollisions,
        error: 'Routine entries collide with the existing timetable.',
      });
    }

    const insertRows: RoutineCandidate[] = routines.map((routine) => ({
      ...routine,
      institute_id: profile.institute_id,
    }));

    if (!dryRun) {
      const { error: insertError } = await supabase
        .from('routines')
        .insert(insertRows);
      if (insertError) throw insertError;
    }

    return json(req, 200, {
      committed: !dryRun,
      routineCount: insertRows.length,
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Routine builder failed.';
    return json(req, 400, { error: message });
  }
});
