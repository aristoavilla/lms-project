import { useState } from "react";
import { useAdminActions, useSubjects, useUsers } from "../hooks/useLmsQueries";
import type { Role, User } from "../types";

interface Props {
  user: User;
}

const roleOptions: Role[] = [
  "regular_student",
  "administrative_student",
  "specialized_teacher",
  "main_teacher",
];

export function SuperAdminPage({ user }: Props) {
  const users = useUsers();
  const subjects = useSubjects(user);
  const actions = useAdminActions(user);
  const [subjectId, setSubjectId] = useState("sub-english");
  const [teacherId, setTeacherId] = useState("u-spec-eng");

  return (
    <div className="grid">
      <article className="panel">
        <h2>Approve and Assign Roles</h2>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Approved</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((candidate) => (
              <tr key={candidate._id}>
                <td>{candidate.name}</td>
                <td>{candidate.approved ? "Yes" : "No"}</td>
                <td>{candidate.role}</td>
                <td className="button-row">
                  {!candidate.approved && (
                    <button onClick={() => actions.approve.mutate(candidate._id)}>
                      Approve
                    </button>
                  )}
                  <select
                    defaultValue={candidate.role}
                    onChange={(event) =>
                      actions.assignRole.mutate({
                        userId: candidate._id,
                        role: event.target.value as Role,
                      })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <article className="panel">
        <h3>Assign Subject Owner</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            actions.assignSubject.mutate({ subjectId, teacherId });
          }}
        >
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {(subjects.data ?? []).map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
            {(users.data ?? [])
              .filter(
                (candidate) =>
                  candidate.role === "specialized_teacher" ||
                  candidate.role === "main_teacher",
              )
              .map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.name}
                </option>
              ))}
          </select>
          <button type="submit">Assign</button>
        </form>
      </article>
    </div>
  );
}
