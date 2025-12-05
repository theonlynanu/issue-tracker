import { Link, useParams } from "react-router-dom";
import { api, isApiError } from "../api/client";

import type {
  Issue,
  IssueHistoryEntry,
  Comment,
  IssueStatus,
  IssuePriority,
} from "../types/api";
import { useEffect, useState } from "react";

type IssueTab = "details" | "comments" | "history";

const ISSUE_STATUSES: IssueStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];
const ISSUE_PRIORITIES: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function IssueDetailsPage() {
  const { issueId } = useParams<{ issueId: string }>();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [history, setHistory] = useState<IssueHistoryEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<IssueTab>("details");
  const [updating, setUpdating] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>("");

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

        if (cancelled) return;

        setIssue(issueRes.issue);
        setHistory(historyRes.history);
        setComments(commentsRes.comments);
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
    patch: Partial<Pick<Issue, "status" | "priority">>
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

  return (
    <div>
      <header>
        <h1>
          Issue #{issueKey}: {issue.title}
        </h1>
        <p>{issue.description}</p>
        <p>
          Project:{" "}
          <Link to={`/projects/${issue.project_id}`}>
            Project #{issue.project_id}
          </Link>
        </p>
        <p>
          Type: {issue.type} - Status: {issue.status} - Priority:{" "}
          {issue.priority}
        </p>
        <p>Assignee: {issue.assignee_id ?? "Unassigned"}</p>
        <p>
          Created: {new Date(issue.created_at).toLocaleString()} - Last Updated:{" "}
          {new Date(issue.updated_at).toLocaleString()}
        </p>
      </header>

      {error && <div>{error}</div>}

      {/** TABS */}
      <div>
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          disabled={activeTab == "details"}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("comments")}
          disabled={activeTab === "comments"}
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
        {activeTab === "details" && (
          <section>
            <h2>Details</h2>
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
            <h2>Comments</h2>
            {comments.length === 0 ? (
              <p>No comments yet.</p>
            ) : (
              <ul>
                {comments.map((c) => (
                  <li key={c.comment_id}>
                    <p>{c.content}</p>
                    <small>
                      By {c.author_id ?? c.author_id} at{" "}
                      {new Date(c.created_at).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddComment}>
              <div>
                <label>
                  Add a comment
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                </label>
              </div>
              <button type="submit" disabled={updating || !newComment.trim()}>
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
