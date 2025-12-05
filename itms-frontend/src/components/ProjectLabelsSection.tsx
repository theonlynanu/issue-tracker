import { useEffect, useState } from "react";
import { api, isApiError } from "../api/client";
import type { Label, ProjectRole } from "../types/api";

interface ProjectLabelsSectionProps {
  projectId: number;
  currentUserRole: ProjectRole | null;
  visible: boolean;
}

export default function ProjectLabelsSection({
  projectId,
  currentUserRole,
  visible,
}: ProjectLabelsSectionProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [newLabelName, setNewLabelName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);

  const canManageLabels =
    currentUserRole === "LEAD" || currentUserRole === "DEVELOPER";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setActionMessage(null);

      try {
        const { labels } = await api.list_project_labels(projectId);
        if (!cancelled) {
          setLabels(labels);
        }
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 403) {
            setError("You do not have access to view labels for this project.");
          } else if (e.status === 404) {
            setError("Project not found or not visible.");
          } else {
            setError(`Failed to load labels (HTTP ${e.status}).`);
          }
        } else if (e instanceof Error) {
          setError(`Failed to load labels: ${e.message}`);
        } else {
          setError("Failed to load labels due to an unknown error.");
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

  async function refreshLabels() {
    try {
      const { labels } = await api.list_project_labels(projectId);
      setLabels(labels);
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 403) {
          setError("You do not have access to view labels for this project.");
        } else if (e.status === 404) {
          setError("Project not found or not visible.");
        } else {
          setError(`Failed to load labels (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to load labels: ${e.message}`);
      } else {
        setError("Failed to load labels due to an unknown error.");
      }
    }
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageLabels) return;

    const name = newLabelName.trim();
    if (!name) {
      setError("Label name is required.");
      return;
    }

    setCreating(true);
    setError(null);
    setActionMessage(null);

    try {
      await api.create_project_label(projectId, { name });
      setNewLabelName("");
      setActionMessage("Label created.");
      await refreshLabels();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 409 && e.details && typeof e.details === "object") {
          const details = e.details as { error?: string };
          setError(details.error ?? "Label with this name already exists.");
        } else if (e.status === 403) {
          setError("You do not have permission to create labels.");
        } else {
          setError(`Failed to create label (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to create label: ${e.message}`);
      } else {
        setError("Failed to create label due to an unknown error.");
      }
    } finally {
      setCreating(false);
    }
  }

  function startEdit(label: Label) {
    setEditingLabelId(label.label_id);
    setEditingName(label.name);
    setActionMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingLabelId(null);
    setEditingName("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageLabels || editingLabelId == null) return;

    const name = editingName.trim();
    if (!name) {
      setError("Label name cannot be empty");
      return;
    }

    setSavingEdit(true);
    setError(null);
    setActionMessage(null);

    try {
      await api.update_project_label(projectId, editingLabelId, { name });
      setActionMessage("Label updated.");
      cancelEdit();
      await refreshLabels();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 409 && e.details && typeof e.details === "object") {
          const details = e.details as { error?: string };
          setError(details.error ?? "Cannot rename label due to a conflict.");
        } else if (e.status === 403) {
          setError("You do not have permission to edit labels.");
        } else {
          setError(`Failed to rename label (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to rename label: ${e.message}`);
      } else {
        setError("Failed to rename label due to an unknown error.");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeletelabel(labelId: number) {
    if (!canManageLabels) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this label? It will be removed from all issues."
    );
    if (!confirmed) return;

    setDeletingLabelId(labelId);
    setError(null);
    setActionMessage(null);

    try {
      await api.delete_project_label(projectId, labelId);
      setActionMessage("Label deleted.");
      await refreshLabels();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 403) {
          setError("You do not have permission to delete labels.");
        } else {
          setError(`Failed to delete label (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to delete label: ${e.message}`);
      } else {
        setError("Failed to delete label due to an unknown error.");
      }
    } finally {
      setDeletingLabelId(null);
    }
  }

  if (loading) {
    return (
      <section>
        <h2>Project Labels</h2>
        <div>Loading labels...</div>
      </section>
    );
  }

  return (
    <section className={visible ? "" : "hidden"}>
      <h2 className="text-2xl my-4">Project Labels</h2>
      {error && <div>{error}</div>}
      {actionMessage && <div>{actionMessage}</div>}

      {labels.length == 0 ? (
        <p>No labels defined for this project.</p>
      ) : (
        <table className="w-full text-center">
          <thead>
            <tr>
              <th>Name</th>
              {canManageLabels && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label.label_id} className="border-y h-12 ">
                <td>
                  {editingLabelId === label.label_id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      disabled={savingEdit}
                      placeholder={label.name}
                      className="border border-slate-700 rounded-md mx-2 py-1 px-2"
                    />
                  ) : (
                    label.name
                  )}
                </td>
                {canManageLabels && (
                  <td className="flex justify-center gap-8 items-center text-sm my-2 ">
                    {editingLabelId === label.label_id ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                          className="bg-slate-500 hover:bg-slate-600 rounded-2xl px-2 py-1"
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(label)}
                          disabled={deletingLabelId === label.label_id}
                          className="bg-slate-500 hover:bg-slate-600 rounded-2xl px-2 py-1 "
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletelabel(label.label_id)}
                          disabled={deletingLabelId === label.label_id}
                          className="bg-slate-500 hover:bg-slate-600 rounded-2xl px-2 py-1 "
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManageLabels && (
        <form onSubmit={handleCreateLabel} className="my-4">
          <h3 className="underline font-semibold text-xl">Add Label</h3>
          <div>
            <label>
              Name
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                disabled={creating}
                className="border border-slate-700 rounded-md mx-2 py-1 px-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-slate-500 hover:bg-slate-600 rounded-2xl px-2 py-1 my-2"
          >
            {creating ? "Creating..." : "Create New Label"}
          </button>
        </form>
      )}
    </section>
  );
}
