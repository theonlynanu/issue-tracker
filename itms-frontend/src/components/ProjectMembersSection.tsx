import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, isApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { ProjectMember, ProjectRole } from "../types/api";

interface ProjectMemberSectionProps {
  projectId: number;
  currentUserRole: ProjectRole | null;
  visible: boolean;
}

export default function ProjectMembersSection({
  projectId,
  currentUserRole,
  visible,
}: ProjectMemberSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<number | null>(null);

  const [newIdentifier, setNewIdentifier] = useState<string>("");
  const [newRole, setNewRole] = useState<ProjectRole>("VIEWER");
  const [addingMember, setAddingMember] = useState(false);

  const isActingLead = currentUserRole === "LEAD";
  const currentUserId = user?.user_id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      setError(null);
      setActionMessage(null);

      try {
        const { members } = await api.list_project_members(projectId);
        if (!cancelled) {
          setMembers(members);
        }
      } catch (e) {
        if (cancelled) return;

        if (isApiError(e)) {
          if (e.status === 403) {
            setError("You do not have access to view project members.");
          } else if (e.status === 404) {
            setError("Project not found or not visible.");
          } else {
            setError(`Failed to load project members (HTTP ${e.status}).`);
          }
        } else if (e instanceof Error) {
          setError(`Failed to load project members: ${e.message}`);
        } else {
          setError("Failed to load project members due to an unknown error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function refreshMembers() {
    try {
      const { members } = await api.list_project_members(projectId);
      setMembers(members);
    } catch (e) {
      if (isApiError(e)) {
        setError(`Failed to refresh members (HTTP ${e.status}).`);
      } else if (e instanceof Error) {
        setError(`Failed to refresh members: ${e.message}`);
      } else {
        setError("Failed to refresh members due to an unknown error.");
      }
    }
  }

  async function handleRemoveMember(memberId: number) {
    setError(null);
    setActionMessage(null);

    const isSelf = currentUserId !== null && memberId === currentUserId;

    const confirmed = window.confirm(
      isSelf
        ? "Are you sure you want to leave this project?"
        : "Are you sure you want to remove this member from this project?"
    );
    if (!confirmed) {
      return;
    }

    setSavingMemberId(memberId);
    try {
      await api.remove_project_member(projectId, memberId);
      setActionMessage(
        isSelf ? "You have left the project" : "Member removed from project."
      );

      // If the current user removed themselves, they are no longer a member, and should
      // get kicked back to the projects list.
      if (isSelf) {
        navigate("/projects");
        return;
      }

      const { members } = await api.list_project_members(projectId);
      setMembers(members);
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 409 && e.details && typeof e.details === "object") {
          // Backend returns a specific error message for last-lead cases
          const details = e.details as { error?: string };
          setError(
            details.error ?? "Cannot remove this member due to a conflict."
          );
        } else if (e.status === 403) {
          setError("You do not have permission to remove project members.");
        } else {
          setError(`Failed to remove member (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to remove member: ${e.message}`);
      } else {
        setError("Failed to remove member due to an unknown error.");
      }
    } finally {
      setSavingMemberId(null);
    }
  }

  async function handleChangeRole(memberId: number, newRole: ProjectRole) {
    setError(null);
    setActionMessage(null);
    setSavingMemberId(memberId);

    const confirmed = window.confirm(
      "Are you sure you want to change this user's role?"
    );
    if (!confirmed) {
      return;
    }

    try {
      await api.change_project_member_role(projectId, memberId, newRole);
      setActionMessage("Member role updated");

      const { members } = await api.list_project_members(projectId);
      setMembers(members);
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 409 && e.details && typeof e.details === "object") {
          const details = e.details as { error?: string };
          setError(details.error ?? "Cannot change role due to a conflict.");
        } else if (e.status === 403) {
          setError("You do not have permission to change member roles.");
        } else {
          setError(`Failed to change member role (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setError(`Failed to change member role: ${e.message}`);
      } else {
        setError("Failed to change member role due to an unknown error.");
      }
    } finally {
      setSavingMemberId(null);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!isActingLead) return;
    if (!newIdentifier.trim()) {
      setError("Identifier (username/email) is required to add a member.");
      return;
    }

    setError(null);
    setActionMessage(null);
    setAddingMember(true);

    try {
      await api.add_project_member(projectId, {
        identifier: newIdentifier.trim(),
        role: newRole,
      });
      setActionMessage("Member added to the project");
      setNewIdentifier("");
      setNewRole("VIEWER");
      await refreshMembers();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 404) {
          setAddUserError("User not found.");
        } else if (
          e.status === 409 &&
          e.details &&
          typeof e.details === "object"
        ) {
          const details = e.details as { error?: string };
          setAddUserError(
            details.error ?? "Cannot add this member due to a conflict."
          );
        } else if (e.status === 403) {
          setAddUserError(
            "You do not have permission to add members to this project."
          );
        } else {
          setAddUserError(`Failed to add member (HTTP ${e.status}).`);
        }
      } else if (e instanceof Error) {
        setAddUserError(`Failed to add member: ${e.message}`);
      } else {
        setAddUserError("Failed to add member due to an unknown error.");
      }
    } finally {
      setAddingMember(false);
    }
  }

  if (loading) {
    return <div>Loading project members...</div>;
  }

  if (error) {
    return (
      <section>
        <h2>Project Members</h2>
        <div>{error}</div>
      </section>
    );
  }

  return (
    <section className={visible ? "" : "hidden"}>
      <h2 className="text-2xl">Project Members</h2>
      {actionMessage && <div>{actionMessage}</div>}

      {members.length === 0 ? (
        <div>No members found for this project.</div>
      ) : (
        <table className="w-full text-center p-8 mx-auto">
          <thead className="">
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              {isActingLead && <th>Actions</th>}
            </tr>
          </thead>
          <tbody className="">
            {members.map((member) => {
              const isSelf =
                currentUserId !== null && member.user_id === currentUserId;
              const disabled = savingMemberId === member.user_id;

              return (
                <tr key={member.user_id} className="border-y my-4 h-12">
                  <td>
                    {member.first_name} {member.last_name} ({member.username})
                  </td>
                  <td>
                    {isActingLead && !isSelf ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleChangeRole(
                            member.user_id,
                            e.target.value as ProjectRole
                          )
                        }
                        disabled={disabled}
                        className="bg-slate-800 rounded-2xl px-2 py-1 hover:bg-slate-900"
                      >
                        <option value="LEAD">LEAD</option>
                        <option value="DEVELOPER">DEVELOPER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      member.role
                    )}
                  </td>
                  <td>{new Date(member.joined_at).toLocaleString()}</td>
                  {isActingLead && (
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={disabled}
                        className="bg-slate-500 rounded-2xl px-2 py-1 text-sm hover:bg-slate-600"
                      >
                        {isSelf ? "Leave project" : "Remove"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {addUserError && <div>{addUserError}</div>}
      {isActingLead && (
        <form onSubmit={handleAddMember} className="my-4">
          <h3 className="text-2xl">Add Member</h3>
          <div>
            <label>
              Identifer (username or email)
              <input
                type="text"
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                disabled={addingMember}
                className="border border-slate-700 rounded-md mx-2 py-1 px-2 hover:bg-slate-800"
              />
            </label>
          </div>
          <div>
            <label>
              Role
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as ProjectRole)}
                disabled={addingMember}
                className="border border-slate-700 rounded-md mx-2 py-1 px-2 bg-slate-800 hover:bg-slate-900"
              >
                <option value="LEAD">LEAD</option>
                <option value="DEVELOPER">DEVELOPER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={addingMember}
            className="bg-slate-500 rounded-2xl px-2 py-1 my-2 hover:bg-slate-600"
          >
            {addingMember ? "Adding..." : "Add member"}
          </button>
        </form>
      )}
    </section>
  );
}
