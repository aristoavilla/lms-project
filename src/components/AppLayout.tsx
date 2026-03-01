import { NavLink, Outlet } from "react-router-dom";
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
  const summary = useMemo(() => {
    if (user.role === "main_teacher") {
      const owned = (subjects.data ?? [])
        .filter((subject) => subject.teacherId === user._id)
        .map((subject) => subject.name)
        .join(", ");
      return `Class ${user.classId} Main Teacher and ${owned || "Subject"} Teacher`;
    }
    if (user.role === "specialized_teacher") {
      const owned = (subjects.data ?? [])
        .filter((subject) => subject.teacherId === user._id)
        .map((subject) => subject.name)
        .join(", ");
      return `Class ${user.classId} ${owned || "Subject"} Teacher`;
    }
    return roleLabel[user.role];
  }, [subjects.data, user]);

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
      <main>
        <header className="topbar">
          <div className="user-head">
            <strong>{user.role === "super_admin" ? "Principal Anderson" : user.name}</strong>
            <span>{summary}</span>
          </div>
          <label className="user-switcher">
            Demo user
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
