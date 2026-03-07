import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireApprovedUser } from "./lib/rbac";

type Ctx = QueryCtx | MutationCtx;

async function getMembers(ctx: Ctx, chat: Doc<"chats">): Promise<Id<"users">[]> {
  if (chat.type === "direct") {
    return chat.participantIds ?? [];
  }
  if (chat.type === "class") {
    const rows = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.eq(q.field("classId"), chat.classId),
          q.eq(q.field("approved"), true),
        ),
      )
      .collect();
    return rows.map((row) => row._id);
  }

  const subject = chat.subjectId ? await ctx.db.get(chat.subjectId) : null;
  const students = await ctx.db
    .query("users")
    .filter((q) =>
      q.and(
        q.eq(q.field("classId"), chat.classId),
        q.eq(q.field("approved"), true),
        q.or(
          q.eq(q.field("role"), "regular_student"),
          q.eq(q.field("role"), "administrative_student"),
        ),
      ),
    )
    .collect();

  const pool = new Set<Id<"users">>(students.map((row) => row._id));
  if (subject?.teacherId) {
    pool.add(subject.teacherId);
  }
  return Array.from(pool);
}

async function requireChatAccess(
  ctx: Ctx,
  requester: Doc<"users">,
  chatId: Id<"chats">,
  write: boolean,
) {
  const chat = await ctx.db.get(chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }
  if (requester.role === "super_admin") {
    if (write) {
      throw new Error("Super admin has read-only chat access.");
    }
    return chat;
  }
  if (requester.classId !== chat.classId) {
    throw new Error("Cannot access cross-class chat.");
  }
  const members = await getMembers(ctx, chat);
  if (!members.includes(requester._id)) {
    throw new Error("User is not a chat member.");
  }
  return chat;
}

export const listThreads = query({
  args: { requesterId: v.id("users") },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    const visibleChats =
      requester.role === "super_admin"
        ? await ctx.db.query("chats").collect()
        : await ctx.db
            .query("chats")
            .withIndex("by_class", (q) => q.eq("classId", requester.classId))
            .collect();

    if (requester.role === "super_admin") {
      return visibleChats;
    }

    const threads: Doc<"chats">[] = [];
    for (const chat of visibleChats) {
      const members = await getMembers(ctx, chat);
      if (members.includes(requester._id)) {
        threads.push(chat);
      }
    }
    return threads;
  },
});

export const listMessages = query({
  args: { requesterId: v.id("users"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    await requireChatAccess(ctx, requester, args.chatId, false);
    return await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

export const send = mutation({
  args: {
    requesterId: v.id("users"),
    type: v.union(v.literal("class"), v.literal("subject"), v.literal("direct")),
    classId: v.id("class"),
    subjectId: v.optional(v.id("subjects")),
    recipientId: v.optional(v.id("users")),
    chatId: v.optional(v.id("chats")),
    content: v.string(),
    attachmentId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      throw new Error("Super admin has read-only chat access.");
    }

    let chatId = args.chatId;
    if (!chatId && args.type === "direct") {
      if (!args.recipientId) {
        throw new Error("Direct message requires recipient.");
      }
      const recipient = await ctx.db.get(args.recipientId);
      if (!recipient || !recipient.approved) {
        throw new Error("Recipient is not available.");
      }
      if (recipient.classId !== requester.classId || args.classId !== requester.classId) {
        throw new Error("Cross-class messaging is forbidden.");
      }

      const directPool = await ctx.db
        .query("chats")
        .withIndex("by_class", (q) => q.eq("classId", requester.classId))
        .collect();

      const existing = directPool.find(
        (chat) =>
          chat.type === "direct" &&
          (chat.participantIds ?? []).length === 2 &&
          (chat.participantIds ?? []).includes(requester._id) &&
          (chat.participantIds ?? []).includes(args.recipientId),
      );

      chatId =
        existing?._id ??
        (await ctx.db.insert("chats", {
          type: "direct",
          classId: requester.classId,
          participantIds: [requester._id, args.recipientId],
          createdAt: new Date().toISOString(),
        }));
    }

    if (!chatId) {
      const sameClass = await ctx.db
        .query("chats")
        .withIndex("by_class", (q) => q.eq("classId", args.classId))
        .collect();

      const existing = sameClass.find(
        (chat) =>
          chat.type === args.type &&
          (args.type !== "subject" || chat.subjectId === args.subjectId),
      );

      chatId =
        existing?._id ??
        (await ctx.db.insert("chats", {
          type: args.type,
          classId: args.classId,
          subjectId: args.subjectId,
          createdAt: new Date().toISOString(),
        }));
    }

    await requireChatAccess(ctx, requester, chatId, true);
    return await ctx.db.insert("messages", {
      chatId,
      senderId: requester._id,
      content: args.content.trim() || "Attachment",
      attachmentId: args.attachmentId,
      createdAt: new Date().toISOString(),
      deleted: false,
    });
  },
});

export const editOwn = mutation({
  args: {
    requesterId: v.id("users"),
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      throw new Error("Super admin has read-only chat access.");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found.");
    }
    if (message.senderId !== requester._id) {
      throw new Error("Cannot edit other users messages.");
    }
    if ((Date.now() - new Date(message.createdAt).getTime()) / 60000 > 10) {
      throw new Error("Message can only be edited within 10 minutes.");
    }

    await requireChatAccess(ctx, requester, message.chatId, true);
    await ctx.db.patch(args.messageId, {
      content: args.content.trim(),
      editedAt: new Date().toISOString(),
    });
  },
});

export const softDeleteOwn = mutation({
  args: {
    requesterId: v.id("users"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const requester = await requireApprovedUser(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      throw new Error("Super admin has read-only chat access.");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found.");
    }
    if (message.senderId !== requester._id) {
      throw new Error("Cannot delete other users messages.");
    }

    await requireChatAccess(ctx, requester, message.chatId, true);
    await ctx.db.patch(args.messageId, {
      content: "Message deleted",
      deleted: true,
      attachmentId: undefined,
    });
  },
});
