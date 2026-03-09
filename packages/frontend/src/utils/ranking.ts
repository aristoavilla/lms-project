import type { Assignment, RankedStudent, Submission, User } from "../types";

interface SubjectAverage {
  studentId: string;
  average: number;
  earliestSubmissionAt: string;
}

function calculateSubjectAverages(
  subjectId: string,
  subjectAssignments: Assignment[],
  allSubmissions: Submission[],
): SubjectAverage[] {
  const assignments = subjectAssignments.filter((a) => a.subjectId === subjectId);
  const byStudent = new Map<string, { total: number; count: number; earliest: string }>();

  assignments.forEach((assignment) => {
    const perAssignment = allSubmissions.filter((s) => s.assignmentId === assignment._id);
    perAssignment.forEach((submission) => {
      if (typeof submission.score !== "number") {
        return;
      }
      const existing = byStudent.get(submission.studentId);
      if (!existing) {
        byStudent.set(submission.studentId, {
          total: submission.score,
          count: 1,
          earliest: submission.submittedAt,
        });
        return;
      }
      byStudent.set(submission.studentId, {
        total: existing.total + submission.score,
        count: existing.count + 1,
        earliest:
          new Date(submission.submittedAt) < new Date(existing.earliest)
            ? submission.submittedAt
            : existing.earliest,
      });
    });
  });

  return [...byStudent.entries()].map(([studentId, value]) => ({
    studentId,
    average: value.total / value.count,
    earliestSubmissionAt: value.earliest,
  }));
}

export function calculateSubjectRanking(
  subjectId: string,
  assignments: Assignment[],
  submissions: Submission[],
  students: User[],
): RankedStudent[] {
  const averages = calculateSubjectAverages(subjectId, assignments, submissions);
  const studentMap = new Map(students.map((s) => [s._id, s.name]));

  return averages
    .map((entry) => ({
      studentId: entry.studentId,
      studentName: studentMap.get(entry.studentId) ?? "Unknown Student",
      average: Number(entry.average.toFixed(2)),
      earliestSubmissionAt: entry.earliestSubmissionAt,
    }))
    .sort((a, b) => {
      if (b.average !== a.average) {
        return b.average - a.average;
      }
      const dateSort =
        new Date(a.earliestSubmissionAt).getTime() -
        new Date(b.earliestSubmissionAt).getTime();
      if (dateSort !== 0) {
        return dateSort;
      }
      return a.studentName.localeCompare(b.studentName);
    });
}

export function calculateOverallRanking(
  assignments: Assignment[],
  submissions: Submission[],
  students: User[],
): RankedStudent[] {
  const subjectIds = [...new Set(assignments.map((assignment) => assignment.subjectId))];
  const subjectRankings = subjectIds.map((id) =>
    calculateSubjectAverages(id, assignments, submissions),
  );
  const aggregator = new Map<string, { total: number; count: number; earliest: string }>();

  subjectRankings.forEach((subjectAverageList) => {
    subjectAverageList.forEach((avg) => {
      const existing = aggregator.get(avg.studentId);
      if (!existing) {
        aggregator.set(avg.studentId, {
          total: avg.average,
          count: 1,
          earliest: avg.earliestSubmissionAt,
        });
        return;
      }
      aggregator.set(avg.studentId, {
        total: existing.total + avg.average,
        count: existing.count + 1,
        earliest:
          new Date(avg.earliestSubmissionAt) < new Date(existing.earliest)
            ? avg.earliestSubmissionAt
            : existing.earliest,
      });
    });
  });

  const studentMap = new Map(students.map((s) => [s._id, s.name]));
  return [...aggregator.entries()]
    .map(([studentId, data]) => ({
      studentId,
      studentName: studentMap.get(studentId) ?? "Unknown Student",
      average: Number((data.total / data.count).toFixed(2)),
      earliestSubmissionAt: data.earliest,
    }))
    .sort((a, b) => {
      if (b.average !== a.average) {
        return b.average - a.average;
      }
      const dateSort =
        new Date(a.earliestSubmissionAt).getTime() -
        new Date(b.earliestSubmissionAt).getTime();
      if (dateSort !== 0) {
        return dateSort;
      }
      return a.studentName.localeCompare(b.studentName);
    });
}
