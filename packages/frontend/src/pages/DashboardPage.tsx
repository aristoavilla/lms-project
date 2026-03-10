import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { batches, superAdminClasses } from "../data/superAdminCatalog";
import {
  useAnnouncements,
  useAssignments,
  useAttendance,
  useSubjects,
  useUsers,
} from "../hooks/useLmsQueries";
import { listMyVisibleSubmissions } from "../services/lmsService";
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
  const isSuperAdmin = user.role === "super_admin";
  const taughtClassIds = user.taughtClassIds ?? [user.classId];

  const visibleAssignments = useMemo(() => {
    if (!isTeacher) {
      return assignmentItems;
    }
    return assignmentItems.filter((assignment) => taughtClassIds.includes(assignment.classId));
  }, [assignmentItems, isTeacher, taughtClassIds]);

  const submissionAssignmentKey = useMemo(
    () => visibleAssignments.map((assignment) => assignment._id).sort().join(","),
    [visibleAssignments],
  );

  const submissionRows = useQuery({
    queryKey: ["dashboard-submissions", submissionAssignmentKey],
    queryFn: () => listMyVisibleSubmissions(visibleAssignments.map((assignment) => assignment._id)),
    enabled: visibleAssignments.length > 0,
  });

  const dashboardError =
    assignments.error ??
    announcements.error ??
    attendance.error ??
    users.error ??
    subjects.error ??
    submissionRows.error;

  if (dashboardError) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, {user.name}</p>
        </div>
        <article className="panel">
          <p className="error-text">
            {dashboardError instanceof Error
              ? dashboardError.message
              : "Failed to load dashboard data from backend."}
          </p>
        </article>
      </div>
    );
  }

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

  const superAdminInsights = useMemo(() => {
    if (!isSuperAdmin) {
      return null;
    }

    const allUsers = users.data ?? [];
    const allAttendance = attendance.data ?? [];
    const allSubmissions = submissionRows.data ?? [];
    const classMetaById = new Map(superAdminClasses.map((classItem) => [classItem.id, classItem]));
    const usersById = new Map(allUsers.map((candidate) => [candidate._id, candidate]));
    const assignmentsById = new Map(assignmentItems.map((assignment) => [assignment._id, assignment]));
    const studentUsers = allUsers.filter(
      (candidate) =>
        candidate.role === "regular_student" || candidate.role === "administrative_student",
    );
    const studentIds = new Set(studentUsers.map((candidate) => candidate._id));
    const relevantAttendance = allAttendance.filter((row) => studentIds.has(row.studentId));
    const presentCount = relevantAttendance.filter((row) => row.status === "Present").length;
    const attendanceRate =
      relevantAttendance.length === 0 ? 0 : Math.round((presentCount / relevantAttendance.length) * 100);

    const batchAcc = new Map<
      string,
      {
        scoreSum: number;
        scoreCount: number;
        classAcc: Map<string, { scoreSum: number; scoreCount: number }>;
        studentAcc: Map<string, { scoreSum: number; scoreCount: number }>;
      }
    >();

    allSubmissions.forEach((submission) => {
      if (typeof submission.score !== "number") {
        return;
      }
      const assignment = assignmentsById.get(submission.assignmentId);
      if (!assignment) {
        return;
      }
      const classMeta = classMetaById.get(assignment.classId);
      if (!classMeta) {
        return;
      }

      const batchKey = classMeta.batch;
      const score = submission.score;
      const currentBatch = batchAcc.get(batchKey) ?? {
        scoreSum: 0,
        scoreCount: 0,
        classAcc: new Map<string, { scoreSum: number; scoreCount: number }>(),
        studentAcc: new Map<string, { scoreSum: number; scoreCount: number }>(),
      };

      currentBatch.scoreSum += score;
      currentBatch.scoreCount += 1;

      const currentClass = currentBatch.classAcc.get(assignment.classId) ?? {
        scoreSum: 0,
        scoreCount: 0,
      };
      currentClass.scoreSum += score;
      currentClass.scoreCount += 1;
      currentBatch.classAcc.set(assignment.classId, currentClass);

      const student = usersById.get(submission.studentId);
      if (student && classMetaById.get(student.classId)?.batch === batchKey) {
        const currentStudent = currentBatch.studentAcc.get(student._id) ?? {
          scoreSum: 0,
          scoreCount: 0,
        };
        currentStudent.scoreSum += score;
        currentStudent.scoreCount += 1;
        currentBatch.studentAcc.set(student._id, currentStudent);
      }

      batchAcc.set(batchKey, currentBatch);
    });

    const batchSummaries = batches.map((batch) => {
      const currentBatch = batchAcc.get(batch);
      const averageScore =
        !currentBatch || currentBatch.scoreCount === 0
          ? 0
          : Math.round(currentBatch.scoreSum / currentBatch.scoreCount);

      const topClass = !currentBatch
        ? null
        : Array.from(currentBatch.classAcc.entries()).reduce<{
            classId: string;
            avg: number;
          } | null>((best, [classId, values]) => {
            if (values.scoreCount === 0) {
              return best;
            }
            const avg = values.scoreSum / values.scoreCount;
            if (!best || avg > best.avg) {
              return { classId, avg };
            }
            return best;
          }, null);

      const topStudent = !currentBatch
        ? null
        : Array.from(currentBatch.studentAcc.entries()).reduce<{
            studentId: string;
            avg: number;
          } | null>((best, [studentId, values]) => {
            if (values.scoreCount === 0) {
              return best;
            }
            const avg = values.scoreSum / values.scoreCount;
            if (!best || avg > best.avg) {
              return { studentId, avg };
            }
            return best;
          }, null);

      return {
        batch,
        averageScore,
        topClass: topClass
          ? {
              label: classMetaById.get(topClass.classId)?.label ?? topClass.classId,
              average: Math.round(topClass.avg),
            }
          : null,
        topStudent: topStudent
          ? {
              name: usersById.get(topStudent.studentId)?.name ?? topStudent.studentId,
              average: Math.round(topStudent.avg),
            }
          : null,
      };
    });

    const recentAnnouncements = announcementItems.slice(0, 8).map((announcement) => ({
      ...announcement,
      classLabel: classMetaById.get(announcement.classId)?.label ?? announcement.classId,
    }));

    return {
      totalStudents: studentUsers.length,
      attendanceRate,
      totalAnnouncements: announcementItems.length,
      batchSummaries,
      recentAnnouncements,
    };
  }, [
    isSuperAdmin,
    users.data,
    attendance.data,
    submissionRows.data,
    assignmentItems,
    announcementItems,
  ]);

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
        <p>Welcome back, {isSuperAdmin ? "Principal Anderson" : user.name}</p>
      </div>
      {isSuperAdmin && superAdminInsights ? (
        <>
          <div className="stat-grid">
            <Link className="stat-card clickable" to="/admin?tab=students">
              <h3>Total Students</h3>
              <strong>{superAdminInsights.totalStudents}</strong>
            </Link>
            <Link className="stat-card clickable" to="/attendance">
              <h3>Attendance Rate</h3>
              <strong>{superAdminInsights.attendanceRate}%</strong>
            </Link>
            <Link className="stat-card clickable" to="/admin?tab=classes">
              <h3>Total Classes</h3>
              <strong>{superAdminClasses.length}</strong>
            </Link>
            <Link className="stat-card clickable" to="/announcements">
              <h3>Announcements</h3>
              <strong>{superAdminInsights.totalAnnouncements}</strong>
            </Link>
          </div>

          <div className="two-col">
            <article className="panel">
              <h2>Batch Performance Summary</h2>
              <p>Average score, highest scoring class, and top student in each batch.</p>
              <table>
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Average Score</th>
                    <th>Highest Scoring Class</th>
                    <th>Highest Scoring Student</th>
                  </tr>
                </thead>
                <tbody>
                  {superAdminInsights.batchSummaries.map((summary) => (
                    <tr key={summary.batch}>
                      <td>{summary.batch}</td>
                      <td>{summary.averageScore}%</td>
                      <td>
                        {summary.topClass
                          ? `${summary.topClass.label} (${summary.topClass.average}%)`
                          : "-"}
                      </td>
                      <td>
                        {summary.topStudent
                          ? `${summary.topStudent.name} (${summary.topStudent.average}%)`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="panel">
              <h2>Recent Announcements</h2>
              <p>Latest school-wide updates across all classes.</p>
              <div className="stack-list">
                {superAdminInsights.recentAnnouncements.map((announcement) => (
                  <article key={announcement._id} className="item-card">
                    <div className="row-between">
                      <strong>{announcement.title}</strong>
                      <span className="badge subtle">{announcement.classLabel}</span>
                    </div>
                    <p>{announcement.content}</p>
                    <small>{new Date(announcement.createdAt).toLocaleString()}</small>
                  </article>
                ))}
              </div>
            </article>
          </div>
        </>
      ) : (
        <div className="stat-grid">
          <Link className="stat-card clickable" to="/admin?tab=classes">
            <h3>Total Classes</h3>
            <strong>1</strong>
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
      )}
    </div>
  );
}
