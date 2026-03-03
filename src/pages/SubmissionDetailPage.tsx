import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getSubmissionDetail } from "../services/lmsService";
import type { User } from "../types";

interface Props {
  user: User;
}

export function SubmissionDetailPage({ user }: Props) {
  const { submissionId } = useParams();
  const detail = useQuery({
    queryKey: ["submission-detail", submissionId, user._id],
    queryFn: () => getSubmissionDetail(user, submissionId ?? ""),
    enabled: Boolean(submissionId),
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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Student Submission</h1>
        <p>Review student work details</p>
      </div>

      <article className="panel">
        <h2>{assignment.title}</h2>
        <p>Class: {assignment.classId.replace("class-", "")}</p>
        <p>Student: {student.name}</p>
        <p>Submitted At: {new Date(submission.submittedAt).toLocaleString()}</p>
        <p>Status: {submission.late ? "Late" : "On time"}</p>
        <p>Submission Type: {submission.submissionType}</p>
        <p>Payload: {submission.payload}</p>
        <p>Score: {typeof submission.score === "number" ? `${submission.score}%` : "Not graded"}</p>
        <p>Teacher Comment: {submission.comment ?? "-"}</p>
        <Link to="/assignments">Back to assignments</Link>
      </article>
    </div>
  );
}
