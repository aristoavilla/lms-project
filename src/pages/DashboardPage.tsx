import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { superAdminClasses } from "../data/superAdminCatalog";
import {
  useAnnouncements,
  useAssignments,
  useAttendance,
  useSubjects,
  useUsers,
} from "../hooks/useLmsQueries";
import { listSubmissionsForAssignment } from "../services/lmsService";
import type { Submission, User } from "../types";

interface Props {
  user: User;
}

export function DashboardPage({ user }: Props) {
  const assignments = useAssignments(user);
  const announcements = useAnnouncements(user);
  const attendance = useAttendance(user);
  const users = useUsers();
  const subjects = useSubjects(user);
  const [currentTime] = useState(() => Date.now());

  const assignmentItems = assignments.data ?? [];
  const announcementItems = announcements.data ?? [];
  const isTeacher = user.role === "main_teacher" || user.role === "specialized_teacher";
  const isStudent = user.role === "regular_student" || user.role === "administrative_student";
  const taughtClassIds = user.taughtClassIds ?? [user.classId];

  const visibleAssignments = useMemo(() => {
    if (!isTeacher) {
      return assignmentItems;
    }
    return assignmentItems.filter((assignment) => taughtClassIds.includes(assignment.classId));
  }, [assignmentItems, isTeacher, taughtClassIds]);

  const submissionRows = useQuery({
    queryKey: ["dashboard-submissions", visibleAssignments.map((a) => a._id).join(",")],
    queryFn: async () => {
      const groups = await Promise.all(
        visibleAssignments.map((assignment) => listSubmissionsForAssignment(assignment._id)),
      );
      return groups.flat();
    },
    enabled: visibleAssignments.length > 0,
  });

  const mySubmissions = useMemo(
    () =>
      (submissionRows.data ?? []).filter(
        (submission: Submission) => submission.studentId === user._id,
      ),
    [submissionRows.data, user._id],
  );

  const classStudents = useMemo(
    () =>
      (users.data ?? []).filter(
        (candidate) =>
          candidate.classId === user.classId &&
          (candidate.role === "regular_student" ||
            candidate.role === "administrative_student"),
      ),
    [users.data, user.classId],
  );

  const classAttendance = useMemo(
    () =>
      (attendance.data ?? []).filter((record) =>
        record.classId === user.classId &&
        classStudents.some((student) => student._id === record.studentId),
      ),
    [attendance.data, classStudents, user.classId],
  );

  const attendancePercentage = useMemo(() => {
    if (classAttendance.length === 0) {
      return 0;
    }
    const presentCount = classAttendance.filter(
      (record) => record.status === "Present",
    ).length;
    return Math.round((presentCount / classAttendance.length) * 100);
  }, [classAttendance]);

  const gradePercentage = useMemo(() => {
    const scores = (submissionRows.data ?? [])
      .map((submission: Submission) => submission.score)
      .filter((score: number | undefined): score is number => typeof score === "number");
    if (scores.length === 0) {
      return 0;
    }
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [submissionRows.data]);

  const pendingGrading = useMemo(
    () =>
      (submissionRows.data ?? []).filter(
        (submission: Submission) => typeof submission.score !== "number",
      ).length,
    [submissionRows.data],
  );

  if (isTeacher) {
    const ownedSubjectName =
      (subjects.data ?? []).find((subject) => subject._id === user.subjectId)?.name ?? "Subject";
    const taughtClassSummary = taughtClassIds.map((classId) => {
      const classAssignments = visibleAssignments.filter((assignment) => assignment.classId === classId);
      const assignmentIds = new Set(classAssignments.map((assignment) => assignment._id));
      const pending = (submissionRows.data ?? []).filter(
        (submission: Submission) =>
          assignmentIds.has(submission.assignmentId) && typeof submission.score !== "number",
      ).length;
      return { classId, upcoming: classAssignments.length, pending };
    });
    return (
      <div className="page">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, {user.name}</p>
          {user.role === "main_teacher" && (
            <small className="profile-summary">
              Class {user.classId} Main Teacher and {ownedSubjectName} Teacher
            </small>
          )}
        </div>

        <h2 className="section-title">Main Class Summary ({user.classId.replace("class-", "")})</h2>
        <div className="stat-grid">
          <Link className="stat-card clickable" to="/ranking">
            <h3>Grade Percentage</h3>
            <strong>{gradePercentage}%</strong>
          </Link>
          <Link className="stat-card clickable" to="/attendance">
            <h3>Attendance Percentage</h3>
            <strong>{attendancePercentage}%</strong>
          </Link>
          <Link className="stat-card clickable" to="/attendance">
            <h3>Students in Class</h3>
            <strong>{classStudents.length}</strong>
          </Link>
        </div>

        <hr className="section-divider" />

        <div className="two-col">
          <article className="panel">
            <h2>Taught Classes Overview</h2>
            <div className="stack-list">
              {taughtClassSummary.map((item) => (
                <article key={item.classId} className="item-card">
                  <div className="row-between">
                    <strong>{item.classId.replace("class-", "Class ")}</strong>
                    <span className="badge subtle">Subject: {ownedSubjectName}</span>
                  </div>
                  <p>Upcoming Assignments: {item.upcoming}</p>
                  <p>Pending Grading: {item.pending}</p>
                </article>
              ))}
              <article className="item-card">
                <strong>Total Pending Grading</strong>
                <p>{pendingGrading}</p>
              </article>
            </div>
          </article>

          <article className="panel">
            <h2>Recent Announcements</h2>
            <div className="stack-list">
              {announcementItems.slice(0, 4).map((announcement) => (
                <article key={announcement._id} className="item-card">
                  <strong>{announcement.title}</strong>
                  <p>{announcement.content}</p>
                  <small>{new Date(announcement.createdAt).toLocaleString()}</small>
                </article>
              ))}
            </div>
          </article>
        </div>
      </div>
    );
  }

  if (isStudent) {
    const submittedCount = mySubmissions.length;
    const gradedCount = mySubmissions.filter(
      (submission) => typeof submission.score === "number",
    ).length;
    const pendingCount = Math.max(0, assignmentItems.length - submittedCount);
    return (
      <div className="page">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, {user.name}</p>
        </div>
        <div className="stat-grid">
          <Link className="stat-card clickable" to="/assignments?tab=focus">
            <h3>Pending Submissions</h3>
            <strong>{pendingCount}</strong>
          </Link>
          <Link className="stat-card clickable" to="/assignments?tab=pending">
            <h3>Submitted</h3>
            <strong>{submittedCount}</strong>
          </Link>
          <Link className="stat-card clickable" to="/assignments?tab=graded">
            <h3>Graded</h3>
            <strong>{gradedCount}</strong>
          </Link>
        </div>

        <div className="two-col">
          <article className="panel">
            <h2>Upcoming Assignments</h2>
            <p>{pendingCount} assignment due soon</p>
            <div className="stack-list">
              {assignmentItems
                .filter(
                  (assignment) =>
                    !mySubmissions.some((submission) => submission.assignmentId === assignment._id),
                )
                .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))
                .slice(0, 3)
                .map((assignment) => (
                  <Link key={assignment._id} className="item-card card-link" to="/assignments?tab=focus">
                    <div className="row-between">
                      <strong>{assignment.title}</strong>
                      <span className="badge subtle">
                        {Math.max(
                          0,
                          Math.ceil(
                            (new Date(assignment.deadline).getTime() - currentTime) /
                              (1000 * 60 * 60 * 24),
                          ),
                        )}{" "}
                        days
                      </span>
                    </div>
                    <small>Due: {new Date(assignment.deadline).toLocaleDateString()}</small>
                  </Link>
                ))}
            </div>
            <Link className="text-link" to="/assignments">
              View all assignments
            </Link>
          </article>

          <article className="panel">
            <h2>Recent Announcements</h2>
            <p>Latest updates and news</p>
            <div className="stack-list">
              {announcementItems.slice(0, 3).map((announcement) => (
                <article key={announcement._id} className="item-card">
                  <strong>{announcement.title}</strong>
                  <p>{announcement.content}</p>
                  <small>{new Date(announcement.createdAt).toLocaleString()}</small>
                </article>
              ))}
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user.role === "super_admin" ? "Principal Anderson" : user.name}</p>
      </div>
      <div className="stat-grid">
        <Link className="stat-card clickable" to="/admin?tab=classes">
          <h3>Total Classes</h3>
          <strong>{user.role === "super_admin" ? superAdminClasses.length : 1}</strong>
        </Link>
        <Link className="stat-card clickable" to="/assignments">
          <h3>Total Assignments</h3>
          <strong>{assignmentItems.length}</strong>
        </Link>
        <Link className="stat-card clickable" to="/announcements">
          <h3>Announcements</h3>
          <strong>{announcementItems.length}</strong>
        </Link>
      </div>
    </div>
  );
}
