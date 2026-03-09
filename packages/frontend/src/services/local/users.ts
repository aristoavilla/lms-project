import type { User } from "../../types";
import {
  assertApproved,
  delay,
  localStore,
  validateProfileImage,
} from "./core";

export async function approveUser(superAdmin: User, userId: string) {
  await delay();
  if (superAdmin.role !== "super_admin") {
    throw new Error("Only super admin can approve users.");
  }
  localStore.userState = localStore.userState.map((user) =>
    user._id === userId ? { ...user, approved: true } : user,
  );
}

export async function assignRole(superAdmin: User, userId: string, role: User["role"]) {
  await delay();
  if (superAdmin.role !== "super_admin") {
    throw new Error("Only super admin can assign roles.");
  }
  localStore.userState = localStore.userState.map((user) =>
    user._id === userId ? { ...user, role } : user,
  );
}

export async function assignSubjectTeacher(
  superAdmin: User,
  subjectId: string,
  teacherId: string,
) {
  await delay();
  if (superAdmin.role !== "super_admin") {
    throw new Error("Only super admin can assign subject owners.");
  }
  const teacher = localStore.userState.find((item) => item._id === teacherId);
  if (!teacher) {
    throw new Error("Teacher not found.");
  }
  localStore.userState = localStore.userState.map((candidate) =>
    candidate._id === teacherId ? { ...candidate, subjectId } : candidate,
  );
}

export async function listVisibleProfiles(user: User) {
  await delay();
  assertApproved(user);
  if (user.role === "super_admin") {
    return localStore.userState;
  }
  return localStore.userState.filter(
    (candidate) => candidate.classId === user.classId && candidate.approved,
  );
}

export async function updateOwnProfile(
  user: User,
  patch: { name: string; bio: string; profileImage?: File | null },
) {
  await delay(220);
  assertApproved(user);
  const nextName = patch.name.trim();
  if (!nextName) {
    throw new Error("Full name is required.");
  }
  validateProfileImage(patch.profileImage ?? undefined);
  localStore.userState = localStore.userState.map((candidate) => {
    if (candidate._id !== user._id) {
      return candidate;
    }
    const nextProfile =
      patch.profileImage === undefined
        ? {
            profileImageId: candidate.profileImageId,
            profileImageUrl: candidate.profileImageUrl,
          }
        : patch.profileImage === null
          ? {
              profileImageId: undefined,
              profileImageUrl: undefined,
            }
          : {
              profileImageId: `local-profile-${Date.now()}`,
              profileImageUrl: URL.createObjectURL(patch.profileImage),
            };
    return {
      ...candidate,
      name: nextName,
      bio: patch.bio.trim(),
      ...nextProfile,
    };
  });
  return localStore.userState.find((candidate) => candidate._id === user._id);
}
