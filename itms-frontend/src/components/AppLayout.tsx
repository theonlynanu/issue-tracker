import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      // App should simply re-render and show LoginPage when user becomes null
    } catch (e) {
      // Should only occur due to network errors or similar
      console.error("Logout failed:", e);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between w-full px-8 py-4 bg-slate-900 border-b border-slate-800">
        <span className="font-semibold tracking-wide">ITMS</span>

        <nav className="flex items-center gap-4">
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              "app-nav-link" + (isActive ? " app-nav-link-active" : "")
            }
          >
            Projects
          </NavLink>
        </nav>

        <div className="flex items-center">
          {user && (
            <NavLink className="gap-3 hover:cursor-pointer" to="/me">
              <span>
                {user.first_name} {user.last_name} ({user.username})
              </span>
            </NavLink>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1 rounded-md border-slate-600 text-xs font-medium hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 w-full max-w-full mx-2 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
