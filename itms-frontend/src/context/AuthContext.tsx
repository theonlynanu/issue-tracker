import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/api";
import { api, isApiError } from "../api/client";

// Shape of the auth state and actions exposed to the frontend
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

// Creates context to enforce usage in the AuthProvider
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Actual provider for wrapping app that:
// - fetches current user
// - exposes login/logout/refresh helpers
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Upon mount, retrieve user info
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { user } = await api.me();
        if (!cancelled) {
          setUser(user);
        }
      } catch (e) {
        // If unauthorized, we're simply not logged in
        if (isApiError(e) && e.status === 401) {
          if (!cancelled) {
            setUser(null);
          }
        } else {
          // Log unexpected errors
          console.error("Failed to fetch /me:", e);
          if (!cancelled) {
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Login:
   * - POST /auth/login with identifier + password
   * - then GET /me to get full User object
   * If something fails, caller should handle error
   */
  const login = async (identifier: string, password: string) => {
    // Throws ApiError on bad credentials - expect caller to catch
    await api.login({ identifier, password });

    // After successful login, fetch full User
    const { user } = await api.me();
    setUser(user);
  };

  /**
   * Logout:
   * - POST /auth/logout
   * - set user to null
   */
  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // If logout fails (should only happen with network issues), we still clear local user
      console.error("Logout error:", e);
    } finally {
      setUser(null);
    }
  };

  /**
   * Refresh currently logged-in user (for after PATCH /me)
   */
  const refreshMe = async () => {
    const { user } = await api.me();
    setUser(user);
  };

  const value: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Nice hook for accessing auth state and actions. Throws if used outside of <AuthProvider>
 */
// TODO: I know this export is dirty, but I don't want to break it out into 3 files right now
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
