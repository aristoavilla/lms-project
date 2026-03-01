import { useMemo, useState } from "react";
import { useRanking, useSubjects, useUsers } from "../hooks/useLmsQueries";
import { batches, superAdminClasses } from "../data/superAdminCatalog";
import type { User } from "../types";

interface Props {
  user: User;
}

export function RankingPage({ user }: Props) {
  const [subjectId, setSubjectId] = useState<string>("");
  const [teacherTab, setTeacherTab] = useState<"main_class" | "subject_class">("main_class");
  const [activeBatch, setActiveBatch] = useState<(typeof batches)[number]>("1st");
  const [selectedClassId, setSelectedClassId] = useState<string>("class-1A");
  const subjects = useSubjects(user);
  const users = useUsers();
  const isTeacher = user.role === "main_teacher" || user.role === "specialized_teacher";
  const isMainTeacher = user.role === "main_teacher";
  const effectiveTeacherTab: "main_class" | "subject_class" =
    isMainTeacher ? teacherTab : "subject_class";

  const ownSubjects = useMemo(
    () => (subjects.data ?? []).filter((subject) => subject.teacherId === user._id),
    [subjects.data, user._id],
  );
  const safeSubjectId = subjectId || ownSubjects[0]?._id || "";

  const overall = useRanking(user);
  const bySubject = useRanking(user, safeSubjectId || undefined);

  const teacherClassIds = useMemo(() => {
    const list = ownSubjects.map((subject) => subject.classId);
    return Array.from(new Set(isMainTeacher ? [user.classId, ...list] : list));
  }, [ownSubjects, isMainTeacher, user.classId]);

  const batchClasses = useMemo(
    () => superAdminClasses.filter((item) => item.batch === activeBatch),
    [activeBatch],
  );

  const safeClassId = isTeacher
    ? (teacherClassIds.includes(selectedClassId) ? selectedClassId : teacherClassIds[0])
    : (batchClasses.some((item) => item.id === selectedClassId)
        ? selectedClassId
        : batchClasses[0]?.id);

  const rankingItems = (() => {
    if (isTeacher) {
      if (effectiveTeacherTab === "main_class") {
        return overall.data ?? [];
      }
      return bySubject.data ?? [];
    }
    return subjectId ? bySubject.data ?? [] : overall.data ?? [];
  })();

  const classStudentIds = useMemo(
    () =>
      (users.data ?? [])
        .filter((candidate) => candidate.classId === safeClassId)
        .map((candidate) => candidate._id),
    [users.data, safeClassId],
  );

  const filteredRanking = rankingItems.filter((item) =>
    classStudentIds.includes(item.studentId),
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Student Rankings</h1>
        <p>Academic performance rankings</p>
      </div>

      {isTeacher ? (
        <>
          {isMainTeacher && (
            <div className="pill-nav">
              <button
                type="button"
                className={effectiveTeacherTab === "main_class" ? "active" : ""}
                onClick={() => setTeacherTab("main_class")}
              >
                Main Class Ranking
              </button>
              <button
                type="button"
                className={effectiveTeacherTab === "subject_class" ? "active" : ""}
                onClick={() => setTeacherTab("subject_class")}
              >
                Subject Ranking by Class
              </button>
            </div>
          )}

          {(effectiveTeacherTab === "subject_class" || !isMainTeacher) && (
            <div className="pill-nav">
              {ownSubjects.map((subject) => (
                <button
                  key={subject._id}
                  type="button"
                  className={safeSubjectId === subject._id ? "active" : ""}
                  onClick={() => setSubjectId(subject._id)}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          )}

          <div className="pill-nav secondary">
            {teacherClassIds.map((classId) => (
              <button
                key={classId}
                type="button"
                className={classId === safeClassId ? "active" : ""}
                onClick={() => setSelectedClassId(classId)}
              >
                {classId}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="pill-nav">
            <button
              type="button"
              className={subjectId === "" ? "active" : ""}
              onClick={() => setSubjectId("")}
            >
              Overall Ranking
            </button>
            {(subjects.data ?? []).map((subject) => (
              <button
                key={subject._id}
                type="button"
                className={subjectId === subject._id ? "active" : ""}
                onClick={() => setSubjectId(subject._id)}
              >
                {subject.name}
              </button>
            ))}
          </div>
          <div className="pill-nav secondary">
            {batches.map((batch) => (
              <button
                key={batch}
                type="button"
                className={batch === activeBatch ? "active" : ""}
                onClick={() => setActiveBatch(batch)}
              >
                {batch} Batch
              </button>
            ))}
          </div>
          <div className="pill-nav secondary">
            {batchClasses.map((classItem) => (
              <button
                key={classItem.id}
                type="button"
                className={classItem.id === safeClassId ? "active" : ""}
                onClick={() => setSelectedClassId(classItem.id)}
              >
                {classItem.label}
              </button>
            ))}
          </div>
        </>
      )}

      <article className="panel">
        <h2>
          {isTeacher
            ? effectiveTeacherTab === "main_class"
              ? "Main Class Overall Ranking"
              : "Subject Ranking by Class"
            : subjectId
              ? "Subject Ranking"
              : "Overall School Ranking"}
        </h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Average</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {filteredRanking.map((item, index) => (
              <tr key={item.studentId}>
                <td>{index + 1}</td>
                <td>{item.studentName}</td>
                <td>{safeClassId}</td>
                <td>{item.average}%</td>
                <td>
                  {item.average >= 90
                    ? "Outstanding"
                    : item.average >= 80
                      ? "Excellent"
                      : item.average >= 70
                        ? "Good"
                        : "Needs support"}
                </td>
              </tr>
            ))}
            {filteredRanking.length === 0 && (
              <tr>
                <td colSpan={5}>No ranking data for this selection.</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}
