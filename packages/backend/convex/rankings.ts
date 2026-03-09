import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireApprovedUser } from "./lib/rbac";

function rankRows(
  rows: Array<{ studentId: string; average: number; earliestSubmissionAt: string; name: string }>,
) {
  return rows.sort((a, b) => {
    if (b.average !== a.average) return b.average - a.average;
    const submissionSort =
      new Date(a.earliestSubmissionAt).getTime() -
      new Date(b.earliestSubmissionAt).getTime();
    if (submissionSort !== 0) return submissionSort;
    return a.name.localeCompare(b.name);
  });
}

export const subject = query({
  args: {
    requesterId: v.id("users"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    if (requester.role === "regular_student" || requester.role === "administrative_student") {
      throw new Error("Students cannot view rankings.");
    }
    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.classId !== requester.classId) {
      throw new Error("Cannot view ranking for a subject outside your class.");
    }
    if (requester.role === "specialized_teacher" && subject.teacherId !== requester._id) {
      throw new Error("Specialized teachers can only view their own subject ranking.");
    }
    const assignments = await ctx.db
      .query("assignments")
      .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
      .collect();
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("classId"), requester.classId))
      .collect();

    const studentRows: Array<{
      studentId: string;
      average: number;
      earliestSubmissionAt: string;
      name: string;
    }> = [];

    for (const user of users) {
      if (user.role !== "regular_student" && user.role !== "administrative_student") continue;
      const subs = (
        await Promise.all(
          assignments.map((assignment) =>
            ctx.db
              .query("submissions")
              .filter((q) =>
                q.and(
                  q.eq(q.field("assignmentId"), assignment._id),
                  q.eq(q.field("studentId"), user._id),
                ),
              )
              .first(),
          ),
        )
      ).filter(Boolean);

      const graded = subs.filter((entry) => typeof entry?.score === "number");
      if (graded.length === 0) continue;

      const total = graded.reduce((sum, entry) => sum + (entry?.score ?? 0), 0);
      const earliest = graded
        .map((entry) => entry?.submittedAt ?? new Date().toISOString())
        .sort()[0];

      studentRows.push({
        studentId: user._id,
        average: total / graded.length,
        earliestSubmissionAt: earliest,
        name: user.name,
      });
    }
    return rankRows(studentRows);
  },
});
