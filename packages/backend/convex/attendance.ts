import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireApprovedUser,
  requireRole,
  requireSubjectInClass,
  requireSubjectOwner,
} from "./lib/rbac";

export const list = query({
  args: { requesterId: v.id("users"), subjectId: v.optional(v.id("subjects")) },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    if (requester.role === "regular_student" || requester.role === "administrative_student") {
      return await ctx.db
        .query("attendance")
        .filter((q) => q.eq(q.field("studentId"), args.requesterId))
        .collect();
    }
    if (requester.role === "specialized_teacher") {
      if (!args.subjectId) {
        throw new Error("Subject is required for specialized teacher attendance view.");
      }
      const subject = await requireSubjectInClass(ctx, args.subjectId, requester.classId);
      requireSubjectOwner(requester, subject);
      return await ctx.db
        .query("attendance")
        .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
        .collect();
    }
    return await ctx.db.query("attendance").collect();
  },
});

export const mark = mutation({
  args: {
    requesterId: v.id("users"),
    subjectId: v.id("subjects"),
    semesterId: v.id("semesters"),
    studentId: v.id("users"),
    date: v.string(),
    status: v.union(v.literal("Present"), v.literal("Absent"), v.literal("Excused")),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, ["main_teacher", "specialized_teacher"]);

    const subject = await requireSubjectInClass(ctx, args.subjectId, requester.classId);
    if (requester.role === "specialized_teacher") {
      requireSubjectOwner(requester, subject);
    }

    const student = await ctx.db.get(args.studentId);
    if (!student || student.classId !== subject.classId) {
      throw new Error("Student is not in the subject class.");
    }

    const semester = await ctx.db.get(args.semesterId);
    if (!semester) {
      throw new Error("Semester not found.");
    }

    return await ctx.db.insert("attendance", {
      subjectId: args.subjectId,
      semesterId: args.semesterId,
      studentId: args.studentId,
      date: args.date,
      status: args.status,
    });
  },
});
