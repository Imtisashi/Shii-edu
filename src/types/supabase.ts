export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      bus_routes: {
        Row: {
          created_at: string;
          driver_id: string | null;
          id: string;
          institute_id: string;
          last_known_position: unknown;
          last_seen_at: string | null;
          route_name: string;
          status: Database['public']['Enums']['edu_shii_bus_route_status'];
          updated_at: string;
          vehicle_number: string;
        };
        Insert: {
          created_at?: string;
          driver_id?: string | null;
          id?: string;
          institute_id: string;
          last_known_position?: unknown;
          last_seen_at?: string | null;
          route_name: string;
          status?: Database['public']['Enums']['edu_shii_bus_route_status'];
          updated_at?: string;
          vehicle_number: string;
        };
        Update: {
          created_at?: string;
          driver_id?: string | null;
          id?: string;
          institute_id?: string;
          last_known_position?: unknown;
          last_seen_at?: string | null;
          route_name?: string;
          status?: Database['public']['Enums']['edu_shii_bus_route_status'];
          updated_at?: string;
          vehicle_number?: string;
        };
      };
      institutes: {
        Row: {
          configuration: Json;
          created_at: string;
          dark_primary_color: string;
          dark_secondary_color: string;
          id: string;
          logo_url: string | null;
          name: string;
          primary_color: string;
          secondary_color: string;
          updated_at: string;
        };
        Insert: {
          configuration?: Json;
          created_at?: string;
          dark_primary_color?: string;
          dark_secondary_color?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          primary_color?: string;
          secondary_color?: string;
          updated_at?: string;
        };
        Update: {
          configuration?: Json;
          created_at?: string;
          dark_primary_color?: string;
          dark_secondary_color?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          primary_color?: string;
          secondary_color?: string;
          updated_at?: string;
        };
      };
      parent_student_map: {
        Row: {
          created_at: string;
          institute_id: string;
          parent_id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          institute_id: string;
          parent_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          institute_id?: string;
          parent_id?: string;
          student_id?: string;
        };
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          institute_id: string | null;
          metadata: Json;
          role: Database['public']['Enums']['edu_shii_profile_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name: string;
          id: string;
          institute_id?: string | null;
          metadata?: Json;
          role: Database['public']['Enums']['edu_shii_profile_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          institute_id?: string | null;
          metadata?: Json;
          role?: Database['public']['Enums']['edu_shii_profile_role'];
          updated_at?: string;
        };
      };
      routines: {
        Row: {
          class_id: string;
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          institute_id: string;
          room_number: string | null;
          start_time: string;
          subject: string;
          teacher_id: string | null;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          institute_id: string;
          room_number?: string | null;
          start_time: string;
          subject: string;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          institute_id?: string;
          room_number?: string | null;
          start_time?: string;
          subject?: string;
          teacher_id?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      edu_shii_bus_route_status: 'active' | 'inactive';
      edu_shii_profile_role: 'admin' | 'driver' | 'parent' | 'student' | 'superadmin' | 'teacher';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
