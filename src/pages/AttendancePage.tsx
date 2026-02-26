import { useState } from "react";
import { useAttendance, useMarkAttendance, useSubjects, useUsers } from "../hooks/useLmsQueries";
import type { User } from "../types";
import { isTeacher } from "../utils/rbac";

interface Props {
  user: User;
}

export function AttendancePage({ user }: Props) {
  const attendance = useAttendance(user);
  const subjects = useSubjects(user);
  const users = useUsers();
  const mark = useMarkAttendance(user);

  const [subjectId, setSubjectId] = useState("sub-math");
  const [studentId, setStudentId] = useState("u-student-1");
  const [status, setStatus] = useState<"Present" | "Absent" | "Excused">("Present");

  return (
    <div className="grid">
      <article className="panel">
        <h2>{isTeacher(user) ? "Mark Attendance" : "My Attendance"}</h2>
        {isTeacher(user) && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mark.mutate({
                subjectId,
                studentId,
                date: new Date().toISOString().slice(0, 10),
                status,
              });
            }}
          >
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {(subjects.data ?? []).map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {(users.data ?? [])
                .filter(
                  (candidate) =>
                    candidate.classId === user.classId &&
                    (candidate.role === "regular_student" ||
                      candidate.role === "administrative_student"),
                )
                .map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.name}
                  </option>
                ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Excused">Excused</option>
            </select>
            <button type="submit">Save</button>
          </form>
        )}
      </article>
      <article className="panel">
        <h3>Attendance Records</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject</th>
              <th>Student</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(attendance.data ?? []).map((record) => (
              <tr key={record._id}>
                <td>{record.date}</td>
                <td>{record.subjectId}</td>
                <td>{record.studentId}</td>
                <td>{record.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
