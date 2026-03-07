import { useMemo, useState } from "react";
import { PaginationControls } from "../components/PaginationControls";
import { useUpdateProfile, useUsers, useVisibleProfiles } from "../hooks/useLmsQueries";
import { usePagination } from "../hooks/usePagination";
import type { FileAsset, User } from "../types";

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toAsset(file: File): FileAsset {
  return {
    id: `profile-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    url: URL.createObjectURL(file),
  };
}

function roleText(role: User["role"]) {
  return role.replaceAll("_", " ");
}

function classLabel(classId: string) {
  return classId.replace("class-", "Class ");
}

export function ProfilePage({ user }: Props) {
  const users = useUsers();
  const visible = useVisibleProfiles(user);
  const update = useUpdateProfile(user);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: user.name, bio: user.bio ?? "" });
  const [newImage, setNewImage] = useState<FileAsset | null | undefined>(undefined);
  const [imageError, setImageError] = useState<string | null>(null);

  const me = useMemo(
    () => (users.data ?? []).find((candidate) => candidate._id === user._id) ?? user,
    [users.data, user],
  );

  const displayImage = newImage?.url ?? me.profileImageUrl;
  const pagedProfiles = usePagination(visible.data ?? [], 10);

  return (
    <div className="page profile-page">
      <div className="page-header profile-page-header">
        <div>
          <h1>Profile Settings</h1>
          <p>Update your profile the same way social apps do: simple, clear, and quick.</p>
        </div>
      </div>

      <div className="profile-shell">
        <article className="panel profile-overview-card">
          <div className="profile-overview-head">
            {displayImage ? (
              <img src={displayImage} alt={me.name} className="profile-avatar" />
            ) : (
              <div className="profile-avatar profile-fallback">{initials(me.name)}</div>
            )}
            <div className="profile-overview-copy">
              <h2>{me.name}</h2>
              <p className="profile-role-chip">{roleText(me.role)}</p>
              <p className="muted-line">{classLabel(me.classId)}</p>
            </div>
          </div>

          <div className="profile-overview-stats">
            <span>
              <strong>{pagedProfiles.totalItems}</strong>
              <small>People you can view</small>
            </span>
            <span>
              <strong>{classLabel(me.classId)}</strong>
              <small>Assigned class</small>
            </span>
          </div>

          {!isEditing ? (
            <button
              type="button"
              className="profile-edit-trigger"
              onClick={() => {
                setDraft({ name: me.name, bio: me.bio ?? "" });
                setNewImage(undefined);
                setImageError(null);
                setIsEditing(true);
              }}
            >
              <span className="button-icon">
                <Icon path="M3 17.5V21h3.5L19 8.5 15.5 5 3 17.5zM14 6l4 4" />
              </span>
              Edit Profile
            </button>
          ) : (
            <p className="muted-line">Editing mode is on. Update details and save your changes.</p>
          )}
        </article>

        <article className="panel profile-settings-card">
          <form
            className="profile-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await update.mutateAsync({
                name: draft.name,
                bio: draft.bio,
                profileImage: newImage === undefined ? undefined : newImage,
              });
              setIsEditing(false);
            }}
          >
            <div className="profile-section-head">
              <h2>Public Profile</h2>
              <p>This is what users in your scope can see.</p>
            </div>

            <label className="profile-field">
              <span className="field-title">Display Name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                disabled={!isEditing || update.isPending}
                required
              />
            </label>
            <label className="profile-field">
                          <span className="field-title">Bio</span>
              <textarea
                value={draft.bio}
                onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                disabled={!isEditing || update.isPending}
                            placeholder="Tell others a little about yourself"
              />
            </label>

            <label className="profile-field">
                          <span className="field-title">Profile Photo</span>
                          <div className={`profile-file-box ${!isEditing ? "disabled" : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      setImageError(null);
                      setNewImage(undefined);
                      return;
                    }
                    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                      setImageError("Only jpg, png, and webp images are supported.");
                      return;
                    }
                    if (file.size > 2 * 1024 * 1024) {
                      setImageError("Profile image max size is 2MB.");
                      return;
                    }
                    setImageError(null);
                    setNewImage(toAsset(file));
                  }}
                  disabled={!isEditing || update.isPending}
                />
                <small>{attachmentHint(newImage)}</small>
              </div>
            </label>

            <div className="profile-section-head account-readonly-head">
              <h3>Account Information</h3>
              <p>These fields are managed by the school administration.</p>
            </div>

            <div className="profile-readonly-grid">
              <label className="profile-field">
                <span className="field-title">Email</span>
                <input value={me.email} disabled />
              </label>
              <label className="profile-field">
                <span className="field-title">Role</span>
                <input value={roleText(me.role)} disabled />
              </label>
              <label className="profile-field">
                <span className="field-title">Class Assignment</span>
                <input value={classLabel(me.classId)} disabled />
              </label>
            </div>

            {isEditing && imageError ? <p className="error-text">{imageError}</p> : null}
            {isEditing && (
              <div className="profile-action-row">
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ name: me.name, bio: me.bio ?? "" });
                    setNewImage(undefined);
                    setImageError(null);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setNewImage(null)}
                  disabled={update.isPending}
                >
                  Remove Image
                </button>
                <button type="submit" disabled={update.isPending || Boolean(imageError)}>
                  {update.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </form>
        </article>
      </div>

      <article className="panel profile-directory">
        <div className="profile-section-head">
          <h2 className="chat-title-with-icon">
            <span className="chat-mini-icon">
              <Icon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0" />
            </span>
            Visible Profiles
          </h2>
          <p>People currently available in your scope.</p>
        </div>

        <div className="stack-list">
          {pagedProfiles.pageItems.map((candidate) => (
            <article key={candidate._id} className="item-card profile-person-card">
              <div className="row-between">
                <div className="profile-person-main">
                  <span className="profile-person-avatar">{initials(candidate.name)}</span>
                  <div>
                    <strong>{candidate.name}</strong>
                    <p className="muted-line">{roleText(candidate.role)}</p>
                  </div>
                </div>
                <span className="badge subtle">{classLabel(candidate.classId)}</span>
              </div>
              <p>{candidate.bio ?? "No bio yet."}</p>
            </article>
          ))}
        </div>
        <PaginationControls
          currentPage={pagedProfiles.currentPage}
          totalPages={pagedProfiles.totalPages}
          totalItems={pagedProfiles.totalItems}
          onPageChange={pagedProfiles.setCurrentPage}
        />
      </article>
    </div>
  );
}

function attachmentHint(image: FileAsset | null | undefined) {
  if (image === null) {
    return "Image will be removed after save";
  }
  if (image) {
    return image.name;
  }
  return "Upload jpg, png, or webp (max 2MB)";
}
