import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PaginationControls } from "../components/PaginationControls";
import {
  useDeleteMessage,
  useEditMessage,
  useMarkChatAsRead,
  useSendMessage,
  useChatMessages,
  useChatThreads,
  useDirectContacts,
  useUsers,
} from "../hooks/useLmsQueries";
import { usePagination } from "../hooks/usePagination";
import type { Chat, FileAsset, User } from "../types";

interface Props {
  user: User;
}

function Icon({
  path,
  viewBox = "0 0 24 24",
}: {
  path: string;
  viewBox?: string;
}) {
  return (
    <svg viewBox={viewBox} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function groupLabel(type: Chat["type"]) {
  if (type === "class") return "Class Chat";
  if (type === "subject") return "Subject Chats";
  return "Direct Messages";
}

function groupIcon(type: Chat["type"]) {
  if (type === "class") return "M3 12h18M12 3v18";
  if (type === "subject") return "M6 4h12l2 4-2 4H6L4 8l2-4zm0 8v8m12-8v8";
  return "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0";
}

function threadIcon(type: Chat["type"]) {
  if (type === "class") return "M4 7h16M4 12h16M4 17h16";
  if (type === "subject") return "M7 3h10l4 4v14H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm7 1v5h5";
  return "M4 19v-10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10l-4-3H8z";
}

function shortTime(iso: string | null) {
  if (!iso) return "No activity";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function attachmentFromFile(file: File): FileAsset {
  return {
    id: `file-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    url: URL.createObjectURL(file),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function ChatPage({ user }: Props) {
  const convexEnabled = Boolean(import.meta.env.VITE_CONVEX_URL);
  const fallbackThreads = useChatThreads(user, { enabled: !convexEnabled });
  const fallbackContacts = useDirectContacts(user, { enabled: !convexEnabled });
  const users = useUsers();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState<FileAsset | undefined>(undefined);
  const [recipient, setRecipient] = useState("");
  const [recipientClassId, setRecipientClassId] = useState(user.classId);
  const [actionError, setActionError] = useState<string | null>(null);

  const streamedThreads = useConvexQuery(
    api.chats.listThreads,
    convexEnabled ? { requesterId: user._id } : "skip",
  );

  const allThreads = useMemo(
    () => (convexEnabled ? streamedThreads ?? [] : fallbackThreads.data ?? []),
    [convexEnabled, streamedThreads, fallbackThreads.data],
  );
  const effectiveActiveChatId = activeChatId ?? allThreads[0]?.chat._id ?? null;

  const fallbackMessages = useChatMessages(user, effectiveActiveChatId, { enabled: !convexEnabled });
  const streamedMessages = useConvexQuery(
    api.chats.listMessages,
    convexEnabled && effectiveActiveChatId
      ? { requesterId: user._id, chatId: effectiveActiveChatId }
      : "skip",
  );
  const messagesData = convexEnabled
    ? streamedMessages ?? []
    : fallbackMessages.data ?? [];

  const streamedContacts = useConvexQuery(
    api.chats.listDirectContacts,
    convexEnabled && user.role !== "super_admin" ? { requesterId: user._id } : "skip",
  );
  const contactsData = convexEnabled
    ? (streamedContacts ?? [])
    : ((fallbackContacts.data ?? []) as User[]);

  const send = useSendMessage(user);
  const edit = useEditMessage(user, effectiveActiveChatId);
  const remove = useDeleteMessage(user, effectiveActiveChatId);
  const read = useMarkChatAsRead(user);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const lastReadChatIdRef = useRef<string | null>(null);

  const groupedThreads = useMemo(
    () => ({
      class: allThreads.filter((row) => row.chat.type === "class"),
      subject: allThreads.filter((row) => row.chat.type === "subject"),
      direct: allThreads.filter((row) => row.chat.type === "direct"),
    }),
    [allThreads],
  );

  const activeThread = useMemo(
    () => allThreads.find((row) => row.chat._id === effectiveActiveChatId) ?? null,
    [allThreads, effectiveActiveChatId],
  );
  const pagedClassThreads = usePagination(groupedThreads.class, 10, allThreads.length);
  const pagedSubjectThreads = usePagination(groupedThreads.subject, 10, allThreads.length);
  const pagedDirectThreads = usePagination(groupedThreads.direct, 10, allThreads.length);

  const threadsError = !convexEnabled && fallbackThreads.error
    ? getErrorMessage(fallbackThreads.error, "Failed to load chat threads.")
    : null;
  const messagesError = !convexEnabled && fallbackMessages.error
    ? getErrorMessage(fallbackMessages.error, "Failed to load messages.")
    : null;
  const contactsError = !convexEnabled && fallbackContacts.error
    ? getErrorMessage(fallbackContacts.error, "Failed to load direct contacts.")
    : null;
  const isThreadsLoading = convexEnabled ? streamedThreads === undefined : fallbackThreads.isLoading;
  const isMessagesLoading = convexEnabled
    ? Boolean(effectiveActiveChatId) && streamedMessages === undefined
    : fallbackMessages.isLoading;

  useEffect(() => {
    if (!effectiveActiveChatId) {
      return;
    }
    if (lastReadChatIdRef.current === effectiveActiveChatId) {
      return;
    }
    lastReadChatIdRef.current = effectiveActiveChatId;
    read.mutate(effectiveActiveChatId, {
      onError: (error) => {
        if (lastReadChatIdRef.current === effectiveActiveChatId) {
          lastReadChatIdRef.current = null;
        }
        setActionError(getErrorMessage(error, "Failed to mark this chat as read."));
      },
    });
  }, [effectiveActiveChatId, read.mutate]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messagesData.length]);

  const userMap = useMemo(
    () =>
      new Map<string, User>(((users.data ?? []) as User[]).map((candidate) => [candidate._id, candidate])),
    [users.data],
  );

  const activeChat = activeThread?.chat ?? null;
  const canSend = user.role !== "super_admin";
  const trimmedMessage = messageText.trim();
  const hasOutgoingContent = trimmedMessage.length > 0 || Boolean(attachment);
  const canSubmit = canSend && !send.isPending && hasOutgoingContent;

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setActionError(null);
    try {
      if (activeChat) {
        await send.mutateAsync({
          chatId: activeChat._id,
          type: activeChat.type,
          classId: activeChat.classId,
          subjectId: activeChat.subjectId,
          content: trimmedMessage,
          attachment,
        });
        setMessageText("");
        setAttachment(undefined);
        return;
      }

      if (!recipient) {
        setActionError("Please choose a recipient to start a direct chat.");
        return;
      }
      const created = await send.mutateAsync({
        type: "direct",
        classId: recipientClassId,
        recipientUserId: recipient,
        content: trimmedMessage,
        attachment,
      });
      setActiveChatId(created.chatId);
      setMessageText("");
      setAttachment(undefined);
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to send message."));
    }
  }

  return (
    <div className="page chat-page">
      <div className="page-header">
        <h1>Real-time Chat</h1>
        <p>Class, subject, and direct channels with role-aware access control.</p>
      </div>

      <section className="panel chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head row-between">
            <strong className="chat-title-with-icon">
              <span className="chat-mini-icon">
                <Icon path="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
              </span>
              Channels
            </strong>
            {isThreadsLoading && <span className="badge subtle">Loading</span>}
          </div>

          {threadsError && <p className="error-text">{threadsError}</p>}

          {user.role !== "super_admin" && (
            <div className="item-card dm-composer">
              <strong className="chat-title-with-icon">
                <span className="chat-mini-icon">
                  <Icon path="M4 19v-10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10l-4-3H8z" />
                </span>
                Start Direct Message
              </strong>
              <select value={recipient} onChange={(event) => setRecipient(event.target.value)}>
                <option value="">Select recipient</option>
                {contactsData.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              {contactsError && <p className="error-text">{contactsError}</p>}
              <input
                value={recipientClassId}
                onChange={(event) => setRecipientClassId(event.target.value)}
                placeholder="class-1A"
              />
              <button
                type="button"
                className="chat-quick-action"
                onClick={async () => {
                  if (!recipient) {
                    setActionError("Please choose a recipient to open a direct chat.");
                    return;
                  }
                  setActionError(null);
                  try {
                    const created = await send.mutateAsync({
                      type: "direct",
                      classId: recipientClassId,
                      recipientUserId: recipient,
                      content: "Hello",
                    });
                    setActiveChatId(created.chatId);
                  } catch (error) {
                    setActionError(getErrorMessage(error, "Failed to open direct chat."));
                  }
                }}
              >
                <span className="button-icon">
                  <Icon path="M5 12h14M13 6l6 6-6 6" />
                </span>
                Open Chat
              </button>
            </div>
          )}

          {(["class", "subject", "direct"] as const).map((type) => {
            const pageItems =
              type === "class"
                ? pagedClassThreads.pageItems
                : type === "subject"
                  ? pagedSubjectThreads.pageItems
                  : pagedDirectThreads.pageItems;

            return (
              <div key={type} className="chat-group">
                <small className="chat-title-with-icon chat-group-label">
                  <span className="chat-mini-icon">
                    <Icon path={groupIcon(type)} />
                  </span>
                  {groupLabel(type)}
                </small>

                {pageItems.map((thread) => (
                  <button
                    key={thread.chat._id}
                    type="button"
                    className={`chat-thread-button ${effectiveActiveChatId === thread.chat._id ? "active" : ""}`}
                    onClick={() => setActiveChatId(thread.chat._id)}
                  >
                    <span className="thread-main">
                      <span className="chat-mini-icon">
                        <Icon path={threadIcon(thread.chat.type)} />
                      </span>
                      <span>
                        <span className="thread-title">{thread.title}</span>
                        <span className="thread-meta">Last: {shortTime(thread.lastMessageAt)}</span>
                      </span>
                    </span>
                    <span className="thread-right">
                      {thread.unreadCount > 0 && <span className="badge warning">{thread.unreadCount}</span>}
                    </span>
                  </button>
                ))}

                {pageItems.length === 0 && <p className="muted-line chat-empty-line">No channels available.</p>}

                <PaginationControls
                  currentPage={
                    type === "class"
                      ? pagedClassThreads.currentPage
                      : type === "subject"
                        ? pagedSubjectThreads.currentPage
                        : pagedDirectThreads.currentPage
                  }
                  totalPages={
                    type === "class"
                      ? pagedClassThreads.totalPages
                      : type === "subject"
                        ? pagedSubjectThreads.totalPages
                        : pagedDirectThreads.totalPages
                  }
                  totalItems={
                    type === "class"
                      ? pagedClassThreads.totalItems
                      : type === "subject"
                        ? pagedSubjectThreads.totalItems
                        : pagedDirectThreads.totalItems
                  }
                  onPageChange={
                    type === "class"
                      ? pagedClassThreads.setCurrentPage
                      : type === "subject"
                        ? pagedSubjectThreads.setCurrentPage
                        : pagedDirectThreads.setCurrentPage
                  }
                />
              </div>
            );
          })}
        </aside>

        <section className="chat-main">
          {actionError && <p className="error-text">{actionError}</p>}
          {messagesError && <p className="error-text">{messagesError}</p>}

          {isMessagesLoading && (
            <div className="chat-skeleton-list">
              <div className="chat-skeleton" />
              <div className="chat-skeleton" />
              <div className="chat-skeleton" />
            </div>
          )}

          {!isMessagesLoading && (
            <>
              <div className="chat-head row-between">
                <strong className="chat-title-with-icon">
                  <span className="chat-mini-icon">
                    <Icon path={activeThread ? threadIcon(activeThread.chat.type) : "M4 12h16"} />
                  </span>
                  {activeThread?.title ?? "Select a chat"}
                </strong>
                {!canSend && <span className="badge dark">Moderation Read-only</span>}
              </div>

              <div className="chat-feed">
                {messagesData.map((message) => {
                  const sender = userMap.get(message.senderId);
                  const mine = message.senderId === user._id;
                  return (
                    <article key={message._id} className={`chat-bubble ${mine ? "mine" : ""}`}>
                      <div className="chat-message-head">
                        <strong className="chat-title-with-icon">
                          <span className="chat-mini-icon">
                            <Icon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0" />
                          </span>
                          {sender?.name ?? message.senderId}
                        </strong>
                        <small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                      </div>
                      <p className={`chat-message-content ${message.deleted ? "muted-line" : ""}`}>{message.content}</p>
                      {message.attachment && (
                        <a href={message.attachment.url} target="_blank" rel="noreferrer" className="text-link">
                          {message.attachment.name}
                        </a>
                      )}
                      {message.editedAt && <small className="muted-line chat-message-meta">Edited</small>}
                      {mine && canSend && !message.deleted && (
                        <div className="button-row chat-actions">
                          <button
                            type="button"
                            onClick={async () => {
                              const next = window.prompt("Edit message", message.content);
                              if (!next) return;
                              setActionError(null);
                              try {
                                await edit.mutateAsync({ messageId: message._id, content: next });
                              } catch (error) {
                                setActionError(getErrorMessage(error, "Failed to edit message."));
                              }
                            }}
                          >
                            <span className="button-icon">
                              <Icon path="M3 17.5V21h3.5L19 8.5 15.5 5 3 17.5zM14 6l4 4" />
                            </span>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setActionError(null);
                              try {
                                await remove.mutateAsync(message._id);
                              } catch (error) {
                                setActionError(getErrorMessage(error, "Failed to delete message."));
                              }
                            }}
                          >
                            <span className="button-icon">
                              <Icon path="M4 7h16M9 7V4h6v3m-7 4v7m4-7v7m4-7v7M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
                            </span>
                            Delete
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!messagesData.length && <p className="muted-line chat-feed-empty">No messages yet. Start the conversation.</p>}
                <div ref={feedEndRef} />
              </div>

              <form className="chat-input" onSubmit={onSend}>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={canSend ? "Write a message" : "Read-only for super admin"}
                  disabled={!canSend || send.isPending}
                />
                <div className="row-between chat-send-row">
                  <label className="chat-attach">
                    <input
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          setAttachment(undefined);
                          return;
                        }
                        setAttachment(attachmentFromFile(file));
                      }}
                      disabled={!canSend || send.isPending}
                    />
                    <span className="chat-attach-name">{attachment ? attachment.name : "Attach file/image"}</span>
                  </label>
                  <button type="submit" disabled={!canSubmit}>
                    <span className="button-icon">
                      <Icon path="M3 11.5 21 3l-7 18-2.5-7.5zM11.5 11.5 14 21" />
                    </span>
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
