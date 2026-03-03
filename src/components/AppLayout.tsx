import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useSubjects } from "../hooks/useLmsQueries";
import { getAllUsers } from "../services/lmsService";
import type { User } from "../types";
import { canViewRanking, isSuperAdmin, roleLabel } from "../utils/rbac";

interface Props {
  user: User;
  onSwitchUser: (userId: string) => void;
}

export function AppLayout({ user, onSwitchUser }: Props) {
  const allUsers = getAllUsers();
  const subjects = useSubjects(user);
  const location = useLocation();
  const subjectName = useMemo(
    () => (subjects.data ?? []).find((subject) => subject._id === user.subjectId)?.name ?? "Subject",
    [subjects.data, user.subjectId],
  );
  const summary = useMemo(() => {
    if (user.role === "main_teacher") {
      return `Main Teacher of ${user.classId.replace("class-", "")} and ${subjectName} Teacher`;
    }
    if (user.role === "specialized_teacher") {
      return `${subjectName} Teacher (${(user.taughtClassIds ?? [user.classId]).join(", ")})`;
    }
    return roleLabel[user.role];
  }, [subjectName, user]);
  const crumbs = useMemo(() => {
    const labels: Record<string, string> = {
      "": "Dashboard",
      assignments: "Assignments",
      ranking: "Ranking",
      attendance: "Attendance",
      announcements: "Announcements",
      admin: "Admin",
      subjects: "Subject",
      submissions: "Submission",
    };
    const parts = location.pathname.split("/").filter(Boolean);
    const items = ["Dashboard", ...parts.map((part) => labels[part] ?? part)];
    return items.join(" / ");
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h2>Saint Lucia School</h2>
          <p>Learning Management System</p>
        </div>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/assignments">Assignments</NavLink>
          {canViewRanking(user) && <NavLink to="/ranking">Ranking</NavLink>}
          <NavLink to="/attendance">Attendance</NavLink>
          <NavLink to="/announcements">Announcements</NavLink>
          {isSuperAdmin(user) && <NavLink to="/admin">Admin Panel</NavLink>}
        </nav>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="user-head">
            <small className="crumbs">{crumbs}</small>
            <strong>{user.role === "super_admin" ? "Principal Anderson" : user.name}</strong>
            <span>{summary}</span>
          </div>
          <label className="user-switcher">
            <span>Demo user</span>
            <select
              value={user._id}
              onChange={(event) => onSwitchUser(event.target.value)}
            >
              {allUsers.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name} ({roleLabel[person.role]})
                </option>
              ))}
            </select>
          </label>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
