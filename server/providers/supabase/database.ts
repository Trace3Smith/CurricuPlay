/** Increment 1 database contract. Keep in step with the checked-in SQL migration. */
type Table<Row> = { Row: { [K in keyof Row]: Row[K] }; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export interface UserRow { id: string; auth_subject: string; created_at: string }
export interface WorkspaceRow { id: string; owner_user_id: string; name: string; kind: 'personal'; created_at: string }
export interface ProfileRow { user_id: string; workspace_id: string; display_name: string; timezone: string; selected_school_year_id: string | null; selected_assignment_id: string | null; revision: number; updated_at: string }
export interface YearRow { id: string; workspace_id: string; name: string; starts_on: string; ends_on: string; created_at: string }
export interface AssignmentRow { id: string; workspace_id: string; school_year_id: string; title: string; jurisdiction: string; district: string; school: string; subject: string; course: string; grades: string[]; teaching_role: string; schedule: string; starts_on: string; ends_on: string; is_active: boolean; created_at: string }
export interface WorkRow { id: string; workspace_id: string; created_by: string; assignment_id: string | null; title: string; description: string; source: 'manual'; due_on: string | null; priority: 'low' | 'normal' | 'high' | 'urgent'; status: 'open' | 'in_progress' | 'completed' | 'cancelled'; completed_at: string | null; created_at: string; updated_at: string; revision: number }
export interface Database {
  public: {
    Tables: {
      app_users: Table<UserRow>;
      workspaces: Table<WorkspaceRow>;
      workspace_memberships: Table<{ workspace_id: string; user_id: string; role: 'owner'; created_at: string }>;
      teacher_profiles: Table<ProfileRow>;
      school_years: Table<YearRow>;
      teaching_assignments: Table<AssignmentRow>;
      work_items: Table<WorkRow>;
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_teacher: { Args: Record<string, never>; Returns: undefined };
      resource_library: { Args: { p_resource_id?: string | null }; Returns: unknown };
      save_resource: { Args: Record<string, unknown>; Returns: unknown };
      propose_curriculum: { Args: Record<string, unknown>; Returns: unknown };
      review_curriculum: { Args: Record<string, unknown>; Returns: unknown };
      activate_curriculum: { Args: Record<string, unknown>; Returns: unknown };
      lesson_library: { Args: Record<string, never>; Returns: unknown };
      save_lesson: { Args: Record<string, unknown>; Returns: unknown };
      schedule_lesson: { Args: Record<string, unknown>; Returns: unknown };
      mark_lesson_taught: { Args: Record<string, unknown>; Returns: unknown };
      reflect_on_lesson: { Args: Record<string, unknown>; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
