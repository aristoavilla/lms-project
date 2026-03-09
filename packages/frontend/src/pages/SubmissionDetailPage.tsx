import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSubmissionDetail, gradeSubmission } from "../services/lmsService";
import type { User } from "../types";

interface Props {
  user: User;
}

export function SubmissionDetailPage({ user }: Props) {
  const { submissionId } = useParams();
  const queryClient = useQueryClient();
  const [scoreInput, setScoreInput] = useState("80");
  const [commentInput, setCommentInput] = useState("Reviewed. Good effort.");

  const detail = useQuery({
    queryKey: ["submission-detail", submissionId, user._id],
    queryFn: () => getSubmissionDetail(user, submissionId ?? ""),
    enabled: Boolean(submissionId),
  });

  const grade = useMutation({
    mutationFn: (variables: { score: number; comment: string }) =>
      gradeSubmission(user, submissionId ?? "", variables.score, variables.comment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["submission-detail", submissionId, user._id] });
      await queryClient.invalidateQueries({ queryKey: ["assignments", user._id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-submissions"] });
    },
  });

  if (!submissionId) {
    return <p>Submission not found.</p>;
  }

  if (detail.isLoading) {
    return <p>Loading submission...</p>;
  }

  if (detail.isError || !detail.data) {
    return <p>Unable to load submission detail.</p>;
  }

  const { submission, assignment, student } = detail.data;
  const canGrade = user.role === "main_teacher" || user.role === "specialized_teacher";

  return (
    <div className="page">
      <div className="page-header">
        <h1>Student Submission</h1>
        <p>Review student work details</p>
      </div>

      <article className="panel">
        <h2>{assignment.title}</h2>
        <p className="muted-line">
          Class {assignment.classId.replace("class-", "")} | Student: {student.name}
        </p>
        <p>Submitted At: {new Date(submission.submittedAt).toLocaleString()}</p>
        <p>
          Status:{" "}
          <span className={`badge ${submission.late ? "danger" : "subtle"}`}>
            {submission.late ? "Late" : "On time"}
          </span>
        </p>
        <p>Submission Type: {submission.submissionType}</p>
        <p>Payload: {submission.payload}</p>
        <p>
          Score:{" "}
          {typeof submission.score === "number" ? (
            <span className="badge success">{submission.score}%</span>
          ) : (
            <span className="badge warning">Not graded</span>
          )}
        </p>
        <p>Teacher Comment: {submission.comment ?? "-"}</p>
      </article>

      {canGrade && (
        <article className="panel">
          <h3>Grade Submission</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              grade.mutate({ score: Number(scoreInput), comment: commentInput.trim() });
            }}
          >
            <div className="two-inputs">
              <input
                type="number"
                min={0}
                max={100}
                value={scoreInput}
                onChange={(event) => setScoreInput(event.target.value)}
                required
              />
              <input
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="Teacher feedback"
                required
              />
            </div>
            <div className="row-end">
              <button type="submit" disabled={grade.isPending}>
                {grade.isPending ? "Saving..." : "Save Grade"}
              </button>
            </div>
            {grade.isError && <p className="status-absent">{grade.error.message}</p>}
            {grade.isSuccess && <p className="status-present">Grade saved.</p>}
          </form>
        </article>
      )}

      <article className="panel">
        <Link to="/assignments">Back to assignments</Link>
      </article>
    </div>
  );
}
