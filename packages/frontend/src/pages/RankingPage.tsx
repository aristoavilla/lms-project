import { useMemo, useState } from "react";
import {
  useBatchClassOverallRanking,
  useRanking,
  useSubjects,
  useUsers,
} from "../hooks/useLmsQueries";
import { batches, superAdminClasses } from "../data/superAdminCatalog";
import type { User } from "../types";

interface Props {
  user: User;
}

export function RankingPage({ user }: Props) {
  const [mainClassSubjectId, setMainClassSubjectId] = useState<string>("");
  const [teacherTab, setTeacherTab] = useState<"main_class" | "subject_class">("main_class");
  const [superAdminTab, setSuperAdminTab] = useState<"overall_students" | "overall_classes">(
    "overall_students",
  );
  const [activeBatch, setActiveBatch] = useState<(typeof batches)[number]>("1st");
  const [selectedClassId, setSelectedClassId] = useState<string>(user.classId);
  const subjects = useSubjects(user);
  const users = useUsers();
  const isTeacher = user.role === "main_teacher" || user.role === "specialized_teacher";
  const isMainTeacher = user.role === "main_teacher";
  const effectiveTeacherTab: "main_class" | "subject_class" =
    isMainTeacher ? teacherTab : "subject_class";
  const ownSubject = (subjects.data ?? []).find((subject) => subject._id === user.subjectId);
  const teacherClassIds = user.taughtClassIds ?? [user.classId];

  const batchClasses = useMemo(
    () => superAdminClasses.filter((item) => item.batch === activeBatch),
    [activeBatch],
  );

  const safeTeacherClassId =
    teacherClassIds.includes(selectedClassId) ? selectedClassId : teacherClassIds[0];

  const mainOverall = useRanking(user, undefined, user.classId);
  const mainBySubject = useRanking(user, mainClassSubjectId || undefined, user.classId);
  const byOwnSubjectClass = useRanking(user, user.subjectId, safeTeacherClassId);
  const batchClassOverallQueries = useBatchClassOverallRanking(
    user,
    batchClasses.map((item) => item.id),
  );
  const batchError = batchClassOverallQueries.find((query) => query.error)?.error;
  const pageError = subjects.error ?? users.error ?? mainOverall.error ?? mainBySubject.error ?? byOwnSubjectClass.error ?? batchError;

  const rankingItems = (() => {
    if (isTeacher) {
      if (effectiveTeacherTab === "main_class") {
        return mainClassSubjectId ? mainBySubject.data ?? [] : mainOverall.data ?? [];
      }
      return byOwnSubjectClass.data ?? [];
    }
    return [];
  })();

  const classStudentIds = useMemo(
    () =>
      (users.data ?? [])
        .filter(
          (candidate) =>
            candidate.classId ===
            (effectiveTeacherTab === "main_class" ? user.classId : safeTeacherClassId),
        )
        .map((candidate) => candidate._id),
    [users.data, safeTeacherClassId, effectiveTeacherTab, user.classId],
  );

  const filteredRanking = rankingItems.filter((item) => classStudentIds.includes(item.studentId));

  const batchStudentOverallRanking = useMemo(() => {
    if (isTeacher) {
      return [];
    }

    const combined = batchClasses.flatMap((classItem, index) =>
      (batchClassOverallQueries[index]?.data ?? []).map((item) => ({
        ...item,
        classId: classItem.id,
        classLabel: classItem.label,
      })),
    );

    return combined
      .sort(
        (a, b) =>
          b.average - a.average ||
          +new Date(a.earliestSubmissionAt) - +new Date(b.earliestSubmissionAt) ||
          a.studentName.localeCompare(b.studentName),
      )
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [batchClassOverallQueries, batchClasses, isTeacher]);

  const batchOverallRanking = useMemo(() => {
    if (isTeacher) {
      return [];
    }

    const byClass = batchClasses.map((classItem, index) => {
      const studentRankings = batchClassOverallQueries[index]?.data ?? [];
      const average =
        studentRankings.length === 0
          ? 0
          : Math.round(
              (studentRankings.reduce((sum, item) => sum + item.average, 0) /
                studentRankings.length) *
                100,
            ) / 100;

      return {
        classId: classItem.id,
        classLabel: classItem.label,
        average,
        studentCount: studentRankings.length,
        topStudent: studentRankings[0]?.studentName ?? "-",
      };
    });

    return byClass
      .sort((a, b) => b.average - a.average || a.classLabel.localeCompare(b.classLabel))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [batchClassOverallQueries, batchClasses, isTeacher]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Student Rankings</h1>
        <p>Academic performance rankings</p>
      </div>
      {pageError ? (
        <article className="panel">
          <p className="error-text">
            {pageError instanceof Error
              ? pageError.message
              : "Failed to load ranking data from backend."}
          </p>
        </article>
      ) : null}

      {isTeacher ? (
        <>
          {isMainTeacher && (
            <div className="pill-nav">
              <button
                type="button"
                className={effectiveTeacherTab === "main_class" ? "active" : ""}
                onClick={() => setTeacherTab("main_class")}
              >
                Main Class Rankings
              </button>
              <button
                type="button"
                className={effectiveTeacherTab === "subject_class" ? "active" : ""}
                onClick={() => setTeacherTab("subject_class")}
              >
                Your {ownSubject?.name ?? "Subject"} Classes Rankings
              </button>
            </div>
          )}

          {effectiveTeacherTab === "main_class" && (
            <>
              <h3 className="muted-line">Class {user.classId.replace("class-", "")}</h3>
              <div className="pill-nav secondary">
                <button
                  type="button"
                  className={mainClassSubjectId === "" ? "active" : ""}
                  onClick={() => setMainClassSubjectId("")}
                >
                  Overall
                </button>
                {(subjects.data ?? []).map((subject) => (
                  <button
                    key={subject._id}
                    type="button"
                    className={mainClassSubjectId === subject._id ? "active" : ""}
                    onClick={() => setMainClassSubjectId(subject._id)}
                  >
                    {subject.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {(effectiveTeacherTab === "subject_class" || !isMainTeacher) && (
            <>
              <h3 className="muted-line">
                Your {ownSubject?.name ?? "Subject"} Classes Rankings
              </h3>
              <div className="pill-nav secondary">
                {teacherClassIds.map((classId) => (
                  <button
                    key={classId}
                    type="button"
                    className={classId === safeTeacherClassId ? "active" : ""}
                    onClick={() => setSelectedClassId(classId)}
                  >
                    {classId.replace("class-", "Class ")}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="pill-nav">
            <button
              type="button"
              className={superAdminTab === "overall_students" ? "active" : ""}
              onClick={() => setSuperAdminTab("overall_students")}
            >
              Overall Students
            </button>
            <button
              type="button"
              className={superAdminTab === "overall_classes" ? "active" : ""}
              onClick={() => setSuperAdminTab("overall_classes")}
            >
              Overall Classes
            </button>
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
        </>
      )}

      <article className="panel">
        <h2>
          {isTeacher
            ? effectiveTeacherTab === "main_class"
              ? mainClassSubjectId
                ? "Main Class Subject Ranking"
                : "Main Class Overall Ranking"
              : `Your ${ownSubject?.name ?? "Subject"} Classes Rankings`
            : superAdminTab === "overall_students"
              ? `Overall Students Ranking (${activeBatch} Batch)`
              : `Overall Classes Ranking (${activeBatch} Batch)`}
        </h2>
        <table>
          <thead>
            {isTeacher || superAdminTab === "overall_students" ? (
              <tr>
                <th>Rank</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Average</th>
                <th>Performance</th>
              </tr>
            ) : (
              <tr>
                <th>Rank</th>
                <th>Class</th>
                <th>Class Average</th>
                <th>Students Ranked</th>
                <th>Top Student</th>
              </tr>
            )}
          </thead>
          <tbody>
            {isTeacher || superAdminTab === "overall_students" ? (
              isTeacher ? (
                <>
                  {filteredRanking.map((item, index) => (
                    <tr key={item.studentId}>
                      <td>{index + 1}</td>
                      <td>{item.studentName}</td>
                      <td>
                        {(effectiveTeacherTab === "main_class"
                          ? user.classId
                          : safeTeacherClassId
                        ).replace("class-", "")}
                      </td>
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
                </>
              ) : (
                <>
                  {batchStudentOverallRanking.map((item) => (
                    <tr key={item.studentId}>
                      <td>{item.rank}</td>
                      <td>{item.studentName}</td>
                      <td>{item.classLabel.replace("Class ", "")}</td>
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
                  {batchStudentOverallRanking.length === 0 && (
                    <tr>
                      <td colSpan={5}>No ranking data for this selection.</td>
                    </tr>
                  )}
                </>
              )
            ) : (
              <>
                {batchOverallRanking.map((item) => (
                  <tr key={item.classId}>
                    <td>{item.rank}</td>
                    <td>{item.classLabel}</td>
                    <td>{item.average}%</td>
                    <td>{item.studentCount}</td>
                    <td>{item.topStudent}</td>
                  </tr>
                ))}
                {batchOverallRanking.length === 0 && (
                  <tr>
                    <td colSpan={5}>No class ranking data for this batch.</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}
