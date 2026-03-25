import type { Chat, ChatThread, FileAsset, Message, User } from "../../types";
import { deleteRequest, getJson, patchJson, postJson, mapUser, type ApiUser } from "./core";

export async function listChatThreadsForUser(_user: User): Promise<ChatThread[]> {
  const payload = await getJson<{ threads: ChatThread[] }>("/lms/chats/threads");
  return payload.threads;
}

export async function listMessagesForChat(_user: User, chatId: string) {
  const payload = await getJson<{ messages: Message[] }>(`/lms/chats/${encodeURIComponent(chatId)}/messages`);
  return payload.messages;
}

export async function markChatAsRead(_user: User, chatId: string) {
  await postJson(`/lms/chats/${encodeURIComponent(chatId)}/read`, {});
}

export async function sendMessage(
  _user: User,
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
  const payload = await postJson<{ message: Message }>("/lms/messages/send", input);
  return payload.message;
}

export async function editMessage(_user: User, messageId: string, content: string) {
  const payload = await patchJson<{ message: Message }>(
    `/lms/messages/${encodeURIComponent(messageId)}`,
    { content },
  );
  return payload.message;
}

export async function softDeleteMessage(_user: User, messageId: string) {
  await deleteRequest(`/lms/messages/${encodeURIComponent(messageId)}`);
}

export async function listDirectContacts(_user: User) {
  const payload = await getJson<{ contacts: ApiUser[] }>("/lms/chats/direct-contacts");
  return payload.contacts.map(mapUser);
}