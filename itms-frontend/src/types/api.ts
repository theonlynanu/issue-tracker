export interface User {
  user_id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  created_at: string; // DATETIME as an ISO string
}

export interface AuthUser {
  user_id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  created_at?: string; // /auth/login doesn't give created_at
}

export type ProjectRole = "LEAD" | "DEVELOPER" | "VIEWER";

export interface Project {
  project_id: number;
  project_key: string;
  name: string;
  description: string | null;
  is_public: 0 | 1;
  created_by: number | null;
  created_at: string; // DATETIME as an ISO string
  user_role: ProjectRole | null;
}

export interface Label {
  label_id: number;
  project_id: number;
  name: string;
}

export type IssueType = "BUG" | "FEATURE" | "TASK" | "OTHER";
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Issue {
  issue_id: number;
  project_id: number;
  issue_number: number;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  reporter_id: number;
  assignee_id: number;
  due_date: string | null; // DATE as "YYYY-MM-DD"
  created_at: string; // DATETIME as ISO string
  updated_at: string; // DATETIME as ISO string
  labels?: Label[];
}

export interface IssueHistoryEntry {
  change_id: number;
  issue_id: number;
  changed_by: number | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string; // DATETIME as ISO string
}

export interface Comment {
  commend_id: number;
  content: string;
  issue_id: number;
  author_id: number | null;
  created_at: string; // DATETIME as ISO string
  updated_at: string; // DATETIME as ISO string
}

export interface ProjectMember {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: ProjectRole;
  joined_at: string; // DATETIME as ISO string
}
