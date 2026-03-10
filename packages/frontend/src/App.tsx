import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "./components/AppLayout";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { AttendancePage } from "./pages/AttendancePage";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RankingPage } from "./pages/RankingPage";
import { SubmissionDetailPage } from "./pages/SubmissionDetailPage";
import { SubjectDetailPage } from "./pages/SubjectDetailPage";
import { SuperAdminPage } from "./pages/SuperAdminPage";
import {
  currentUserQuery,
  getSessionUser,
  hasSessionToken,
  logout,
  restoreSessionUser,
} from "./services/lmsService";
import type { User } from "./types";
import { canViewRanking, isSuperAdmin } from "./utils/rbac";
import "./App.css";

function App() {
  const queryClient = useQueryClient();
  const [activeUser, setActiveUser] = useState<string | null>(() => getSessionUser()?._id ?? null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => activeUser === null && hasSessionToken());
  const user = useMemo<User | undefined>(
    () => (activeUser ? currentUserQuery(activeUser) : undefined),
    [activeUser],
  );

  useEffect(() => {
    if (activeUser) {
      setBootstrapping(false);
      return;
    }

    let disposed = false;

    if (!hasSessionToken()) {
      setBootstrapping(false);
      return;
    }

    setBootstrapping(true);
    setBootError(null);

    void (async () => {
      try {
        const restored = await restoreSessionUser();
        if (!disposed && restored) {
          setActiveUser(restored._id);
        }
      } catch (error) {
        if (!disposed) {
          setBootError(error instanceof Error ? error.message : "Unable to restore your session.");
        }
      } finally {
        if (!disposed) {
          setBootstrapping(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [activeUser]);

  async function handleLogout() {
    await logout();
    queryClient.clear();
    setActiveUser(null);
    setBootError(null);
  }

  if (bootstrapping) {
    return (
      <div className="gate-screen">
        <h1>Loading</h1>
        <p>Loading your account...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setActiveUser} initialError={bootError} />;
  }

  if (!user.approved) {
    return (
      <div className="gate-screen">
        <h1>Account Pending Approval</h1>
        <p>Your account is waiting for administrator approval.</p>
        <button type="button" onClick={handleLogout}>Back to Login</button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AppLayout
              user={user}
              onLogout={handleLogout}
            />
          }
        >
          <Route index element={<DashboardPage user={user} />} />
          <Route path="assignments" element={<AssignmentsPage user={user} />} />
          <Route
            path="subjects/:subjectId"
            element={<SubjectDetailPage user={user} />}
          />
          <Route path="submissions/:submissionId" element={<SubmissionDetailPage user={user} />} />
          <Route
            path="ranking"
            element={
              canViewRanking(user) ? (
                <RankingPage user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="attendance" element={<AttendancePage user={user} />} />
          <Route path="announcements" element={<AnnouncementsPage user={user} />} />
          <Route path="chat" element={<ChatPage user={user} />} />
          <Route path="profile" element={<ProfilePage user={user} />} />
          <Route
            path="admin"
            element={
              isSuperAdmin(user) ? (
                <SuperAdminPage user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
