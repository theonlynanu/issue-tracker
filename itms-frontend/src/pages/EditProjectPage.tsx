import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, isApiError, type UpdateProjectPayload } from "../api/client";
import type { Project } from "../types/api";

export default function EditProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const [form, setForm] = useState<{
    project_key: string;
    name: string;
    description: string;
    is_public: boolean;
  }>({
    project_key: "",
    name: "",
    description: "",
    is_public: true,
  });

  useEffect(() => {
    if (!projectId) {
      setError("No project ID provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const { project } = await api.get_project(Number(projectId));
        if (cancelled) return;

        setProject(project);
        setForm({
          project_key: project.project_key,
          name: project.name,
          description: project.description ?? "",
          is_public: project.is_public === 1,
        });
      } catch (e) {
        if (cancelled) return;

        if (isApiError(e)) {
          if (e.status === 404) {
            setError("Project not found.");
          } else if (e.status === 403) {
            setError("You do not have permission to view this project.");
          } else {
            setError(`Failed to load project (HTTP ${e.status}).`);
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

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !projectId) return;

    setError(null);
    setMessage(null);

    const patch: UpdateProjectPayload = {};
    if (form.project_key.trim() !== project.project_key) {
      patch.project_key = form.project_key.trim();
    }
    if (form.name.trim() !== project.name) {
      patch.name = form.name.trim();
    }
    const trimmedDesc = form.description.trim();
    const originalDesc = project.description ?? "";
    if (trimmedDesc !== originalDesc) {
      patch.description = trimmedDesc === "" ? null : trimmedDesc;
    }

    if (Object.keys(patch).length === 0) {
      setMessage("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const { project: updated } = await api.edit_project(
        Number(projectId),
        patch
      );
      setProject(updated);
      setForm((prev) => ({
        ...prev,
        project_key: updated.project_key,
        name: updated.name,
        description: updated.description ?? "",
      }));
      setMessage("Project updated.");
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 409) {
          setError("Project key already in use.");
        } else {
          setError(`Failed to update project (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to update project: ${e.message}`);
      } else {
        setError("Failed to update project due to an unknown error.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisibility() {
    if (!project || !projectId) return;

    setError(null);
    setMessage(null);
    setTogglingVisibility(true);

    const nextPublic = !form.is_public;

    try {
      const { project: updated } = await api.update_project_visibility(
        Number(projectId),
        { is_public: nextPublic }
      );

      setProject(updated);
      setForm((prev) => ({ ...prev, is_public: updated.is_public === 1 }));
      setMessage(
        updated.is_public === 1
          ? "Project is now public."
          : "Project is now private."
      );
    } catch (e) {
      if (isApiError(e)) {
        setError(`Failed to update visibility (HTTP ${e.status}).`);
      } else if (e instanceof Error) {
        setError(`Failed to update visibility: ${e.message}`);
      } else {
        setError("Failed to update visibility due to an unknown error.");
      }
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function handleDelete() {
    if (!projectId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this project? This cannot be undone."
    );
    if (!confirmed) return;

    setError(null);
    setMessage(null);

    try {
      await api.delete_project(Number(projectId));
      navigate("/projects");
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 404) {
          setError("Project not found.");
        } else if (e.status === 403) {
          setError("You do not have permission to delete this project.");
        } else {
          setError(`Failed to delete project (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to delete project: ${e.message}`);
      } else {
        setError("Failed to delete project due to an unknown error.");
      }
    }
  }

  if (loading) {
    return <div>Loading project...</div>;
  }

  if (!project) {
    return <div>Project not found.</div>;
  }

  if (project.user_role !== "LEAD") {
    return <div>You are not permitted to edit this project.</div>;
  }

  return (
    <div>
      <h1>Edit Project</h1>
      <p>
        <Link to={`/projects/${project.project_id}`}>Back to project</Link>
      </p>

      <form onSubmit={handleSave}>
        <div>
          <label>
            Project Key
            <input
              type="text"
              value={form.project_key}
              onChange={(e) => updateField("project_key", e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </label>
        </div>

        {error && <div>{error}</div>}
        {message && <div>{message}</div>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      <section>
        <h2>Visibility</h2>
        <p>Current: {form.is_public ? "Public" : "Private"}</p>
        <button
          type="button"
          onClick={handleToggleVisibility}
          disabled={togglingVisibility}
        >
          {togglingVisibility
            ? "Updating..."
            : form.is_public
            ? "Make private"
            : "Make public"}
        </button>
      </section>
      <section>
        <h2>Danger Zone</h2>
        <button type="button" onClick={handleDelete}>
          Delete project
        </button>
      </section>
    </div>
  );
}
