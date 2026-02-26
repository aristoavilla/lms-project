import { useState } from "react";
import { useRanking, useSubjects } from "../hooks/useLmsQueries";
import type { User } from "../types";
import { canViewOverallRanking } from "../utils/rbac";

interface Props {
  user: User;
}

export function RankingPage({ user }: Props) {
  const [subjectId, setSubjectId] = useState<string>("");
  const subjects = useSubjects(user);
  const overall = useRanking(user);
  const bySubject = useRanking(user, subjectId || undefined);

  return (
    <div className="grid">
      {canViewOverallRanking(user) && (
        <article className="panel">
          <h3>Overall Ranking</h3>
          <ol>
            {(overall.data ?? []).map((item) => (
              <li key={item.studentId}>
                {item.studentName} - {item.average}
              </li>
            ))}
          </ol>
        </article>
      )}
      <article className="panel">
        <h3>Subject Ranking</h3>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          <option value="">Select subject</option>
          {(subjects.data ?? []).map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.name}
            </option>
          ))}
        </select>
        {subjectId && (
          <ol>
            {(bySubject.data ?? []).map((item) => (
              <li key={item.studentId}>
                {item.studentName} - {item.average}
              </li>
            ))}
          </ol>
        )}
      </article>
    </div>
  );
}
