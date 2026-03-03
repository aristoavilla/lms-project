import { useMemo, useState } from "react";
import { useAttendance, useMarkAttendance, useSubjects, useUsers } from "../hooks/useLmsQueries";
import type { AttendanceStatus, User } from "../types";

interface Props {
  user: User;
}

function shiftDate(value: string, offset: number) {
  const base = new Date(`${value}T00:00:00`);
  base.setDate(base.getDate() + offset);
  return base.toISOString().slice(0, 10);
}

export function AttendancePage({ user }: Props) {
  const attendance = useAttendance(user);
  const subjects = useSubjects(user);
  const users = useUsers();
  const mark = useMarkAttendance(user);

  const isTeacher = user.role === "main_teacher" || user.role === "specialized_teacher";
  const isMainTeacher = user.role === "main_teacher";
  const taughtClassIds = user.taughtClassIds ?? [user.classId];
  const [mode, setMode] = useState<"main_class" | "subject">("main_class");
  const [selectedClassId, setSelectedClassId] = useState<string>(taughtClassIds[0] ?? user.classId);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [draftStatus, setDraftStatus] = useState<Record<string, AttendanceStatus>>({});
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [saveError, setSaveError] = useState<string>("");
  const subjectName =
    (subjects.data ?? []).find((subject) => subject._id === user.subjectId)?.name ?? "Subject";

  const selectedStudents = useMemo(
    () =>
      (users.data ?? []).filter(
        (candidate) =>
          candidate.classId === selectedClassId &&
          (candidate.role === "regular_student" || candidate.role === "administrative_student"),
      ),
    [users.data, selectedClassId],
  );

  const classStudents = useMemo(
    () =>
      (users.data ?? []).filter(
        (candidate) =>
          candidate.classId === user.classId &&
          (candidate.role === "regular_student" || candidate.role === "administrative_student"),
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

  const existingByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    (attendance.data ?? [])
      .filter(
        (record) =>
          record.subjectId === user.subjectId &&
          record.classId === selectedClassId &&
          record.date === date,
      )
      .forEach((record) => map.set(record.studentId, record.status));
    return map;
  }, [attendance.data, date, selectedClassId, user.subjectId]);

  const saveAttendance = async () => {
    if (!user.subjectId) {
      setSaveError("Teacher subject is missing.");
      return;
    }
    const hasMissing = selectedStudents.some(
      (student) => !draftStatus[student._id] && !existingByStudent.get(student._id),
    );
    if (hasMissing) {
      setSaveError("Set attendance status for every student before saving.");
      return;
    }
    setSaveError("");
    await Promise.all(
      selectedStudents.map(async (student) => {
        const status = draftStatus[student._id] ?? existingByStudent.get(student._id);
        if (!status) {
          return;
        }
        await mark.mutateAsync({
          subjectId: user.subjectId!,
          classId: selectedClassId,
          studentId: student._id,
          date,
          status,
        });
      }),
    );
    setSaveMessage(`Saved at ${new Date().toLocaleTimeString()}. You can still revise and save again.`);
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
              <h2>Mark {subjectName} Attendance</h2>
              <p>Select class, date, and status for each student</p>
            </div>
            <div className="row-end">
              <div className="pill-nav secondary">
                {taughtClassIds.map((classId) => (
                  <button
                    key={classId}
                    type="button"
                    className={classId === selectedClassId ? "active" : ""}
                    onClick={() => {
                      setSelectedClassId(classId);
                      setDraftStatus({});
                      setSaveMessage("");
                      setSaveError("");
                    }}
                  >
                    {classId.replace("class-", "Class ")}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setDate(shiftDate(date, -1))}>
                {"<"}
              </button>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <button type="button" onClick={() => setDate(shiftDate(date, 1))}>
                {">"}
              </button>
              <button type="button" onClick={saveAttendance}>
                Save Attendance
              </button>
            </div>
          </div>

          {saveError && <p className="status-absent">{saveError}</p>}
          {saveMessage && <p className="status-present">{saveMessage}</p>}

          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedStudents.map((student) => {
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
