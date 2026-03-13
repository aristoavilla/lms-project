import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSubjects } from "../hooks/useLmsQueries";
import type { User } from "../types";
import { canViewRanking, isSuperAdmin, roleLabel } from "../utils/rbac";
import { NotificationBell } from "./NotificationBell";

interface Props {
  user: User;
  canAccessFeedback: boolean;
  onLogout: () => void;
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppLayout({ user, canAccessFeedback, onLogout }: Props) {
  const subjects = useSubjects(user);
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user.role === "super_admin" ? "Principal Anderson" : user.name;
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
      chat: "Chat",
      feedback: "Feedback",
      profile: "Profile",
      admin: "Admin",
      subjects: "Subject",
      submissions: "Submission",
    };
    const parts = location.pathname.split("/").filter(Boolean);
    const items = ["Dashboard", ...parts.map((part) => labels[part] ?? part)];
    return items.join(" / ");
  }, [location.pathname]);

  const sidebarLinks = useMemo(
    () => [
      {
        to: "/",
        label: "Dashboard",
        icon: "M4 12.5 12 5l8 7.5V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1z",
        show: true,
      },
      {
        to: "/assignments",
        label: "Assignments",
        icon: "M7 4h10l3 3v13H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm7 0v4h4",
        show: true,
      },
      {
        to: "/ranking",
        label: "Ranking",
        icon: "M5 19V9m7 10V5m7 14v-7",
        show: canViewRanking(user),
      },
      {
        to: "/attendance",
        label: "Attendance",
        icon: "M7 3v4M17 3v4M4 9h16M6 6h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2z",
        show: true,
      },
      {
        to: "/announcements",
        label: "Announcements",
        icon: "M4 13V9a8 8 0 0 1 16 0v4l2 3H2zm6 8a2 2 0 0 0 4 0",
        show: true,
      },
      {
        to: "/chat",
        label: "Chat",
        icon: "M4 6h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
        show: true,
      },
      {
        to: "/feedback",
        label: "Feedback",
        icon: "M4 12h16M4 6h16M4 18h10",
        show: canAccessFeedback,
      },
      {
        to: "/admin",
        label: "Admin Panel",
        icon: "M12 2 3 6v6c0 5.2 3.7 9.4 9 10 5.3-.6 9-4.8 9-10V6zM9 12l2 2 4-4",
        show: isSuperAdmin(user),
      },
    ],
    [canAccessFeedback, user],
  );

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current) {
        return;
      }
      const target = event.target as Node;
      if (!menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h2>Saint Lucia School</h2>
          <p>Learning Management System</p>
        </div>
        <p className="sidebar-label">Navigation</p>
        <nav>
          {sidebarLinks
            .filter((item) => item.show)
            .map((item) => (
              <NavLink key={item.to} to={item.to} className="sidebar-link">
                <span className="sidebar-link-icon">
                  <Icon path={item.icon} />
                </span>
                <span className="sidebar-link-text">{item.label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-meta-card">
          <small>Current Role</small>
          <strong>{roleLabel[user.role]}</strong>
          <span>{user.classId.replace("class-", "Class ")}</span>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="user-head">
            <small className="crumbs">{crumbs}</small>
            <strong>{displayName}</strong>
            <span>{summary}</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-user-chip">
              <strong>{displayName}</strong>
              <small>{roleLabel[user.role]}</small>
            </div>
            <NotificationBell user={user} />
            <div className="user-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="avatar-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open account menu"
            >
              <span className="avatar-core">
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={user.name} className="avatar-image" />
                ) : (
                  <span className="avatar-fallback">{user.name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span className="avatar-caret" aria-hidden="true">
                {menuOpen ? "^" : "v"}
              </span>
            </button>
            {menuOpen && (
              <div className="user-menu-dropdown" role="menu">
                <div className="user-menu-header">
                  <strong>{displayName}</strong>
                  <small className="user-menu-role">{roleLabel[user.role]}</small>
                </div>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profile");
                  }}
                >
                  Profile Settings
                </button>
                <button
                  type="button"
                  className="user-menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
            </div>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
