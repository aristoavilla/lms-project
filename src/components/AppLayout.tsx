import { NavLink, Outlet } from "react-router-dom";
import { getAllUsers } from "../services/lmsService";
import type { User } from "../types";
import { canViewRanking, isSuperAdmin, roleLabel } from "../utils/rbac";

interface Props {
  user: User;
  onSwitchUser: (userId: string) => void;
}

export function AppLayout({ user, onSwitchUser }: Props) {
  const allUsers = getAllUsers();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>Saint Lucia LMS</h2>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/assignments">Assignments</NavLink>
          <NavLink to="/attendance">Attendance</NavLink>
          <NavLink to="/announcements">Announcements</NavLink>
          {canViewRanking(user) && <NavLink to="/ranking">Ranking</NavLink>}
          {isSuperAdmin(user) && <NavLink to="/admin">Admin Panel</NavLink>}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <strong>{user.name}</strong>
            <span className="role-chip">{roleLabel[user.role]}</span>
          </div>
          <label className="user-switcher">
            Demo user:
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
