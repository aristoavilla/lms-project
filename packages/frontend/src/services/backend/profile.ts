import type { User } from "../../types";
import { mapUser, patchJson, saveSessionUser, uploadProfileImage, type ApiUser } from "./core";

export async function updateOwnProfile(
  user: User,
  patch: { name: string; bio: string; profileImage?: File | null },
) {
  const profileImageUrl =
    patch.profileImage === undefined
      ? undefined
      : patch.profileImage === null
        ? null
        : await uploadProfileImage(patch.profileImage, user._id);

  const payload = await patchJson<{ profile: ApiUser }>("/lms/users/me/profile", {
    name: patch.name,
    bio: patch.bio,
    profileImageUrl,
  });
  const updatedUser = mapUser(payload.profile);
  saveSessionUser(updatedUser);
  return updatedUser;
}