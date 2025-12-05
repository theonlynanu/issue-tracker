import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isApiError } from "../api/client";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(identifier, password);
      // On successful login, we update the user in the AuthProvider and re-render with main routes visible
    } catch (e) {
      if (isApiError(e) && (e.status === 401 || e.status === 404)) {
        setError("Invalid email/username or password.");
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unexpected error during lookup.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Login to ITMS</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4">
        <div>
          <label>
            Email or Username
            <input
              type="text"
              name="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              className="border border-slate-700 rounded-md mx-2 py-1 px-2"
            />
          </label>
        </div>

        <div>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="border border-slate-700 rounded-md mx-2 py-1 px-2"
            />
          </label>
        </div>

        {error && <div>{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-64 bg-emerald-700"
        >
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
