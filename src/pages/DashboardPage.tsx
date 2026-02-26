import { Link } from "react-router-dom";
import { useAnnouncements, useAssignments, useAttendance } from "../hooks/useLmsQueries";
import type { User } from "../types";

interface Props {
  user: User;
}

export function DashboardPage({ user }: Props) {
  const assignments = useAssignments(user);
  const announcements = useAnnouncements(user);
  const attendance = useAttendance(user);

  return (
    <div className="grid">
      <article className="panel">
        <h3>Role Summary</h3>
        <p>
          Class: <strong>{user.classId}</strong>
        </p>
        <p>Pending assignments: {assignments.data?.length ?? 0}</p>
        <p>Attendance records in scope: {attendance.data?.length ?? 0}</p>
      </article>
      <article className="panel">
        <h3>Upcoming Assignments</h3>
        <ul>
          {(assignments.data ?? []).slice(0, 4).map((assignment) => (
            <li key={assignment._id}>
              <Link to={`/subjects/${assignment.subjectId}`}>{assignment.title}</Link>
            </li>
          ))}
        </ul>
      </article>
      <article className="panel">
        <h3>Recent Announcements</h3>
        <ul>
          {(announcements.data ?? []).slice(0, 4).map((announcement) => (
            <li key={announcement._id}>
              <strong>{announcement.title}</strong>
              <p>{announcement.content}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
