import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

type AttachmentDto = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
};

type ChatDto = {
  _id: string;
  type: "class" | "subject" | "direct";
  classId: string;
  subjectId?: string;
  participantIds?: string[];
  lastMessageAt?: string;
  createdAt: string;
};

type ChatThreadDto = {
  chat: ChatDto;
  title: string;
  unreadCount: number;
  lastMessageAt: string | null;
};

type MessageDto = {
  _id: string;
  chatId: string;
  senderId: string;
  content: string;
  attachment?: AttachmentDto;
  createdAt: string;
  editedAt?: string;
  deleted: boolean;
};

type UserDto = {
  _id: string;
  name: string;
  email: string;
  role: Doc<"users">["role"];
  approved: boolean;
  classId: string;
  subjectId?: string;
  taughtClassIds?: string[];
  bio?: string;
  profileImageId?: string;
  profileImageUrl?: string;
};

function toExternalId(value: string | undefined, fallback: string) {
  return value ?? fallback;
}

function toChatExternalId(chat: Doc<"chats">) {
  return toExternalId(chat.externalId, chat._id);
}

function toMessageExternalId(message: Doc<"messages">) {
  return toExternalId(message.externalId, message._id);
}

function parseAttachment(raw: string | undefined): AttachmentDto | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AttachmentDto>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.size === "number" &&
      typeof parsed.mimeType === "string" &&
      typeof parsed.url === "string"
    ) {
      return {
        id: parsed.id,
        name: parsed.name,
        size: parsed.size,
        mimeType: parsed.mimeType,
        url: parsed.url,
      };
    }
  } catch {
    // Keep chat robust even if legacy attachment payload is malformed.
  }
  return undefined;
}

async function getApprovedUserByExternalId(ctx: Ctx, externalId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
  if (!user || user.approved !== true) {
    throw new Error("User is not approved.");
  }
  return user;
}

async function getClassByExternalId(ctx: Ctx, externalClassId: string) {
  const classRow = await ctx.db
    .query("class")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalClassId))
    .first();
  if (!classRow) {
    throw new Error("Class not found.");
  }
  return classRow;
}

async function getSubjectByExternalId(ctx: Ctx, externalSubjectId: string) {
  const subject = await ctx.db
    .query("subjects")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalSubjectId))
    .first();
  if (!subject) {
    throw new Error("Subject not found.");
  }
  return subject;
}

async function getChatByExternalId(ctx: Ctx, externalChatId: string) {
  const chat = await ctx.db
    .query("chats")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalChatId))
    .first();
  if (!chat) {
    throw new Error("Chat not found.");
  }
  return chat;
}

async function getMessageByExternalId(ctx: Ctx, externalMessageId: string) {
  const message = await ctx.db
    .query("messages")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalMessageId))
    .first();
  if (!message) {
    throw new Error("Message not found.");
  }
  return message;
}

async function getMembers(ctx: Ctx, chat: Doc<"chats">): Promise<Id<"users">[]> {
  if (chat.type === "direct") {
    return chat.participantIds ?? [];
  }
  if (chat.type === "class") {
    const rows = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(q.eq(q.field("classId"), chat.classId), q.eq(q.field("approved"), true)),
      )
      .collect();
    return rows.map((row) => row._id);
  }

  const subject = chat.subjectId ? await ctx.db.get(chat.subjectId) : null;
  const subjectTeachers = chat.subjectId
    ? await ctx.db
        .query("subjectTeachers")
        .withIndex("by_subject", (q) => q.eq("subjectId", chat.subjectId as Id<"subjects">))
        .collect()
    : [];
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
  for (const mapping of subjectTeachers) {
    pool.add(mapping.teacherId);
  }
  return Array.from(pool);
}

async function requireChatAccess(ctx: Ctx, requester: Doc<"users">, chat: Doc<"chats">, write: boolean) {
  if (requester.role === "super_admin") {
    if (write) {
      throw new Error("Super admin has read-only chat access.");
    }
    return;
  }
  if (requester.classId !== chat.classId) {
    throw new Error("Cannot access cross-class chat.");
  }
  const members = await getMembers(ctx, chat);
  if (!members.includes(requester._id)) {
    throw new Error("User is not a chat member.");
  }
}

async function toChatDto(ctx: Ctx, chat: Doc<"chats">): Promise<ChatDto> {
  const classRow = await ctx.db.get(chat.classId);
  const participantIds = chat.externalParticipantIds
    ? [...chat.externalParticipantIds]
    : chat.participantIds
      ? await Promise.all(
          chat.participantIds.map(async (participantId) => {
            const user = await ctx.db.get(participantId);
            return user ? toExternalId(user.externalId, user._id) : participantId;
          }),
        )
      : undefined;

  const externalSubjectId = chat.externalSubjectId
    ? chat.externalSubjectId
    : chat.subjectId
      ? (await ctx.db.get(chat.subjectId))?.externalId
      : undefined;

  return {
    _id: toChatExternalId(chat),
    type: chat.type,
    classId: toExternalId(chat.externalClassId, classRow?._id ?? chat.classId),
    subjectId: externalSubjectId,
    participantIds,
    lastMessageAt: chat.lastMessageAt,
    createdAt: chat.createdAt,
  };
}

async function toMessageDto(ctx: Ctx, message: Doc<"messages">): Promise<MessageDto> {
  const chat = await ctx.db.get(message.chatId);
  const sender = await ctx.db.get(message.senderId);
  return {
    _id: toMessageExternalId(message),
    chatId: chat ? toChatExternalId(chat) : message.chatId,
    senderId: sender ? toExternalId(sender.externalId, sender._id) : message.senderId,
    content: message.content,
    attachment: parseAttachment(message.externalAttachment),
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    deleted: message.deleted,
  };
}

async function buildThreadTitle(ctx: Ctx, requester: Doc<"users">, chat: Doc<"chats">) {
  if (chat.type === "class") {
    const classRow = await ctx.db.get(chat.classId);
    return classRow ? `${classRow.name} Chat` : "Class Chat";
  }
  if (chat.type === "subject") {
    const subject = chat.subjectId ? await ctx.db.get(chat.subjectId) : null;
    return subject ? `${subject.name} Chat` : "Subject Chat";
  }
  const peers = chat.participantIds ?? [];
  const otherId = peers.find((participantId) => participantId !== requester._id);
  if (!otherId) {
    return "Direct Message";
  }
  const otherUser = await ctx.db.get(otherId);
  return otherUser?.name ?? "Direct Message";
}

function normalizeMessageContent(content: string) {
  return content.trim();
}

async function findOrCreateDirectChat(
  ctx: MutationCtx,
  requester: Doc<"users">,
  requesterExternalId: string,
  classRow: Doc<"class">,
  classExternalId: string,
  recipientExternalId: string,
) {
  const recipient = await getApprovedUserByExternalId(ctx, recipientExternalId);
  if (recipient._id === requester._id) {
    throw new Error("Cannot send direct message to yourself.");
  }
  if (recipient.classId !== requester.classId) {
    throw new Error("Cross-class messaging is forbidden.");
  }

  const participants = [requesterExternalId, recipientExternalId].sort();
  const externalChatId = `chat-direct-${classExternalId}-${participants.join("-")}`;
  const existing = await ctx.db
    .query("chats")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalChatId))
    .first();
  if (existing) {
    return existing;
  }

  const inserted = await ctx.db.insert("chats", {
    externalId: externalChatId,
    externalClassId: classExternalId,
    externalParticipantIds: participants,
    type: "direct",
    classId: classRow._id,
    participantIds: [requester._id, recipient._id],
    createdAt: new Date().toISOString(),
  });
  const created = await ctx.db.get(inserted);
  if (!created) {
    throw new Error("Failed to create direct chat.");
  }
  return created;
}

async function findOrCreateClassOrSubjectChat(
  ctx: MutationCtx,
  classRow: Doc<"class">,
  classExternalId: string,
  type: "class" | "subject",
  subjectExternalId?: string,
) {
  if (type === "class") {
    const externalId = `chat-class-${classExternalId}`;
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();
    if (existing) {
      return existing;
    }

    const inserted = await ctx.db.insert("chats", {
      externalId,
      externalClassId: classExternalId,
      type: "class",
      classId: classRow._id,
      createdAt: new Date().toISOString(),
    });
    const created = await ctx.db.get(inserted);
    if (!created) {
      throw new Error("Failed to create class chat.");
    }
    return created;
  }

  if (!subjectExternalId) {
    throw new Error("Subject chat requires subjectId.");
  }
  const subject = await getSubjectByExternalId(ctx, subjectExternalId);
  if (subject.classId !== classRow._id) {
    throw new Error("Subject is not in this class.");
  }

  const externalId = `chat-subject-${classExternalId}-${subjectExternalId}`;
  const existing = await ctx.db
    .query("chats")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first();
  if (existing) {
    return existing;
  }

  const inserted = await ctx.db.insert("chats", {
    externalId,
    externalClassId: classExternalId,
    externalSubjectId: subjectExternalId,
    type: "subject",
    classId: classRow._id,
    subjectId: subject._id,
    createdAt: new Date().toISOString(),
  });
  const created = await ctx.db.get(inserted);
  if (!created) {
    throw new Error("Failed to create subject chat.");
  }
  return created;
}

function toUserDto(user: Doc<"users">): UserDto {
  return {
    _id: toExternalId(user.externalId, user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    approved: user.approved,
    classId: toExternalId(user.externalClassId, user.classId),
    subjectId: user.externalSubjectId,
    taughtClassIds: user.externalTaughtClassIds,
    bio: user.bio,
    profileImageId: user.profileImageId,
    profileImageUrl: user.profileImageUrl,
  };
}

export const listThreads = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    const visibleChats =
      requester.role === "super_admin"
        ? await ctx.db.query("chats").collect()
        : await ctx.db
            .query("chats")
            .withIndex("by_class", (q) => q.eq("classId", requester.classId))
            .collect();

    const threads: ChatThreadDto[] = [];
    for (const chat of visibleChats) {
      const members = await getMembers(ctx, chat);
      if (requester.role !== "super_admin" && !members.includes(requester._id)) {
        continue;
      }

      const latest = (await ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect())
        .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))[0];

      threads.push({
        chat: await toChatDto(ctx, chat),
        title: await buildThreadTitle(ctx, requester, chat),
        unreadCount: 0,
        lastMessageAt: latest?.createdAt ?? null,
      });
    }

    return threads.sort((left, right) => {
      const leftTime = left.lastMessageAt ? +new Date(left.lastMessageAt) : +new Date(left.chat.createdAt);
      const rightTime = right.lastMessageAt ? +new Date(right.lastMessageAt) : +new Date(right.chat.createdAt);
      return rightTime - leftTime;
    });
  },
});

export const listMessages = query({
  args: { requesterId: v.string(), chatId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    const chat = await getChatByExternalId(ctx, args.chatId);
    await requireChatAccess(ctx, requester, chat, false);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .collect();
    const ordered = messages.sort(
      (left, right) => +new Date(left.createdAt) - +new Date(right.createdAt),
    );
    return await Promise.all(ordered.map((message) => toMessageDto(ctx, message)));
  },
});

export const send = mutation({
  args: {
    requesterId: v.string(),
    type: v.union(v.literal("class"), v.literal("subject"), v.literal("direct")),
    classId: v.string(),
    subjectId: v.optional(v.string()),
    recipientId: v.optional(v.string()),
    chatId: v.optional(v.string()),
    content: v.string(),
    attachment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      throw new Error("Super admin has read-only chat access.");
    }

    const classRow = await getClassByExternalId(ctx, args.classId);
    if (requester.classId !== classRow._id) {
      throw new Error("Cannot send message outside your class.");
    }

    const content = normalizeMessageContent(args.content);
    if (!content && !args.attachment) {
      throw new Error("Message content or attachment is required.");
    }

    let chat: Doc<"chats"> | null = null;

    if (args.chatId) {
      chat = await getChatByExternalId(ctx, args.chatId);
    } else if (args.type === "direct") {
      if (!args.recipientId) {
        throw new Error("Direct message requires recipient.");
      }
      chat = await findOrCreateDirectChat(
        ctx,
        requester,
        args.requesterId,
        classRow,
        args.classId,
        args.recipientId,
      );
    } else {
      chat = await findOrCreateClassOrSubjectChat(
        ctx,
        classRow,
        args.classId,
        args.type,
        args.subjectId,
      );
    }

    if (!chat) {
      throw new Error("Chat not found.");
    }

    await requireChatAccess(ctx, requester, chat, true);

    const createdAt = new Date().toISOString();
    const messageExternalId = `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const messageId = await ctx.db.insert("messages", {
      externalId: messageExternalId,
      externalChatId: toChatExternalId(chat),
      externalSenderId: args.requesterId,
      externalAttachment: args.attachment,
      chatId: chat._id,
      senderId: requester._id,
      content: content || "Attachment",
      createdAt,
      deleted: false,
    });

    await ctx.db.patch(chat._id, { lastMessageAt: createdAt });

    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Failed to load created message.");
    }
    return await toMessageDto(ctx, message);
  },
});

export const editOwn = mutation({
  args: {
    requesterId: v.string(),
    messageId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      throw new Error("Super admin has read-only chat access.");
    }

    const message = await getMessageByExternalId(ctx, args.messageId);
    if (message.senderId !== requester._id) {
      throw new Error("Cannot edit other users messages.");
    }
    if (message.deleted) {
      throw new Error("Deleted message cannot be edited.");
    }
    if ((Date.now() - new Date(message.createdAt).getTime()) / 60000 > 10) {
      throw new Error("Message can only be edited within 10 minutes.");
    }
    const content = args.content.trim();
    if (!content) {
      throw new Error("Message content cannot be empty.");
    }

    const chat = await ctx.db.get(message.chatId);
    if (!chat) {
      throw new Error("Chat not found.");
    }
    await requireChatAccess(ctx, requester, chat, true);

    await ctx.db.patch(message._id, {
      content,
      editedAt: new Date().toISOString(),
    });
  },
});

export const softDeleteOwn = mutation({
  args: {
    requesterId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      throw new Error("Super admin has read-only chat access.");
    }

    const message = await getMessageByExternalId(ctx, args.messageId);
    if (message.senderId !== requester._id) {
      throw new Error("Cannot delete other users messages.");
    }
    if (message.deleted) {
      throw new Error("Message is already deleted.");
    }

    const chat = await ctx.db.get(message.chatId);
    if (!chat) {
      throw new Error("Chat not found.");
    }
    await requireChatAccess(ctx, requester, chat, true);

    await ctx.db.patch(message._id, {
      content: "Message deleted",
      deleted: true,
      attachmentId: undefined,
      externalAttachment: undefined,
    });
  },
});

export const markRead = mutation({
  args: {
    requesterId: v.string(),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    const chat = await getChatByExternalId(ctx, args.chatId);
    await requireChatAccess(ctx, requester, chat, false);
    return { ok: true };
  },
});

export const listDirectContacts = query({
  args: { requesterId: v.string() },
  handler: async (ctx, args) => {
    const requester = await getApprovedUserByExternalId(ctx, args.requesterId);
    if (requester.role === "super_admin") {
      return [];
    }
    const users = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.eq(q.field("classId"), requester.classId),
          q.eq(q.field("approved"), true),
          q.neq(q.field("_id"), requester._id),
        ),
      )
      .collect();
    return users.map(toUserDto);
  },
});
