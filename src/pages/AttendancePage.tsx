import { useMemo, useState } from "react";
import { useAttendance, useMarkAttendance, useSubjects, useUsers } from "../hooks/useLmsQueries";
import type { AttendanceStatus, User } from "../types";

interface Props {
  user: User;
}

export function AttendancePage({ user }: Props) {
  const attendance = useAttendance(user);
  const subjects = useSubjects(user);
  const users = useUsers();
  const mark = useMarkAttendance(user);

  const isTeacher = user.role === "main_teacher" || user.role === "specialized_teacher";
  const isMainTeacher = user.role === "main_teacher";
  const ownSubjects = (subjects.data ?? []).filter((subject) => subject.teacherId === user._id);
  const [mode, setMode] = useState<"main_class" | "subject">("main_class");
  const [subjectId, setSubjectId] = useState<string>(ownSubjects[0]?._id ?? "");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [draftStatus, setDraftStatus] = useState<Record<string, AttendanceStatus>>({});

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

  const classStudentIds = classStudents.map((student) => student._id);
  const classAttendance = (attendance.data ?? []).filter((record) =>
    classStudentIds.includes(record.studentId),
  );

  const overallPercentage = useMemo(() => {
    if (classAttendance.length === 0) {
      return 0;
    }
    const presentCount = classAttendance.filter((record) => record.status === "Present").length;
    return Math.round((presentCount / classAttendance.length) * 100);
  }, [classAttendance]);

  const perStudentPercentage = useMemo(
    () =>
      classStudents.map((student) => {
        const records = classAttendance.filter((record) => record.studentId === student._id);
        const presentCount = records.filter((record) => record.status === "Present").length;
        const percentage = records.length === 0 ? 0 : Math.round((presentCount / records.length) * 100);
        return { student, percentage, total: records.length };
      }),
    [classAttendance, classStudents],
  );

  const selectedSubjectId = subjectId || ownSubjects[0]?._id || "";
  const existingByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    (attendance.data ?? [])
      .filter((record) => record.subjectId === selectedSubjectId && record.date === date)
      .forEach((record) => map.set(record.studentId, record.status));
    return map;
  }, [attendance.data, date, selectedSubjectId]);

  const saveAttendance = async () => {
    await Promise.all(
      classStudents.map(async (student) => {
        const status = draftStatus[student._id] ?? existingByStudent.get(student._id);
        if (!status || !selectedSubjectId) {
          return;
        }
        await mark.mutateAsync({
          subjectId: selectedSubjectId,
          studentId: student._id,
          date,
          status,
        });
      }),
    );
  };

  if (!isTeacher) {
    const records = attendance.data ?? [];
    const present = records.filter((record) => record.status === "Present").length;
    const absent = records.filter((record) => record.status === "Absent").length;
    const excused = records.filter((record) => record.status === "Excused").length;
    const attendanceRate =
      records.length === 0 ? 0 : ((present / records.length) * 100).toFixed(1);
    const subjectMap = new Map((subjects.data ?? []).map((subject) => [subject._id, subject.name]));
    return (
      <div className="page">
        <div className="page-header">
          <h1>My Attendance</h1>
          <p>View your attendance record</p>
        </div>
        <div className="stat-grid">
          <article className="stat-card">
            <h3>Attendance Rate</h3>
            <strong>{attendanceRate}%</strong>
          </article>
          <article className="stat-card">
            <h3>Present</h3>
            <strong className="status-present">{present}</strong>
          </article>
          <article className="stat-card">
            <h3>Late</h3>
            <strong className="status-late">0</strong>
          </article>
          <article className="stat-card">
            <h3>Absent</h3>
            <strong className="status-absent">{absent}</strong>
          </article>
          <article className="stat-card">
            <h3>Excused</h3>
            <strong className="status-excused">{excused}</strong>
          </article>
        </div>
        <article className="panel">
          <h2>Attendance History</h2>
          <p>Your attendance records by date</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records
                .slice()
                .sort((a, b) => +new Date(b.date) - +new Date(a.date))
                .map((record) => (
                <tr key={record._id}>
                  <td>{record.date}</td>
                  <td>{subjectMap.get(record.subjectId) ?? record.subjectId}</td>
                  <td>
                    <span className={`badge ${
                      record.status === "Present"
                        ? "present"
                        : record.status === "Absent"
                          ? "absent"
                          : "excused"
                    }`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Mark and manage student attendance</p>
      </div>

      {isMainTeacher && (
        <div className="pill-nav">
          <button
            type="button"
            className={mode === "main_class" ? "active" : ""}
            onClick={() => setMode("main_class")}
          >
            Main Class Attendance
          </button>
          <button
            type="button"
            className={mode === "subject" ? "active" : ""}
            onClick={() => setMode("subject")}
          >
            Subject Attendance
          </button>
        </div>
      )}

      {(mode === "subject" || !isMainTeacher) && (
        <article className="panel">
          <div className="row-between">
            <div>
              <h2>Mark Attendance</h2>
              <p>Select attendance status for each student</p>
            </div>
            <div className="row-end">
              <select value={selectedSubjectId} onChange={(event) => setSubjectId(event.target.value)}>
                {ownSubjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <button type="button" onClick={saveAttendance}>
                Save Attendance
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((student) => {
                const status = draftStatus[student._id] ?? existingByStudent.get(student._id);
                return (
                  <tr key={student._id}>
                    <td>{student.name}</td>
                    <td>{status ?? "Not Marked"}</td>
                    <td className="button-row">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftStatus((prev) => ({ ...prev, [student._id]: "Present" }))
                        }
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftStatus((prev) => ({ ...prev, [student._id]: "Absent" }))
                        }
                      >
                        Absent
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftStatus((prev) => ({ ...prev, [student._id]: "Excused" }))
                        }
                      >
                        Excused
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      )}

      {isMainTeacher && mode === "main_class" && (
        <article className="panel">
          <h2>Main Class Attendance Summary</h2>
          <p>Overall class attendance: {overallPercentage}%</p>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Attendance %</th>
                <th>Total Records</th>
              </tr>
            </thead>
            <tbody>
              {perStudentPercentage.map((item) => (
                <tr key={item.student._id}>
                  <td>{item.student.name}</td>
                  <td>{item.percentage}%</td>
                  <td>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </div>
  );
}
