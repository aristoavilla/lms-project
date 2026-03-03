import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { AttendancePage } from "./pages/AttendancePage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RankingPage } from "./pages/RankingPage";
import { SubmissionDetailPage } from "./pages/SubmissionDetailPage";
import { SubjectDetailPage } from "./pages/SubjectDetailPage";
import { SuperAdminPage } from "./pages/SuperAdminPage";
import { currentUserQuery } from "./services/lmsService";
import type { User } from "./types";
import { canViewRanking, isSuperAdmin } from "./utils/rbac";
import "./App.css";

function App() {
  const [activeUser, setActiveUser] = useState<string>("u-main-1");
  const user = useMemo<User | undefined>(
    () => currentUserQuery(activeUser),
    [activeUser],
  );

  if (!user) {
    return <LoginPage onLogin={setActiveUser} />;
  }

  if (!user.approved) {
    return (
      <div className="gate-screen">
        <h1>Account Pending Approval</h1>
        <p>
          Your registration is complete, but only approved users can access the
          LMS. Contact the Super Admin.
        </p>
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
              onSwitchUser={setActiveUser}
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
          <Route
            path="announcements"
            element={<AnnouncementsPage user={user} />}
          />
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
