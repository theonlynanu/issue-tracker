import { Link, useParams } from "react-router-dom";
import { api, isApiError } from "../api/client";

import {
  type Issue,
  type IssueHistoryEntry,
  type Comment,
  type Label,
  type IssueType,
  type IssueStatus,
  type IssuePriority,
  type Project,
} from "../types/api";
import { useEffect, useState } from "react";

type IssueTab = "edit" | "comments" | "history";

const ISSUE_STATUSES: IssueStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];
const ISSUE_PRIORITIES: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const ISSUE_TYPES: IssueType[] = ["BUG", "TASK", "FEATURE", "OTHER"];

export default function IssueDetailsPage() {
  const { issueId } = useParams<{ issueId: string }>();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [history, setHistory] = useState<IssueHistoryEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);

  const [loading, setLoading] = useState(true);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<IssueTab>("comments");
  const [updating, setUpdating] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>("");

  const [selectedLabelId, setSelectedLabelId] = useState<number | "">("");
  const [labelBusyId, setLabelBusyId] = useState<number | null>(null);

  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!issueId) {
      setError("No issue ID provided in the URL.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const numericId = Number(issueId);

        const [issueRes, historyRes, commentsRes] = await Promise.all([
          api.get_issue(numericId),
          api.get_issue_history(numericId),
          api.list_issue_comments(numericId),
        ]);

        const { project: parentProject } = await api.get_project(
          issueRes.issue.project_id
        );

        if (cancelled) return;

        setIssue(issueRes.issue);
        setHistory(historyRes.history);
        setComments(commentsRes.comments);
        setLabelsLoading(true);
        setProject(parentProject);
        try {
          const labelsRes = await api.list_project_labels(
            issueRes.issue.project_id
          );
          if (!cancelled) {
            setAvailableLabels(labelsRes.labels);
          }
        } catch (e) {
          if (!cancelled) {
            console.warn("Failed to load project labels", e);
          }
        } finally {
          if (!cancelled) {
            setLabelsLoading(false);
          }
        }
      } catch (e) {
        if (cancelled) return;

        if (isApiError(e)) {
          if (e.status === 404) {
            setError("Issue not found.");
          } else if (e.status === 403) {
            setError("You do not have access to this issue.");
          } else {
            setError(`Failed to load issue details (HTTP ${e.status}).`);
          }
        } else if (e instanceof Error) {
          setError(`Failed to load issue: ${e.message}`);
        } else {
          setError("Failed to load issue due to an unknown error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [issueId]);

  async function handleQuickUpdate(
    patch: Partial<Pick<Issue, "status" | "priority" | "type">>
  ) {
    if (!issue) return;
    setUpdating(true);
    setError(null);

    try {
      const { issue: updated } = await api.update_issue(issue.issue_id, patch);
      setIssue(updated);
    } catch (e) {
      if (isApiError(e)) {
        setError(`Failed to update issue (HTTP ${e.status})`);
      } else if (e instanceof Error) {
        setError(`Failed to update issue: ${e.message}`);
      } else {
        setError("Failed to update issue due to an unknown error.");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!issue) return;
    if (!newComment.trim()) return;

    setUpdating(true);
    setError(null);

    try {
      const { comment } = await api.add_comment(issue.issue_id, {
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (e) {
      if (isApiError(e)) {
        setError(`Failed to add comment (HTTP ${e.status}).`);
      } else if (e instanceof Error) {
        setError(`Failed to add comment: ${e.message}`);
      } else {
        setError("Failed to add comment due to an unknown error.");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!issue) return;
    if (selectedLabelId == "") return;

    const labelId = selectedLabelId;
    setLabelBusyId(labelId);
    setError(null);

    try {
      const { issue: updatedIssue } = await api.add_label_to_issue(
        issue.issue_id,
        { label_id: labelId }
      );
      const labels = updatedIssue.labels;
      if (!labels) {
        throw new Error("Failed to attach label for unknown reason");
      }
      setIssue(updatedIssue);
    } catch (e) {
      if (isApiError(e)) {
        setError(`Failed to add label (HTTP ${e.status}).`);
      } else if (e instanceof Error) {
        setError(`Failed to add label: ${e.message}`);
      } else {
        setError("Failed to add label due to an unknown error.");
      }
    } finally {
      setLabelBusyId(null);
      setSelectedLabelId("");
    }
  }

  async function handleRemoveLabel(labelId: number) {
    if (!issue) return;
    setLabelBusyId(labelId);
    setError(null);

    try {
      const { success } = await api.remove_label_from_issue(
        issue.issue_id,
        labelId
      );
      if (!success) {
        throw new Error("Failed to remove label for an unknown reason");
      }
      const { issue: newIssue } = await api.get_issue(issue.issue_id);
      setIssue(newIssue);
    } catch (e) {
      if (isApiError(e)) {
        setError(`Failed to remove label (HTTP ${e.status}).`);
      } else if (e instanceof Error) {
        setError(`Failed to remove label: ${e.message}`);
      } else {
        setError("Failed to remove label due to an unknown error.");
      }
    } finally {
      setLabelBusyId(null);
    }
  }

  if (loading) {
    return <div>Loading issue details...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!issue) {
    return <div>Issue not found.</div>;
  }

  const issueKey = issue.issue_number ?? issue.issue_id;
  const issueLabels: Label[] = issue.labels ?? [];

  // Labels not yet attached to this issue
  const attachableLabels = availableLabels.filter(
    (lbl) => !issueLabels.some((il) => il.label_id === lbl.label_id)
  );

  return (
    <div>
      <header>
        <h1>
          Issue #{issueKey}: {issue.title}
        </h1>
        <p className="text-slate-400 mx-8 mb-4">{issue.description}</p>
        <p className="text-xl">
          Project:{" "}
          <Link to={`/projects/${issue.project_id}`}>
            {project?.name || `Project #${issue.project_id}`}
          </Link>
        </p>
        <p>Type: {issue.type}</p>
        <p>Status: {issue.status}</p>
        <p>Priority: {issue.priority}</p>
        <p>Raised by: {issue.reporter_id}</p>
        <p>Assignee: {issue.assignee_id ?? "Unassigned"}</p>
        <p className="text-sm">
          Created: {new Date(issue.created_at).toLocaleString()} - Last Updated:{" "}
          {new Date(issue.updated_at).toLocaleString()}
        </p>
      </header>
      {labelsLoading && <div>Loading labels...</div>}
      {issueLabels.length === 0 ? (
        <></>
      ) : (
        <ul>
          {issueLabels.map((label) => (
            <li
              key={label.label_id}
              className="rounded-4xl text-xs text-center bg-orange-900 px-2 w-fit py-1"
            >
              {label.name}{" "}
              {project?.user_role === "LEAD" && (
                <button
                  type="button"
                  onClick={() => handleRemoveLabel(label.label_id)}
                  disabled={labelBusyId === label.label_id}
                  className="text-xs hover:text-red-500 rounded-full"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {attachableLabels.length > 0 && project?.user_role === "LEAD" ? (
        <form onSubmit={handleAddLabel}>
          <label>
            Add label:
            <select
              value={selectedLabelId === "" ? "" : selectedLabelId}
              onChange={(e) =>
                setSelectedLabelId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              disabled={labelBusyId !== null}
            >
              <option value="">Select a label</option>
              {attachableLabels.map((label) => (
                <option key={label.label_id} value={label.label_id.toString()}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={selectedLabelId === "" || labelBusyId !== null}
          >
            Attach
          </button>
        </form>
      ) : (
        <></>
      )}

      {error && <div>{error}</div>}

      {/** TABS */}
      <div className="mt-8 mb-2 flex gap-4">
        {project?.user_role === "LEAD" && (
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            disabled={activeTab == "edit"}
          >
            Edit Status
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("comments")}
          disabled={activeTab === "comments"}
          className="border border-slate-600 px-2 py-1 rounded-2xl"
        >
          Comments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          disabled={activeTab === "history"}
        >
          History
        </button>
      </div>

      {/** TAB CONTENT */}
      <div>
        {activeTab === "edit" && (
          <section>
            <h2>Details</h2>
            <div>
              <label>
                Type
                <select
                  value={issue.type}
                  onChange={(e) =>
                    handleQuickUpdate({
                      type: e.target.value as IssueType,
                    })
                  }
                  disabled={updating}
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
                Status
                <select
                  value={issue.status}
                  onChange={(e) =>
                    handleQuickUpdate({ status: e.target.value as IssueStatus })
                  }
                  disabled={updating}
                >
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label>
                Priority
                <select
                  value={issue.priority}
                  onChange={(e) =>
                    handleQuickUpdate({
                      priority: e.target.value as IssuePriority,
                    })
                  }
                  disabled={updating}
                >
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* You can later add editing for title/description/type/assignee here */}
          </section>
        )}

        {activeTab === "comments" && (
          <section>
            <h2 className="text-2xl">Comments</h2>
            {comments.length === 0 ? (
              <p>No comments yet.</p>
            ) : (
              <ul>
                {comments.map((c) => (
                  <li
                    key={c.comment_id}
                    className="text-md my-4 border-b w-fit"
                  >
                    <p>{c.content}</p>
                    <small className="text-xs text-slate-400">
                      By {c.author_id ?? c.author_id} at{" "}
                      {new Date(c.created_at).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddComment}>
              <div>
                <label className="flex">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    placeholder="Leave a comment"
                    className="border border-slate-700 w-64"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={updating || !newComment.trim()}
                className="border rounded-2xl px-2 py-1 my-2"
              >
                {updating ? "Saving..." : "Post comment"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "history" && (
          <section>
            <h2>History</h2>
            {history.length === 0 ? (
              <p>No history entries for this issue.</p>
            ) : (
              <ul>
                {history.map((h) => (
                  <li key={h.change_id}>
                    <small>
                      By {h.changed_by} at{" "}
                      {new Date(h.changed_at).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
