import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAssignments, useSubmitAssignment, useUsers } from "../hooks/useLmsQueries";
import { gradeSubmission, listSubmissionsForAssignment } from "../services/lmsService";
import type { User } from "../types";
import { canGradeSubject } from "../utils/rbac";

interface Props {
  user: User;
}

export function SubjectDetailPage({ user }: Props) {
  const { subjectId } = useParams();
  const assignments = useAssignments(user);
  const submit = useSubmitAssignment(user);
  const queryClient = useQueryClient();
  const users = useUsers();
  const [payload, setPayload] = useState("");

  const filteredAssignments = (assignments.data ?? []).filter(
    (item) => item.subjectId === subjectId,
  );
  const current = filteredAssignments[0];

  const submissions = useQuery({
    queryKey: ["submissions", current?._id],
    queryFn: () => listSubmissionsForAssignment(current?._id ?? ""),
    enabled: Boolean(current?._id),
  });

  const grade = useMutation({
    mutationFn: (variables: { submissionId: string; score: number; comment: string }) =>
      gradeSubmission(user, variables.submissionId, variables.score, variables.comment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["submissions", current?._id] });
    },
  });

  if (!subjectId) {
    return <p>Subject not found.</p>;
  }

  return (
    <div className="grid">
      <article className="panel">
        <h2>Subject Detail: {subjectId}</h2>
        {filteredAssignments.map((assignment) => (
          <div key={assignment._id} className="item-card">
            <h3>{assignment.title}</h3>
            <p>{assignment.description}</p>
            <p>Deadline: {new Date(assignment.deadline).toLocaleString()}</p>
            {(user.role === "regular_student" || user.role === "administrative_student") && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit.mutate({
                    assignmentId: assignment._id,
                    payload,
                    submissionType: assignment.assignmentType,
                  });
                }}
              >
                <textarea
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  placeholder="Submit text/file reference/quiz answer"
                />
                <button type="submit">Submit Assignment</button>
              </form>
            )}
          </div>
        ))}
      </article>

      {current && canGradeSubject(user, current.subjectId) && (
        <article className="panel">
          <h3>Submissions and Grading</h3>
          <ul>
            {(submissions.data ?? []).map((item) => (
              <li key={item._id}>
                <strong>
                  {
                    users.data?.find((student) => student._id === item.studentId)?.name ??
                    item.studentId
                  }
                </strong>
                <span> Submitted {new Date(item.submittedAt).toLocaleString()}</span>
                <span> Score: {item.score ?? "Not graded"}</span>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    grade.mutate({
                      submissionId: item._id,
                      score: Number(data.get("score")),
                      comment: String(data.get("comment") || ""),
                    });
                    event.currentTarget.reset();
                  }}
                >
                  <input type="number" name="score" min={0} max={100} required />
                  <input type="text" name="comment" placeholder="Teacher comment" />
                  <button type="submit">Save Grade</button>
                </form>
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}
