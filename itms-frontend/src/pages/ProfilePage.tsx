import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, isApiError } from "../api/client";
import type { UpdateMePayload } from "../api/client";
import type { User } from "../types/api";

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();

  const [form, setForm] = useState<
    Pick<User, "username" | "first_name" | "last_name">
  >({
    username: "",
    first_name: "",
    last_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      });
    }
  }, [user]);

  // Shouldn't really be any way to get to this
  if (!user) {
    return <div>You must be logged in to view your profile.</div>;
  }

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!user) {
      return;
    }

    const patch: UpdateMePayload = {};
    if (form.username !== user.username) patch.username = form.username.trim();
    if (form.first_name !== user.first_name)
      patch.first_name = form.first_name.trim();
    if (form.last_name !== user.last_name)
      patch.last_name = form.last_name.trim();

    if (Object.keys(patch).length === 0) {
      setMessage("No changes to save.");
      return;
    }

    setSubmitting(true);

    try {
      await api.update_me(patch);
      await refreshMe();
      setMessage("Profile updated.");
    } catch (e) {
      if (isApiError(e)) {
        setError(e.message || `Failed to update profile (HTTP ${e.status}).`);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unknown error while updating profile.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>My Profile</h1>

      <section className="flex flex-col my-4">
        <h2 className="text-2xl">Account Information</h2>
        <p>User ID: {user.user_id}</p>
        <p>
          Email: {user.email} {"(Cannot be changed)"}
        </p>
        <p>Joined: {new Date(user.created_at).toLocaleString()}</p>
      </section>
      <button type="button" onClick={() => setEditOpen(!editOpen)}>
        {!editOpen ? "Edit profile?" : "Close editor"}
      </button>
      {editOpen ? (
        <section>
          <form onSubmit={handleSubmit}>
            <div>
              <label>
                Username
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  className="border border-slate-700 rounded-md mx-2 py-1 px-2"
                />
              </label>
            </div>
            <div>
              <label>
                First name
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  className="border border-slate-700 rounded-md mx-2 py-1 px-2"
                />
              </label>
            </div>
            <div>
              <label>
                Last name
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  className="border border-slate-700 rounded-md mx-2 py-1 px-2"
                />
              </label>
            </div>

            {error && <div>{error}</div>}
            {message && <div>{message}</div>}

            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </button>
          </form>
        </section>
      ) : (
        <></>
      )}
    </div>
  );
}
