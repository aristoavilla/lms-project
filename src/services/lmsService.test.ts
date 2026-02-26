import { describe, expect, it } from "vitest";
import {
  getSubjectRanking,
  gradeSubmission,
  listAttendance,
  submitAssignment,
} from "./lmsService";
import type { User } from "../types";

const teacher: User = {
  _id: "u-main-1",
  name: "Teacher",
  email: "teacher@test",
  role: "main_teacher",
  approved: true,
  classId: "class-10A",
};

const student: User = {
  _id: "u-student-1",
  name: "Student",
  email: "student@test",
  role: "regular_student",
  approved: true,
  classId: "class-10A",
};

const englishTeacher: User = {
  _id: "u-spec-eng",
  name: "English Teacher",
  email: "english@test",
  role: "specialized_teacher",
  approved: true,
  classId: "class-10A",
  subjectIds: ["sub-english"],
};

const otherClassStudent: User = {
  _id: "u-other-class",
  name: "Other Class Student",
  email: "other@test",
  role: "regular_student",
  approved: true,
  classId: "class-11A",
};

describe("lmsService assignment submission", () => {
  it("blocks non-student submissions", async () => {
    await expect(
      submitAssignment(teacher, "as-math-1", "fake.pdf", "file"),
    ).rejects.toThrow("Only students can submit assignments.");
  });

  it("blocks late submissions when assignment disallows late", async () => {
    await expect(
      submitAssignment(student, "as-english-1", "essay text", "text"),
    ).rejects.toThrow("Late submission is not allowed for this assignment.");
  });

  it("blocks submissions for assignments outside the student class", async () => {
    await expect(
      submitAssignment(otherClassStudent, "as-math-1", "worksheet.pdf", "file"),
    ).rejects.toThrow("Assignment is not available for this student class.");
  });
});

describe("lmsService role and ownership security", () => {
  it("blocks grading when teacher is not the subject owner", async () => {
    await expect(
      gradeSubmission(teacher, "subm-3", 90, "reviewed"),
    ).rejects.toThrow("Not authorized to grade this submission.");
  });

  it("blocks specialized teacher from viewing ranking for unowned subject", async () => {
    await expect(
      getSubjectRanking(englishTeacher, "sub-math"),
    ).rejects.toThrow("Specialized teacher can only view their subject ranking.");
  });

  it("limits specialized teacher attendance list to owned subjects", async () => {
    const records = await listAttendance(englishTeacher);
    expect(records.every((record) => record.subjectId === "sub-english")).toBe(true);
  });
});
