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
import { currentUserQuery, getSessionUser, logout, restoreSessionUser } from "./services/lmsService";
import type { User } from "./types";
import { canViewRanking, isSuperAdmin } from "./utils/rbac";
import "./App.css";

function App() {
  const queryClient = useQueryClient();
  const [activeUser, setActiveUser] = useState<string | null>(() => getSessionUser()?._id ?? null);
  const [restoringSession, setRestoringSession] = useState(() => activeUser === null);
  const user = useMemo<User | undefined>(
    () => (activeUser ? currentUserQuery(activeUser) : undefined),
    [activeUser],
  );

  useEffect(() => {
    if (activeUser) {
      setRestoringSession(false);
      return;
    }

    let disposed = false;
    setRestoringSession(true);

    void (async () => {
      try {
        const restored = await restoreSessionUser();
        if (!disposed && restored) {
          setActiveUser(restored._id);
        }
      } finally {
        if (!disposed) {
          setRestoringSession(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [activeUser]);

  async function handleLogout() {
    await logout(activeUser ?? undefined);
    queryClient.clear();
    setActiveUser(null);
  }

  if (restoringSession) {
    return (
      <div className="gate-screen">
        <h1>Restoring Session</h1>
        <p>Please wait while we restore your account.</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setActiveUser} />;
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
