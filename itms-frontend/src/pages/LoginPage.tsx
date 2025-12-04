import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isApiError } from "../api/client";

export function LoginPage() {
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
      if (isApiError(e) && e.status == 401) {
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
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Email or Username
            <input
              type="test"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
        </div>

        <div>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        </div>

        {error && <div>{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
