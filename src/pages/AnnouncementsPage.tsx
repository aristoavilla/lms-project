import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAnnouncements, useCreateAnnouncement, useUsers } from "../hooks/useLmsQueries";
import { deleteAnnouncement, updateAnnouncement } from "../services/lmsService";
import type { User } from "../types";
import { canManageAnnouncements } from "../utils/rbac";
import { roleLabel } from "../utils/rbac";

interface Props {
  user: User;
}

export function AnnouncementsPage({ user }: Props) {
  const announcements = useAnnouncements(user);
  const users = useUsers();
  const create = useCreateAnnouncement(user);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const update = useMutation({
    mutationFn: (variables: { id: string; title: string; content: string }) =>
      updateAnnouncement(user, variables.id, {
        title: variables.title,
        content: variables.content,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", user.role, user.classId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(user, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", user.role, user.classId] });
    },
  });

  const userMap = new Map((users.data ?? []).map((candidate) => [candidate._id, candidate]));

  return (
    <div className="page">
      <div className="page-header row-between">
        <div>
          <h1>Announcements</h1>
          <p>School and class announcements</p>
        </div>
        {canManageAnnouncements(user) && (
          <button type="button" onClick={() => setShowCreate(true)}>
            Create Announcement
          </button>
        )}
      </div>

      <article className="panel">
        <div className="stack-list">
          {(announcements.data ?? []).map((announcement) => (
            <article key={announcement._id} className="item-card">
              <div className="row-between">
                <h3>
                  {announcement.title}{" "}
                  <span className={`badge ${announcement.createdBy.startsWith("u-super") ? "dark" : "subtle"}`}>
                    {announcement.createdBy.startsWith("u-super")
                      ? "School-wide"
                      : "Class Announcement"}
                  </span>
                </h3>
                {announcement.createdBy === user._id && (
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => {
                        const nextTitle = window.prompt("New title", announcement.title);
                        const nextContent = window.prompt("New content", announcement.content);
                        if (!nextTitle || !nextContent) return;
                        update.mutate({
                          id: announcement._id,
                          title: nextTitle,
                          content: nextContent,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => remove.mutate(announcement._id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <p className="muted-line">
                Posted by {userMap.get(announcement.createdBy)?.name ?? announcement.createdBy} (
                {roleLabel[userMap.get(announcement.createdBy)?.role ?? "regular_student"]}) -{" "}
                {new Date(announcement.createdAt).toLocaleString()}
              </p>
              <p>{announcement.content}</p>
            </article>
          ))}
        </div>
      </article>

      {showCreate && (
        <div className="modal-backdrop">
          <article className="modal">
            <div className="row-between">
              <h3>Create Announcement</h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                X
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate(
                  { title, content },
                  {
                    onSuccess: () => {
                      setTitle("");
                      setContent("");
                      setShowCreate(false);
                    },
                  },
                );
              }}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                required
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Content"
                required
              />
              <div className="row-end">
                <button type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit">Publish</button>
              </div>
            </form>
          </article>
        </div>
      )}
    </div>
  );
}
