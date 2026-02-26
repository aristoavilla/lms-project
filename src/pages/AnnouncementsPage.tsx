import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAnnouncements, useCreateAnnouncement } from "../hooks/useLmsQueries";
import { deleteAnnouncement, updateAnnouncement } from "../services/lmsService";
import type { User } from "../types";
import { canManageAnnouncements } from "../utils/rbac";

interface Props {
  user: User;
}

export function AnnouncementsPage({ user }: Props) {
  const announcements = useAnnouncements(user);
  const create = useCreateAnnouncement(user);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const update = useMutation({
    mutationFn: (variables: { id: string; title: string; content: string }) =>
      updateAnnouncement(user, variables.id, {
        title: variables.title,
        content: variables.content,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", user.classId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(user, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", user.classId] });
    },
  });

  return (
    <div className="grid">
      {canManageAnnouncements(user) && (
        <article className="panel">
          <h3>Create Announcement</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate({ title, content });
              setTitle("");
              setContent("");
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
            <button type="submit">Publish</button>
          </form>
        </article>
      )}

      <article className="panel">
        <h3>Class Announcements</h3>
        {(announcements.data ?? []).map((announcement) => (
          <div key={announcement._id} className="item-card">
            <h4>{announcement.title}</h4>
            <p>{announcement.content}</p>
            <small>{new Date(announcement.createdAt).toLocaleString()}</small>
            {announcement.createdBy === user._id && (
              <div className="button-row">
                <button
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
                <button onClick={() => remove.mutate(announcement._id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </article>
    </div>
  );
}
