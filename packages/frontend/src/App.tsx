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
import { FeedbackPage } from "./pages/FeedbackPage";
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
  SESSION_USER_UPDATED_EVENT,
} from "./services/lmsService";
import {
  captureError,
  captureEvent,
  identifyPosthogUser,
  isFeatureEnabled,
  onFeatureFlags,
  reloadFeatureFlags,
  resetPosthogUser,
} from "./services/posthog";
import type { User } from "./types";
import { canViewRanking, isSuperAdmin } from "./utils/rbac";
import "./App.css";

const FEEDBACK_PAGE_FLAG = "feedback_page_access";

function App() {
  const queryClient = useQueryClient();
  const [activeUser, setActiveUser] = useState<string | null>(() => getSessionUser()?._id ?? null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => activeUser === null && hasSessionToken());
  const [feedbackPageEnabled, setFeedbackPageEnabled] = useState(false);
  const user = useMemo<User | undefined>(
    () => (activeUser ? currentUserQuery(activeUser) : undefined),
    [activeUser, sessionVersion],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleSessionUpdate = () => setSessionVersion((current) => current + 1);
    window.addEventListener(SESSION_USER_UPDATED_EVENT, handleSessionUpdate);
    return () => window.removeEventListener(SESSION_USER_UPDATED_EVENT, handleSessionUpdate);
  }, []);

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
          captureEvent("session_restored", { userId: restored._id, role: restored.role });
        }
      } catch (error) {
        if (!disposed) {
          setBootError(error instanceof Error ? error.message : "Unable to restore your session.");
          captureError(error, { source: "session_restore" });
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

  useEffect(() => {
    if (!user) {
      resetPosthogUser();
      return;
    }

    identifyPosthogUser({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      classId: user.classId,
      subjectId: user.subjectId,
    });
    reloadFeatureFlags();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFeedbackPageEnabled(false);
      return;
    }

    const syncFeedbackFlag = () => {
      setFeedbackPageEnabled(isFeatureEnabled(FEEDBACK_PAGE_FLAG));
    };

    syncFeedbackFlag();
    const unsubscribe = onFeatureFlags(syncFeedbackFlag);
    reloadFeatureFlags();

    return () => {
      unsubscribe();
    };
  }, [user]);

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
              canAccessFeedback={feedbackPageEnabled}
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
          <Route
            path="feedback"
            element={
              feedbackPageEnabled ? (
                <FeedbackPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
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
