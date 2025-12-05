import type {
  User,
  AuthUser,
  Project,
  Issue,
  IssueHistoryEntry,
  Label,
  Comment,
  ProjectMember,
  IssueStatus,
  IssuePriority,
  IssueType,
  ProjectRole,
} from "../types/api";

/**
 * ERROR TYPE - for pulling out codes
 */

export interface ApiError extends Error {
  status: number;
  details?: unknown;
}

export function isApiError(e: unknown): e is ApiError {
  return (
    e instanceof Error && typeof (e as Partial<ApiError>).status === "number"
  );
}

/**
 * TYPES AND HELPERS
 */

// A1
export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
}

// A2
export interface LoginPayload {
  identifier: string;
  password: string;
}

// A5
export type UpdateMePayload = Partial<
  Pick<User, "username" | "first_name" | "last_name">
>;

// P2
export interface CreateProjectPayload {
  project_key: string;
  name: string;
  description?: string | null;
  is_public?: boolean;
}

// P4
export interface UpdateProjectPayload {
  project_key?: string;
  name?: string;
  description?: string | null;
}

// P5
export interface UpdateProjectVisibilityPayload {
  is_public: boolean;
}

// M2
export interface AddProjectMemberPayload {
  identifier: string;
  role: ProjectRole;
}

// M3
export interface UpdateProjectMemberRolePayload {
  role: ProjectRole;
}

// I2
export interface CreateIssuePayload {
  title: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  assignee_id?: number | null;
  due_date?: string | null; // "YYYY-MM-DD"
  labels?: number[]; // label_ids
}

// I4
export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  assignee_id?: number | null;
  due_date?: string | null; // "YYYY-MM-DD"
  status?: IssueStatus;
}

// I5
export interface UpdateAssigneePayload {
  assignee_id: number | null;
}

// L2
export interface CreateLabelPayload {
  name: string;
}

// L3
export interface UpdateLabelPayload {
  name: string;
}

// L5
export interface AddLabelToIssuePayload {
  label_id: number;
}

export interface CommentPayload {
  content: string;
}

/**
 * Centralized fetch() wrapper
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn(
    "VITE_API_BASE_URL is not set. Configure it in your .env (e.g. VITE_API_BASE_URL=http://localhost:8000)"
  );
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include", // Always send session cookie
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get("Content-Type") || "";
  const body = contentType.includes("application/json")
    ? await res.json()
    : null;

  if (!res.ok) {
    let message: string = `HTTP ${res.status}`;

    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "string"
    ) {
      message = (body as { error: string }).error;
    }

    const error: ApiError = Object.assign(new Error(message), {
      status: res.status,
      details: body,
    });

    throw error;
  }

  return body as T;
}

/**
 * MAIN API
 *
 */
export const api = {
  /* --------------- AUTH ENDPOINTS --------------- */
  // A1
  register: (payload: RegisterPayload) =>
    request<{ message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // A2
  login: (payload: LoginPayload) =>
    request<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // A3
  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),

  // A4
  me: () => request<{ user: User }>("/me"),

  // A5
  update_me: (patch: UpdateMePayload) =>
    request<{ user: User }>("/me", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  /* --------------- PROJECT ENDPOINTS --------------- */
  //P1
  list_projects: () =>
    request<{ projects: Project[] }>("/projects", {
      method: "GET",
    }),

  // P2
  create_project: (payload: CreateProjectPayload) =>
    request<{ message: string; project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // P3
  get_project: (projectId: number) =>
    request<{ project: Project }>(`/projects/${projectId}`, {
      method: "GET",
    }),

  // P4
  edit_project: (projectId: number, patch: UpdateProjectPayload) =>
    request<{ project: Project }>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // P5
  update_project_visibility: (
    projectId: number,
    payload: UpdateProjectVisibilityPayload
  ) =>
    request<{ project: Project }>(`/projects/${projectId}/visibility`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // P6
  delete_project: (projectId: number) =>
    request<{ success: boolean }>(`/projects/${projectId}`, {
      method: "DELETE",
    }),

  /* ------------- MEMBERSHIP ENDPOINTS ------------- */
  //M1
  list_project_members: (projectId: number) =>
    request<{ project_id: number; members: ProjectMember[] }>(
      `/projects/${projectId}/members`,
      { method: "GET" }
    ),

  // M2
  add_project_member: (projectId: number, payload: AddProjectMemberPayload) =>
    request<{ user_id: number; project_id: number; role: ProjectRole }>(
      `/projects/${projectId}/members`,
      { method: "POST", body: JSON.stringify(payload) }
    ),

  // M3 – change member role
  change_project_member_role: (
    projectId: number,
    memberId: number,
    role: ProjectRole
  ) =>
    request<{
      message: string;
      project_id: number;
      user_id: number;
      new_role: ProjectRole;
    }>(`/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  // M4 – remove project member
  remove_project_member: (projectId: number, memberId: number) =>
    request<{ message: string; project_id: number; user_id: number }>(
      `/projects/${projectId}/members/${memberId}`,
      { method: "DELETE" }
    ),

  /* ---------------- Issues & History (I1–I5, H1) ---------------- */

  // I1 – list issues for project
  list_project_issues: (projectId: number) =>
    request<{ project_id: number; issues: Issue[] }>(
      `/projects/${projectId}/issues`,
      { method: "GET" }
    ),

  // I2 – create issue
  create_issue: (projectId: number, payload: CreateIssuePayload) =>
    request<{ message: string; issue: Issue }>(
      `/projects/${projectId}/issues`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // I3 – get single issue
  get_issue: (issueId: number) =>
    request<{ issue: Issue }>(`/issues/${issueId}`, { method: "GET" }),

  // I4 – update issue core fields
  update_issue: (issueId: number, patch: UpdateIssuePayload) =>
    request<{ issue: Issue }>(`/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // I5 – update assignee
  update_issue_assignee: (issueId: number, payload: UpdateAssigneePayload) =>
    request<{ issue: Issue }>(`/issues/${issueId}/assignee`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // H1 – get issue history
  get_issue_history: (issueId: number) =>
    request<{ issue_id: number; history: IssueHistoryEntry[] }>(
      `/issues/${issueId}/history`,
      { method: "GET" }
    ),

  /* ---------------- Labels (L1–L6) ---------------- */

  // L1 – list project labels
  list_project_labels: (projectId: number) =>
    request<{ project_id: number; labels: Label[] }>(
      `/projects/${projectId}/labels`,
      { method: "GET" }
    ),

  // L2 – create label
  create_project_label: (projectId: number, payload: CreateLabelPayload) =>
    request<{ project_id: number; label: Label }>(
      `/projects/${projectId}/labels`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // L3 – update label name
  update_project_label: (
    projectId: number,
    labelId: number,
    payload: UpdateLabelPayload
  ) =>
    request<{ project_id: number; label_id: number; name: string }>(
      `/projects/${projectId}/labels/${labelId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  // L4 – delete label
  delete_project_label: (projectId: number, labelId: number) =>
    request<{ success: boolean }>(`/projects/${projectId}/labels/${labelId}`, {
      method: "DELETE",
    }),

  // L5 – add label to issue
  add_label_to_issue: (issueId: number, payload: AddLabelToIssuePayload) =>
    request<{ message: string; issue: Issue }>(`/issues/${issueId}/labels`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // L6 – remove label from issue
  remove_label_from_issue: (issueId: number, labelId: number) =>
    request<{ success: boolean }>(`/issues/${issueId}/labels/${labelId}`, {
      method: "DELETE",
    }),

  /* ---------------- Comments (C1–C4) ---------------- */

  // C1 – list comments for an issue
  list_issue_comments: (issueId: number) =>
    request<{ issue_id: number; comments: Comment[] }>(
      `/issues/${issueId}/comments`,
      { method: "GET" }
    ),

  // C2 – create comment
  add_comment: (issueId: number, payload: CommentPayload) =>
    request<{ comment: Comment }>(`/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // C3 – update comment
  update_comment: (commentId: number, payload: CommentPayload) =>
    request<{ comment: Comment }>(`/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // C4 – delete comment
  delete_comment: (commentId: number) =>
    request<{ success: boolean }>(`/comments/${commentId}`, {
      method: "DELETE",
    }),
};
