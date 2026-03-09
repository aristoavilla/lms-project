import { describe, expect, it } from "vitest";
import type { Assignment, Submission, User } from "../types";
import { calculateOverallRanking, calculateSubjectRanking } from "./ranking";

const students: User[] = [
  {
    _id: "s1",
    name: "Amy",
    email: "a@x.com",
    role: "regular_student",
    approved: true,
    classId: "c1",
  },
  {
    _id: "s2",
    name: "Ben",
    email: "b@x.com",
    role: "regular_student",
    approved: true,
    classId: "c1",
  },
];

const assignments: Assignment[] = [
  {
    _id: "a1",
    subjectId: "math",
    classId: "c1",
    semesterId: "sem1",
    title: "A1",
    description: "",
    deadline: "2026-01-01",
    allowLate: true,
    allowResubmit: true,
    totalScore: 100,
    createdBy: "t1",
    assignmentType: "text",
  },
  {
    _id: "a2",
    subjectId: "eng",
    classId: "c1",
    semesterId: "sem1",
    title: "A2",
    description: "",
    deadline: "2026-01-01",
    allowLate: true,
    allowResubmit: true,
    totalScore: 100,
    createdBy: "t2",
    assignmentType: "text",
  },
];

const submissions: Submission[] = [
  {
    _id: "x1",
    assignmentId: "a1",
    studentId: "s1",
    submissionType: "text",
    payload: "x",
    score: 90,
    submittedAt: "2026-01-01T08:00:00.000Z",
    late: false,
  },
  {
    _id: "x2",
    assignmentId: "a1",
    studentId: "s2",
    submissionType: "text",
    payload: "x",
    score: 90,
    submittedAt: "2026-01-01T09:00:00.000Z",
    late: false,
  },
  {
    _id: "x3",
    assignmentId: "a2",
    studentId: "s2",
    submissionType: "text",
    payload: "x",
    score: 100,
    submittedAt: "2026-01-01T06:00:00.000Z",
    late: false,
  },
];

describe("ranking utilities", () => {
  it("applies tie breaker by earliest submission time for subject ranking", () => {
    const ranking = calculateSubjectRanking("math", assignments, submissions, students);
    expect(ranking[0].studentId).toBe("s1");
    expect(ranking[1].studentId).toBe("s2");
  });

  it("computes overall averages across subjects", () => {
    const ranking = calculateOverallRanking(assignments, submissions, students);
    expect(ranking[0].studentId).toBe("s2");
    expect(ranking[0].average).toBe(95);
  });
});
