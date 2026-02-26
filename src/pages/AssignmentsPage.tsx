import { Link } from "react-router-dom";
import { useAssignments } from "../hooks/useLmsQueries";
import type { User } from "../types";

interface Props {
  user: User;
}

export function AssignmentsPage({ user }: Props) {
  const { data, isLoading } = useAssignments(user);

  if (isLoading) {
    return <p>Loading assignments...</p>;
  }

  return (
    <div className="panel">
      <h2>Assignments by Subject</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Subject</th>
            <th>Deadline</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((assignment) => (
            <tr key={assignment._id}>
              <td>{assignment.title}</td>
              <td>
                <Link to={`/subjects/${assignment.subjectId}`}>{assignment.subjectId}</Link>
              </td>
              <td>{new Date(assignment.deadline).toLocaleString()}</td>
              <td>{assignment.allowLate ? "Late allowed" : "Strict deadline"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
