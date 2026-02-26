import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireApprovedUser, requireRole } from "./lib/rbac";

export const list = query({
  args: { requesterId: v.id("users"), classId: v.id("class") },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    if (requester.classId !== args.classId) {
      throw new Error("Cannot view announcements outside your class.");
    }
    return await ctx.db
      .query("announcements")
      .filter((q) => q.eq(q.field("classId"), args.classId))
      .collect();
  },
});

export const create = mutation({
  args: {
    requesterId: v.id("users"),
    classId: v.id("class"),
    title: v.string(),
    content: v.string(),
    attachment: v.optional(v.id("_storage")),
    scheduledAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    requireRole(requester.role, [
      "main_teacher",
      "specialized_teacher",
      "administrative_student",
    ]);
    if (requester.classId !== args.classId) {
      throw new Error("Cannot create announcements outside your class.");
    }
    return await ctx.db.insert("announcements", {
      title: args.title,
      content: args.content,
      attachment: args.attachment,
      scheduledAt: args.scheduledAt,
      createdBy: args.requesterId,
      createdAt: new Date().toISOString(),
      classId: args.classId,
    });
  },
});

export const updateOwn = mutation({
  args: {
    requesterId: v.id("users"),
    announcementId: v.id("announcements"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireApprovedUser(ctx, args.requesterId);
    const existing = await ctx.db.get(args.announcementId);
    if (!existing || existing.createdBy !== args.requesterId) {
      throw new Error("Can only edit own announcements.");
    }
    await ctx.db.patch(args.announcementId, {
      title: args.title,
      content: args.content,
    });
  },
});

export const removeOwn = mutation({
  args: {
    requesterId: v.id("users"),
    announcementId: v.id("announcements"),
  },
  handler: async (ctx, args) => {
    await requireApprovedUser(ctx, args.requesterId);
    const existing = await ctx.db.get(args.announcementId);
    if (!existing || existing.createdBy !== args.requesterId) {
      throw new Error("Can only delete own announcements.");
    }
    await ctx.db.delete(args.announcementId);
  },
});
