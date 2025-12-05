import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, isApiError } from "../api/client";
import type { CreateProjectPayload } from "../api/client";

export default function NewProjectPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateProjectPayload>({
    project_key: "",
    name: "",
    description: "",
    is_public: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof CreateProjectPayload>(
    key: K,
    value: CreateProjectPayload[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.project_key.trim() || !form.name.trim()) {
      setError("Project key and name are required.");
      return;
    }

    setSubmitting(true);

    try {
      const { project } = await api.create_project({
        ...form,
        project_key: form.project_key.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
      });

      navigate(`/projects/${project.project_id}`);
    } catch (e) {
      if (isApiError(e)) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unexpected error while creating project.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="my-8">New Project</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div>
          <label>
            Project Key
            <input
              type="text"
              value={form.project_key}
              onChange={(e) => updateField("project_key", e.target.value)}
              className="border border-slate-700 rounded-md mx-2 py-1 px-2"
              placeholder="FRONTEND-AUTH-123"
              required
            />
          </label>
        </div>
        <div>
          <label>
            Name
            <input
              type="text"
              value={form.name}
              className="border border-slate-700 rounded-md mx-2 py-1 px-2"
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label className="flex">
            Description
            <textarea
              value={form.description ?? ""}
              className="border border-slate-700 rounded-md mx-2 py-1 px-2"
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </label>
        </div>
        <div>
          <label>
            Public project
            <input
              type="checkbox"
              checked={!!form.is_public}
              className="border border-slate-700 rounded-md mx-2 py-1 px-2"
              onChange={(e) => updateField("is_public", e.target.checked)}
            />
          </label>
        </div>

        {error && <div>{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="border w-fit p-2 bg-emerald-800 rounded-2xl"
        >
          {submitting ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
