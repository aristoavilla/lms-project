import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  useAssignments,
  useCreateAssignment,
  useSubmitAssignment,
  useSubjects,
  useUsers,
} from "../hooks/useLmsQueries";
import { listSubmissionsForAssignment } from "../services/lmsService";
import type { Submission, User } from "../types";

interface Props {
  user: User;
}

type StudentTab = "focus" | "pending" | "graded" | "archived";

export function AssignmentsPage({ user }: Props) {
  const assignments = useAssignments(user);
  const subjects = useSubjects(user);
  const users = useUsers();
  const createAssignment = useCreateAssignment(user);
  const submitAssignment = useSubmitAssignment(user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [showCreate, setShowCreate] = useState(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [totalScore, setTotalScore] = useState(100);
  const [studentPayload, setStudentPayload] = useState("");
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [tableFlash, setTableFlash] = useState(false);

  const isTeacher = user.role === "main_teacher" || user.role === "specialized_teacher";
  const isStudent = user.role === "regular_student" || user.role === "administrative_student";
  const canCreate = isTeacher;
  const taughtClassIds = user.taughtClassIds ?? [user.classId];
  const ownSubjectIds = user.subjectId ? [user.subjectId] : [];

  const visibleAssignments = useMemo(() => {
    const all = assignments.data ?? [];
    if (!isTeacher) {
      return all;
    }
    return all.filter(
      (assignment) =>
        ownSubjectIds.includes(assignment.subjectId) || assignment.createdBy === user._id,
    );
  }, [assignments.data, isTeacher, ownSubjectIds, user._id]);

  const assignmentSubmissionData = useQuery({
    queryKey: [
      "assignment-submissions-many",
      visibleAssignments.map((assignment) => assignment._id).join(","),
    ],
    queryFn: async () => {
      const rows = await Promise.all(
        visibleAssignments.map(async (assignment) => {
          const submissionRows = await listSubmissionsForAssignment(assignment._id);
          return { assignmentId: assignment._id, submissions: submissionRows };
        }),
      );
      return rows;
    },
    enabled: visibleAssignments.length > 0,
  });

  const submissionsByAssignment = useMemo(() => {
    const map = new Map<string, Submission[]>();
    (assignmentSubmissionData.data ?? []).forEach((row) => {
      map.set(row.assignmentId, row.submissions);
    });
    return map;
  }, [assignmentSubmissionData.data]);

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((subject) => [subject._id, subject])),
    [subjects.data],
  );
  const userMap = useMemo(
    () => new Map((users.data ?? []).map((candidate) => [candidate._id, candidate])),
    [users.data],
  );

  const teacherAssignments = useMemo(() => {
    return visibleAssignments.filter(
      (assignment) => classFilter === "all" || assignment.classId === classFilter,
    );
  }, [visibleAssignments, classFilter]);

  const currentStudentTab = (searchParams.get("tab") as StudentTab | null) ?? "focus";
  const safeStudentTab: StudentTab = ["focus", "pending", "graded", "archived"].includes(
    currentStudentTab,
  )
    ? currentStudentTab
    : "focus";

  const studentAssignments = useMemo(() => {
    const sorted = [...visibleAssignments].sort(
      (a, b) => +new Date(a.deadline) - +new Date(b.deadline),
    );
    return sorted.filter((assignment) => {
      const mine =
        (submissionsByAssignment.get(assignment._id) ?? []).find(
          (submission) => submission.studentId === user._id,
        ) ?? null;
      if (safeStudentTab === "focus") {
        return !mine;
      }
      if (safeStudentTab === "pending") {
        return Boolean(mine) && typeof mine?.score !== "number";
      }
      if (safeStudentTab === "graded") {
        return Boolean(mine) && typeof mine?.score === "number" && !archivedIds.includes(assignment._id);
      }
      return Boolean(mine) && typeof mine?.score === "number" && archivedIds.includes(assignment._id);
    });
  }, [visibleAssignments, safeStudentTab, submissionsByAssignment, user._id, archivedIds]);

  const activeAssignment = isTeacher
    ? teacherAssignments.find((item) => item._id === activeAssignmentId) ??
      teacherAssignments[0] ??
      null
    : studentAssignments.find((item) => item._id === activeAssignmentId) ??
      studentAssignments[0] ??
      null;

  const activeSubmission =
    activeAssignment &&
    (submissionsByAssignment.get(activeAssignment._id) ?? []).find(
      (submission) => submission.studentId === user._id,
    );

  if (assignments.isLoading) {
    return <p>Loading assignments...</p>;
  }

  if (isStudent) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Assignments</h1>
          <p>View and manage course assignments</p>
        </div>

        <div className="pill-nav">
          <button
            type="button"
            className={safeStudentTab === "focus" ? "active" : ""}
            onClick={() => setSearchParams({ tab: "focus" })}
          >
            To Do
          </button>
          <button
            type="button"
            className={safeStudentTab === "pending" ? "active" : ""}
            onClick={() => setSearchParams({ tab: "pending" })}
          >
            Pending
          </button>
          <button
            type="button"
            className={safeStudentTab === "graded" ? "active" : ""}
            onClick={() => setSearchParams({ tab: "graded" })}
          >
            Graded
          </button>
          <button
            type="button"
            className={safeStudentTab === "archived" ? "active" : ""}
            onClick={() => setSearchParams({ tab: "archived" })}
          >
            Archived
          </button>
        </div>

        <article className="panel">
          <div className="stack-list">
            {studentAssignments.map((assignment) => {
              const mine =
                (submissionsByAssignment.get(assignment._id) ?? []).find(
                  (submission) => submission.studentId === user._id,
                ) ?? null;
              return (
                <button
                  key={assignment._id}
                  type="button"
                  className={`item-card text-left ${
                    activeAssignment?._id === assignment._id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setActiveAssignmentId(assignment._id);
                    if (mine && typeof mine.score === "number") {
                      setArchivedIds((prev) =>
                        prev.includes(assignment._id) ? prev : [...prev, assignment._id],
                      );
                    }
                  }}
                >
                  <div className="row-between">
                    <strong>{assignment.title}</strong>
                    {typeof mine?.score === "number" && (
                      <span className="badge dark">Graded: {mine.score}%</span>
                    )}
                  </div>
                  <p>{assignment.description}</p>
                  <small>
                    Class: {assignment.classId.replace("class-", "")} |{" "}
                    Due: {new Date(assignment.deadline).toLocaleDateString()} | Max Score:{" "}
                    {assignment.totalScore}
                  </small>
                </button>
              );
            })}
            {studentAssignments.length === 0 && (
              <p>
                No assignments in this section. Switch tabs or wait for your teacher to publish
                new work.
              </p>
            )}
          </div>
        </article>

        {activeAssignment && (
          <article className="panel">
            <h2>Assignment Detail</h2>
            <p className="muted-line">Selected assignment details are shown below.</p>
            <p>
              <strong>{activeAssignment.title}</strong>
            </p>
            <p>{activeAssignment.description}</p>
            <p>
              Subject: {subjectMap.get(activeAssignment.subjectId)?.name ?? activeAssignment.subjectId}
            </p>
            <p>
              Teacher:{" "}
              {userMap.get(activeAssignment.createdBy)?.name ??
                activeAssignment.createdBy ??
                "-"}
            </p>
            <p>Deadline: {new Date(activeAssignment.deadline).toLocaleString()}</p>
            <p>Instructions/Material: {activeAssignment.description}</p>
            <p>My Submission: {activeSubmission?.payload ?? "No submission yet."}</p>
            <p>My Grade: {typeof activeSubmission?.score === "number" ? `${activeSubmission.score}%` : "Not graded yet"}</p>
            <p>Teacher Comment: {activeSubmission?.comment ?? "-"}</p>

            {!activeSubmission && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitAssignment.mutate({
                    assignmentId: activeAssignment._id,
                    payload: studentPayload,
                    submissionType: activeAssignment.assignmentType,
                  });
                  setStudentPayload("");
                }}
              >
                <textarea
                  value={studentPayload}
                  onChange={(event) => setStudentPayload(event.target.value)}
                  placeholder="Write your answer or attach file reference"
                  required
                />
                <button type="submit">Submit Assignment</button>
              </form>
            )}
          </article>
        )}

        {!activeAssignment && (
          <article className="panel">
            <p>Select an assignment from the list to view details and submission table.</p>
          </article>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header row-between">
        <div>
          <h1>Assignments</h1>
          <p>View and manage course assignments</p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setShowCreate(true)}>
            Create Assignment
          </button>
        )}
      </div>

      <div className="pill-nav">
        <button
          type="button"
          className={classFilter === "all" ? "active" : ""}
          onClick={() => setClassFilter("all")}
        >
          All My Classes
        </button>
        {taughtClassIds.map((classId) => (
            <button
              key={classId}
              type="button"
              className={classFilter === classId ? "active" : ""}
              onClick={() => setClassFilter(classId)}
            >
              {classId.replace("class-", "Class ")}
            </button>
          ))}
      </div>

      <article className="panel">
        <div className="stack-list">
          {teacherAssignments.map((assignment) => (
            <article key={assignment._id} className="item-card">
              <div className="row-between">
                <div>
                  <h3>{assignment.title}</h3>
                  <p>{assignment.description}</p>
                  <small>
                    Due: {new Date(assignment.deadline).toLocaleDateString()} | Max Score:{" "}
                    {assignment.totalScore}
                  </small>
                </div>
                <button
                  type="button"
                  className="view-submissions-button"
                  onClick={() => {
                    setActiveAssignmentId(assignment._id);
                    setTableFlash(true);
                    window.setTimeout(() => setTableFlash(false), 320);
                  }}
                >
                  View Submissions
                </button>
              </div>
            </article>
          ))}
          {teacherAssignments.length === 0 && <p>No assignments available.</p>}
        </div>
      </article>

      {activeAssignment && (
        <article className={`panel ${tableFlash ? "table-flash" : ""}`}>
          <h2>{activeAssignment.title} Submissions</h2>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Submission</th>
                <th>Grade</th>
                <th>Teacher Comment</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(submissionsByAssignment.get(activeAssignment._id) ?? []).map((submission) => (
                <tr key={submission._id}>
                  <td>{userMap.get(submission.studentId)?.name ?? submission.studentId}</td>
                  <td>{submission.payload}</td>
                  <td>{typeof submission.score === "number" ? `${submission.score}%` : "-"}</td>
                  <td>{submission.comment || "-"}</td>
                  <td>{submission.late ? "Late" : "On time"}</td>
                  <td>
                    <Link to={`/submissions/${submission._id}`}>View Work</Link>
                  </td>
                </tr>
              ))}
              {(submissionsByAssignment.get(activeAssignment._id) ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>No submissions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      )}

      {showCreate && (
        <div className="modal-backdrop">
          <article className="modal">
            <div className="row-between">
              <h3>Create New Assignment</h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                X
              </button>
            </div>
            <p>Add a new assignment for your students</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createAssignment.mutate(
                  {
                    title,
                    description,
                    subjectId,
                    classId,
                    deadline: new Date(deadline).toISOString(),
                    totalScore,
                  },
                  {
                    onSuccess: () => {
                      setShowCreate(false);
                      setTitle("");
                      setDescription("");
                      setSubjectId("");
                      setClassId("");
                      setDeadline("");
                      setTotalScore(100);
                    },
                  },
                );
              }}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Assignment title"
                required
              />
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                required
              >
                <option value="">Select a subject</option>
                {(subjects.data ?? [])
                  .filter((subject) => ownSubjectIds.includes(subject._id))
                  .map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.name}
                    </option>
                  ))}
              </select>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                required
              >
                <option value="">Select a class</option>
                {taughtClassIds.map((classIdOption) => (
                  <option key={classIdOption} value={classIdOption}>
                    {classIdOption.replace("class-", "Class ")}
                  </option>
                ))}
              </select>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Assignment description and instructions"
                required
              />
              <div className="two-inputs">
                <input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  required
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={totalScore}
                  onChange={(event) => setTotalScore(Number(event.target.value))}
                  required
                />
              </div>
              <div className="row-end">
                <button type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit">Create</button>
              </div>
            </form>
          </article>
        </div>
      )}
    </div>
  );
}
