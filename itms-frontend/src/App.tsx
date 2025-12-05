import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import IssueDetailsPage from "./pages/IssueDetailsPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import ProjectsPage from "./pages/ProjectsPage";
import AppLayout from "./components/AppLayout";
import RegisterPage from "./pages/RegisterPage";
import NewProjectPage from "./pages/NewProjectPage";
import NewIssuePage from "./pages/NewIssuePage";
import ProfilePage from "./pages/ProfilePage";
import EditProjectPage from "./pages/EditProjectPage";

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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace={false} />} />
      </Routes>
    );
  }

  // Logged in, show full app
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/*  Bare "/" gets redirected to "/projects"*/}
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<NewProjectPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="projects/:projectId/edit" element={<EditProjectPage />} />
        <Route
          path="projects/:projectId/issues/new"
          element={<NewIssuePage />}
        />
        <Route path="issues/:issueId" element={<IssueDetailsPage />} />
        <Route path="me" element={<ProfilePage />} />

        {/* Catch-all: redirect to projects for now */}
        <Route path="*" element={<Navigate to="/projects" />} />
      </Route>
    </Routes>
  );
}
