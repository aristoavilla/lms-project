import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireApprovedUser, requireRole } from "./lib/rbac";

export const list = query({
  args: { requesterId: v.id("users"), classId: v.id("class") },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, ["super_admin", "main_teacher"]);
    if (requester.role === "main_teacher" && requester.classId !== args.classId) {
      throw new Error("Main teachers can only view users from their own class.");
    }
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("classId"), args.classId))
      .collect();
  },
});

export const approve = mutation({
  args: { requesterId: v.id("users"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, ["super_admin"]);
    await ctx.db.patch(args.targetUserId, { approved: true });
  },
});

export const assignRole = mutation({
  args: {
    requesterId: v.id("users"),
    targetUserId: v.id("users"),
    role: v.union(
      v.literal("main_teacher"),
      v.literal("specialized_teacher"),
      v.literal("administrative_student"),
      v.literal("regular_student"),
    ),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, ["super_admin"]);
    await ctx.db.patch(args.targetUserId, { role: args.role });
  },
});
