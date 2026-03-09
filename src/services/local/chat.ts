import type { Chat, ChatThread, FileAsset, Message, User } from "../../types";
import {
  assertApproved,
  assertAttachment,
  assertChatMembership,
  canAccessClass,
  canSendInChat,
  classChatId,
  delay,
  directChatId,
  ensureReadMap,
  getChatOrThrow,
  localStore,
  sanitizeContent,
  subjectChatId,
  titleForChat,
  unreadCountForChat,
} from "./core";

export async function listChatThreadsForUser(user: User): Promise<ChatThread[]> {
  await delay(120);
  assertApproved(user);

  const visibleChats = localStore.chatState.filter((chat) => {
    if (user.role === "super_admin") {
      return true;
    }
    if (!canAccessClass(user, chat.classId)) {
      return false;
    }
    try {
      assertChatMembership(user, chat);
      return true;
    } catch {
      return false;
    }
  });

  return visibleChats
    .map((chat) => {
      const latest = localStore.messageState
        .filter((message) => message.chatId === chat._id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      return {
        chat,
        title: titleForChat(chat),
        unreadCount: unreadCountForChat(user, chat),
        lastMessageAt: latest?.createdAt ?? null,
      };
    })
    .sort((a, b) => {
      const left = a.lastMessageAt ? +new Date(a.lastMessageAt) : +new Date(a.chat.createdAt);
      const right = b.lastMessageAt ? +new Date(b.lastMessageAt) : +new Date(b.chat.createdAt);
      return right - left;
    });
}

export async function listMessagesForChat(user: User, chatId: string) {
  await delay(130);
  assertApproved(user);
  const chat = getChatOrThrow(chatId);
  assertChatMembership(user, chat);
  return localStore.messageState
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

export async function markChatAsRead(user: User, chatId: string) {
  await delay(10);
  assertApproved(user);
  const chat = getChatOrThrow(chatId);
  assertChatMembership(user, chat);
  const latest = localStore.messageState
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  if (!latest) {
    return;
  }
  const map = ensureReadMap(user._id);
  map.set(chatId, latest.createdAt);
}

export async function sendMessage(
  user: User,
  input: {
    chatId?: string;
    type: Chat["type"];
    classId: string;
    subjectId?: string;
    recipientUserId?: string;
    content: string;
    attachment?: FileAsset;
  },
) {
  await delay(110);
  assertApproved(user);
  if (!canSendInChat(user)) {
    throw new Error("Super admin has read-only access to chats.");
  }
  if (!canAccessClass(user, input.classId)) {
    throw new Error("Cannot send message outside your allowed class scope.");
  }

  assertAttachment(input.attachment);
  const content = sanitizeContent(input.content);
  if (!content && !input.attachment) {
    throw new Error("Message content or attachment is required.");
  }

  let targetChat: Chat;
  if (input.type === "direct") {
    if (!input.recipientUserId) {
      throw new Error("Direct message requires a recipient.");
    }
    const recipient = localStore.userState.find(
      (candidate) => candidate._id === input.recipientUserId,
    );
    if (!recipient || !recipient.approved) {
      throw new Error("Recipient is not available.");
    }
    if (recipient._id === user._id) {
      throw new Error("Cannot send direct message to yourself.");
    }
    if (user.classId !== recipient.classId || input.classId !== user.classId) {
      throw new Error("Cross-class messaging is forbidden.");
    }
    const newChatId = directChatId(input.classId, user._id, recipient._id);
    const existing = localStore.chatState.find((chat) => chat._id === newChatId);
    targetChat =
      existing ??
      {
        _id: newChatId,
        type: "direct",
        classId: input.classId,
        participantIds: [user._id, recipient._id].sort(),
        createdAt: new Date().toISOString(),
      };
    if (!existing) {
      localStore.chatState = [targetChat, ...localStore.chatState];
    }
  } else if (input.chatId) {
    targetChat = getChatOrThrow(input.chatId);
  } else if (input.type === "class") {
    targetChat = getChatOrThrow(classChatId(input.classId));
  } else {
    if (!input.subjectId) {
      throw new Error("Subject chat requires subjectId.");
    }
    targetChat = getChatOrThrow(subjectChatId(input.classId, input.subjectId));
  }

  assertChatMembership(user, targetChat);

  const created: Message = {
    _id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    chatId: targetChat._id,
    senderId: user._id,
    content: content || "Attachment",
    attachment: input.attachment,
    createdAt: new Date().toISOString(),
    deleted: false,
  };
  localStore.messageState = [...localStore.messageState, created];
  const map = ensureReadMap(user._id);
  map.set(targetChat._id, created.createdAt);
  return created;
}

export async function editMessage(user: User, messageId: string, content: string) {
  await delay(100);
  assertApproved(user);
  if (!canSendInChat(user)) {
    throw new Error("Super admin has read-only access to chats.");
  }
  const existing = localStore.messageState.find((row) => row._id === messageId);
  if (!existing) {
    throw new Error("Message not found.");
  }
  if (existing.senderId !== user._id) {
    throw new Error("Cannot edit other users' messages.");
  }
  const minutes = (+new Date() - +new Date(existing.createdAt)) / 60000;
  if (minutes > 10) {
    throw new Error("Message can only be edited within 10 minutes.");
  }
  if (existing.deleted) {
    throw new Error("Deleted message cannot be edited.");
  }
  const nextContent = sanitizeContent(content);
  if (!nextContent) {
    throw new Error("Message content cannot be empty.");
  }
  localStore.messageState = localStore.messageState.map((row) =>
    row._id === messageId
      ? {
          ...row,
          content: nextContent,
          editedAt: new Date().toISOString(),
        }
      : row,
  );
}

export async function softDeleteMessage(user: User, messageId: string) {
  await delay(90);
  assertApproved(user);
  if (!canSendInChat(user)) {
    throw new Error("Super admin has read-only access to chats.");
  }
  const existing = localStore.messageState.find((row) => row._id === messageId);
  if (!existing) {
    throw new Error("Message not found.");
  }
  if (existing.senderId !== user._id) {
    throw new Error("Cannot delete other users' messages.");
  }
  localStore.messageState = localStore.messageState.map((row) =>
    row._id === messageId
      ? {
          ...row,
          content: "Message deleted",
          attachment: undefined,
          deleted: true,
        }
      : row,
  );
}

export async function listDirectContacts(user: User) {
  await delay(60);
  assertApproved(user);
  if (user.role === "super_admin") {
    return [];
  }
  return localStore.userState.filter(
    (candidate) =>
      candidate._id !== user._id &&
      candidate.approved &&
      candidate.classId === user.classId,
  );
}
