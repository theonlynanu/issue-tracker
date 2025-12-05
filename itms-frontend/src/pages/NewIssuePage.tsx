// src/pages/NewIssuePage.tsx
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, isApiError } from "../api/client";
import type { IssuePriority, IssueType } from "../types/api";
import type { CreateIssuePayload } from "../api/client";

const ISSUE_PRIORITIES: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const ISSUE_TYPES: IssueType[] = ["BUG", "TASK", "FEATURE", "OTHER"];

export default function NewIssuePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateIssuePayload>({
    title: "",
    description: "",
    type: "BUG",
    priority: "MEDIUM",
    assignee_id: undefined,
  });
  const [assigneeInput, setAssigneeInput] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!projectId) {
    return <div>No project ID provided in URL.</div>;
  }

  function updateField<K extends keyof CreateIssuePayload>(
    key: K,
    value: CreateIssuePayload[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    const parsedAssignee =
      assigneeInput.trim() === ""
        ? undefined
        : Number.isNaN(Number(assigneeInput.trim()))
        ? undefined
        : Number(assigneeInput.trim());

    const payload: CreateIssuePayload = {
      ...form,
      title: form.title.trim(),
      description: form.description?.trim(),
      assignee_id: parsedAssignee ?? undefined,
    };

    setSubmitting(true);
    try {
      const { issue } = await api.create_issue(Number(projectId), payload);
      navigate(`/issues/${issue.issue_id}`);
    } catch (e) {
      if (isApiError(e)) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unexpected error while creating issue.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New Issue</h1>
      <p>
        Project: <Link to={`/projects/${projectId}`}>Back to project</Link>
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Title
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
            />
          </label>
        </div>
        <div>
          <label>
            Type
            <select
              value={form.type}
              onChange={(e) => updateField("type", e.target.value as IssueType)}
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Priority
            <select
              value={form.priority}
              onChange={(e) =>
                updateField("priority", e.target.value as IssuePriority)
              }
            >
              {ISSUE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Assignee user_id (optional)
            <input
              type="text"
              value={assigneeInput}
              onChange={(e) => setAssigneeInput(e.target.value)}
              placeholder="Leave blank for unassigned"
            />
          </label>
        </div>

        {error && <div>{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create issue"}
        </button>
      </form>
    </div>
  );
}
