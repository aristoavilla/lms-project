import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireApprovedUser,
  requireRole,
  requireSubjectInClass,
  requireSubjectOwner,
} from "./lib/rbac";

export const listBySubject = query({
  args: { requesterId: v.id("users"), subjectId: v.id("subjects") },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    const subject = await requireSubjectInClass(ctx, args.subjectId, requester.classId);
    if (requester.role === "specialized_teacher") {
      requireSubjectOwner(requester, subject);
    }
    return await ctx.db
      .query("assignments")
      .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
      .collect();
  },
});

// Create the assignment
export const create = mutation({
  args: {
    requesterId: v.id("users"),
    subjectId: v.id("subjects"),
    semesterId: v.id("semesters"),
    title: v.string(),
    description: v.string(),
    deadline: v.string(),
    allowLate: v.boolean(),
    allowResubmit: v.boolean(),
    totalScore: v.number(),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, ["main_teacher", "specialized_teacher"]);
    const subject = await requireSubjectInClass(ctx, args.subjectId, requester.classId);
    requireSubjectOwner(requester, subject);

    const semester = await ctx.db.get(args.semesterId);
    if (!semester) {
      throw new Error("Semester not found.");
    }
    return await ctx.db.insert("assignments", {
      subjectId: args.subjectId,
      semesterId: args.semesterId,
      title: args.title,
      description: args.description,
      deadline: args.deadline,
      allowLate: args.allowLate,
      allowResubmit: args.allowResubmit,
      totalScore: args.totalScore,
      createdBy: args.requesterId,
    });
  },
});

// Submit assignment from students
export const submit = mutation({
  args: {
    requesterId: v.id("users"),
    assignmentId: v.id("assignments"),
    payloadText: v.optional(v.string()),
    payloadFileId: v.optional(v.id("_storage")),
    quizAnswers: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, ["regular_student", "administrative_student"]);

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found.");
    }

    const subject = await ctx.db.get(assignment.subjectId);
    if (!subject || subject.classId !== requester.classId) {
      throw new Error("Assignment is not available for this student class.");
    }

    const isLate = new Date().getTime() > new Date(assignment.deadline).getTime();
    if (isLate && !assignment.allowLate) {
      throw new Error("Late submission denied.");
    }

    const existing = await ctx.db
      .query("submissions")
      .filter((q) =>
          q.and(
            q.eq(q.field("assignmentId"), args.assignmentId),
          q.eq(q.field("studentId"), args.requesterId),
        ),
      )
      .first();
    if (existing && !assignment.allowResubmit) {
      throw new Error("Resubmission not allowed.");
    }

    const payload = {
      assignmentId: args.assignmentId,
      studentId: args.requesterId,
      submittedAt: new Date().toISOString(),
      late: isLate,
      payloadText: args.payloadText,
      payloadFileId: args.payloadFileId,
      quizAnswers: args.quizAnswers,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("submissions", payload);
  },
});
