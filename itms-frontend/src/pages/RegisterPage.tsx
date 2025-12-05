import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { RegisterPayload } from "../api/client";
import React, { useState } from "react";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterPayload>({
    email: "",
    username: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof RegisterPayload>(
    key: K,
    value: RegisterPayload[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate("/projects");
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unexpected error during registration.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Create an account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col p-4 gap-2">
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
            autoComplete="email"
            className="border border-slate-700 rounded-md mx-2 py-1 px-2"
          />
        </label>
        <label>
          Username
          <input
            type="text"
            value={form.username}
            onChange={(e) => updateField("username", e.target.value)}
            required
            autoComplete="username"
            className="border border-slate-700 rounded-md mx-2 py-1 px-2"
          />
        </label>
        <label>
          First name
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => updateField("first_name", e.target.value)}
            required
            autoComplete="given-name"
            className="border border-slate-700 rounded-md mx-2 py-1 px-2"
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => updateField("last_name", e.target.value)}
            required
            autoComplete="family-name"
            className="border border-slate-700 rounded-md mx-2 py-1 px-2"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            required
            autoComplete="new-password"
            className="border border-slate-700 rounded-md mx-2 py-1 px-2"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="border border-slate-700 rounded-md mx-2 py-1 px-2"
          />
        </label>
        {error && <div>{error}</div>}

        <button type="submit" disabled={submitting} className="w-64">
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
