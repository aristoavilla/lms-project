import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import * as lms from "../services/lmsService";
import type { Notification, User } from "../types";

function timeAgo(isoString: string) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const CATEGORY_ICON: Record<Notification["category"], string> = {
  assignment: "📝",
  submission: "📤",
  grading: "🏅",
  attendance: "📋",
  announcement: "📣",
  message: "💬",
};

export function NotificationBell({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", user._id],
    queryFn: () => lms.getNotifications(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const notifs: Notification[] = data ?? [];
  const unreadCount = notifs.filter((n) => !n.read).length;

  const markAll = useMutation({
    mutationFn: () => lms.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user._id] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => lms.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user._id] }),
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleBellClick() {
    const next = !open;
    setOpen(next);
    // Auto mark-all on open if there are unread notifications
    if (next && unreadCount > 0) {
      markAll.mutate();
    }
  }

  function handleMarkOne(id: string, isRead: boolean) {
    if (!isRead) markOne.mutate(id);
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        className="notif-bell-btn"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        onClick={handleBellClick}
        type="button"
      >
        <span className="notif-bell-icon" aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="region" aria-label="Notifications">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
            {notifs.some((n) => !n.read) && (
              <button
                className="notif-mark-all-btn"
                onClick={() => markAll.mutate()}
                type="button"
                disabled={markAll.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifs.length === 0 && (
              <div className="notif-empty">No notifications yet</div>
            )}
            {notifs.map((n) => (
              <button
                key={n._id}
                className={`notif-item${n.read ? "" : " notif-item--unread"}`}
                onClick={() => handleMarkOne(n._id, n.read)}
                type="button"
              >
                <span className="notif-item-icon" aria-hidden="true">
                  {CATEGORY_ICON[n.category] ?? "🔔"}
                </span>
                <span className="notif-item-body">
                  <span className="notif-item-title">{n.title}</span>
                  <span className="notif-item-text">{n.body}</span>
                  <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="notif-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
