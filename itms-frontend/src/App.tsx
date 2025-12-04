import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-9xl text-slate-500">Loading...</div>;
  }

  if (!user) {
    // Not logged in - show login
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Logged in, show full app
  return (
    <Routes>
      {/*  Bare "/" gets redirected to "/projects"*/}
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
      <Route path="/issues/:issueId" element={<IssueDetailPage />} />
      {/* Catch-all: redirect to projects for now */}
      <Route path="*" element={<Navigate to="/projects" />} />
    </Routes>
  );
}
