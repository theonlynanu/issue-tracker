import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, isApiError } from "../api/client";
import type { Project, Issue, IssueStatus, IssuePriority } from "../types/api";
import ProjectMembersSection from "../components/ProjectMembersSection";
import ProjectLabelsSection from "../components/ProjectLabelsSection";

interface IssueSummary {
  total: number;
  byStatus: Record<IssueStatus, number>;
  byPriority: Record<IssuePriority, number>;
  open: number;
  closed: number;
}

function computeIssueSummary(issues: Issue[]): IssueSummary {
  const baseStatus: Record<IssueStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };

  const basePriority: Record<IssuePriority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  const byStatus = { ...baseStatus };
  const byPriority = { ...basePriority };

  let openCount = 0;
  let closedCount = 0;

  for (const issue of issues) {
    byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1;
    byPriority[issue.priority] = (byPriority[issue.priority] ?? 0) + 1;

    if (issue.status === "OPEN" || issue.status === "IN_PROGRESS") {
      openCount += 1;
    } else {
      closedCount += 1;
    }
  }

  return {
    total: issues.length,
    byStatus,
    byPriority,
    open: openCount,
    closed: closedCount,
  };
}

const visibilityLabel = (is_public: Project["is_public"]) =>
  is_public === 1 ? "Public" : "Private";

export default function ProjectDetailsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [membersVisible, setMembersVisible] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setError("No project ID provided in the URL."); // Somehow
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // We try to fetch project & its issues in parallel
        const [projectRes, issuesRes] = await Promise.all([
          api.get_project(Number(projectId)),
          api.list_project_issues(Number(projectId)),
        ]);

        if (cancelled) return;

        const proj = projectRes.project;
        const issueList = issuesRes.issues;

        setProject(proj);
        setIssues(issueList);
        setSummary(computeIssueSummary(issueList));
      } catch (e) {
        if (cancelled) return;

        if (isApiError(e)) {
          if (e.status === 404) {
            setError("Project not found.");
          } else if (e.status === 403) {
            setError("You do not have access to this project.");
          } else {
            setError(`Failed to load project details (HTTP ${e.status}).`);
          }
        } else if (e instanceof Error) {
          setError(`Failed to load project: ${e.message}`);
        } else {
          setError("Failed to load project due to an unknown error.");
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
  }, [projectId]);

  if (loading) {
    return <div>Loading project...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!project) {
    return <div>Project not found.</div>;
  }

  return (
    <div>
      {/* Project Header */}
      <header>
        <h1>
          {project.project_key} - {project.name}
        </h1>
        <p>{project.description}</p>
        <p>
          Visibility: {visibilityLabel(project.is_public)}{" "}
          {project.user_role && <> Your role: {project.user_role}</>}
        </p>
        <p>Created at: {new Date(project.created_at).toLocaleDateString()}</p>
        <button
          type="button"
          onClick={() => navigate(`/projects/${project.project_id}/issues.new`)}
        >
          Add New Issue
        </button>
      </header>

      {/* Issue Summary */}
      {summary && (
        <section>
          <h2>Issue Summary</h2>
          <p>Total issues: {summary.total}</p>
          <p>
            Open: {summary.open} - Closed: {summary.closed}
          </p>
          <div>
            <h3>By Status</h3>
            <ul>
              <li>OPEN: {summary.byStatus.OPEN}</li>
              <li>IN_PROGRESS: {summary.byStatus.IN_PROGRESS}</li>
              <li>RESOLVED: {summary.byStatus.RESOLVED}</li>
              <li>CLOSED: {summary.byStatus.CLOSED}</li>
            </ul>
          </div>
          <div>
            <h3>By priority</h3>
            <ul>
              <li>LOW: {summary.byPriority.LOW}</li>
              <li>MEDIUM: {summary.byPriority.MEDIUM}</li>
              <li>HIGH: {summary.byPriority.HIGH}</li>
              <li>CRITICAL: {summary.byPriority.CRITICAL}</li>
            </ul>
          </div>
        </section>
      )}

      {/* Issue List */}
      <section>
        <h2>Issues</h2>
        {issues.length === 0 ? (
          <p>No issues in this project yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th>Key</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.issue_id}>
                  <td>
                    <Link to={`/issues/${issue.issue_id}`}>
                      {project.project_key} - {issue.issue_number}
                    </Link>
                  </td>
                  <td>{issue.title}</td>
                  <td>{issue.type}</td>
                  <td>{issue.status}</td>
                  <td>{issue.priority}</td>
                  <td>{issue.assignee_id ?? "Unassigned"}</td>
                  <td>{new Date(issue.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div>
        <button
          type="button"
          onClick={() => setMembersVisible(!membersVisible)}
        >
          {membersVisible ? "Hide Members List" : "Show Members List"}
        </button>
        {membersVisible ? (
          <ProjectMembersSection
            projectId={project.project_id}
            currentUserRole={project.user_role}
          />
        ) : (
          <></>
        )}
        <button type="button" onClick={() => setLabelsVisible(!labelsVisible)}>
          {labelsVisible ? "Hide labels" : "Show labels"}
        </button>
        {labelsVisible ? (
          <ProjectLabelsSection
            projectId={project.project_id}
            currentUserRole={project.user_role}
          />
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
