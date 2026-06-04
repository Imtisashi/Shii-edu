import { supabase } from './supabaseClient';

export type RoutineBuilderInput = {
  class_id: string;
  day_of_week: number;
  end_time: string;
  room_number?: string | null;
  start_time: string;
  subject: string;
  teacher_id?: string | null;
};

export type RoutineBuilderCollision = {
  conflict: string;
  left: RoutineBuilderInput;
  right: RoutineBuilderInput;
};

export type RoutineBuilderResult = {
  collisions?: RoutineBuilderCollision[];
  committed?: boolean;
  error?: string;
  routineCount?: number;
  success?: boolean;
};

export const buildSupabaseRoutine = async ({
  dryRun = false,
  routines,
}: {
  dryRun?: boolean;
  routines: RoutineBuilderInput[];
}): Promise<RoutineBuilderResult> => {
  const { data, error } = await supabase.functions.invoke<RoutineBuilderResult>('routine-builder', {
    body: {
      dryRun,
      routines,
    },
  });

  if (error) throw error;
  return data || { success: false, error: 'Routine builder returned an empty response.' };
};
