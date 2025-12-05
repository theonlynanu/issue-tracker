import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, isApiError } from "../api/client";
import type { Project } from "../types/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const { projects } = await api.list_projects();
        if (!cancelled) {
          setProjects(projects);
        }
      } catch (e) {
        if (isApiError(e)) {
          setError(`Failed to load projects (HTTP ${e.status})`);
        } else if (e instanceof Error) {
          setError(`Failed to load projects: ${e.message}`);
        } else {
          setError("Failed to load projects due to an unknown error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div>Loading projects...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (projects.length === 0) {
    return <div>No projects found.</div>;
  }

  return (
    <div>
      <h1>Projects</h1>
      <button type="button" onClick={() => navigate("/projects/new")}>
        New Project
      </button>

      {projects.length === 0 ? (
        <p>No projects found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Visibility</th>
              <th>Description</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.project_id}>
                <td>
                  <Link to={`/projects/${project.project_id}`}>
                    {project.project_key}
                  </Link>
                </td>
                <td>{project.name}</td>
                <td>{project.is_public ? "Public" : "Private"}</td>
                <td>{project.description}</td>
                <td>{new Date(project.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
