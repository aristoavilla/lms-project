import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as lms from "../services/lmsService";
import type { Announcement, AttendanceStatus, SubmissionType, User } from "../types";

export function useSubjects(user: User) {
  return useQuery({
    queryKey: ["subjects", user.classId],
    queryFn: () => lms.listSubjectsByClass(user.classId),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => lms.getAllUsers(),
  });
}

export function useAssignments(user: User) {
  return useQuery({
    queryKey: ["assignments", user._id],
    queryFn: () => lms.listAssignmentsForUser(user),
  });
}

export function useAnnouncements(user: User) {
  return useQuery({
    queryKey: ["announcements", user.classId],
    queryFn: () => lms.listAnnouncementsForClass(user.classId),
  });
}

export function useAttendance(user: User) {
  return useQuery({
    queryKey: ["attendance", user._id],
    queryFn: () => lms.listAttendance(user),
  });
}

export function useRanking(user: User, subjectId?: string) {
  return useQuery({
    queryKey: ["ranking", user._id, subjectId ?? "overall"],
    queryFn: () =>
      subjectId ? lms.getSubjectRanking(user, subjectId) : lms.getOverallRanking(user),
    enabled: subjectId ? true : user.role === "main_teacher" || user.role === "super_admin",
  });
}

export function useSubmitAssignment(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      assignmentId: string;
      payload: string;
      submissionType: SubmissionType;
    }) => lms.submitAssignment(user, variables.assignmentId, variables.payload, variables.submissionType),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assignments", user._id] });
    },
  });
}

export function useCreateAssignment(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      title: string;
      description: string;
      subjectId: string;
      deadline: string;
      totalScore: number;
    }) => lms.createAssignment(user, variables),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assignments", user._id] });
    },
  });
}

export function useCreateAnnouncement(user: User) {
  const queryClient = useQueryClient();
  return useMutation<
    Announcement,
    Error,
    Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">,
    { previous?: Array<{ _id: string; title: string; content: string }> }
  >({
    mutationFn: lms.createAnnouncement.bind(null, user),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["announcements", user.classId] });
      const previous = queryClient.getQueryData(["announcements", user.classId]) as
        | Array<{ _id: string; title: string; content: string }>
        | undefined;
      queryClient.setQueryData(["announcements", user.classId], (old: unknown) => {
        const current = Array.isArray(old) ? old : [];
        return [
          {
            _id: `optimistic-${Date.now()}`,
            title: variables.title,
            content: variables.content,
            createdBy: user._id,
            createdAt: new Date().toISOString(),
            classId: user.classId,
          },
          ...current,
        ];
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["announcements", user.classId], context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements", user.classId] });
    },
  });
}

export function useMarkAttendance(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      subjectId: string;
      studentId: string;
      date: string;
      status: AttendanceStatus;
    }) => lms.markAttendance(user, variables),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance", user._id] });
    },
  });
}

export function useAdminActions(user: User) {
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: (userId: string) => lms.approveUser(user, userId),
    onSettled: async () => queryClient.invalidateQueries(),
  });
  const assignRole = useMutation({
    mutationFn: (variables: { userId: string; role: User["role"] }) =>
      lms.assignRole(user, variables.userId, variables.role),
    onSettled: async () => queryClient.invalidateQueries(),
  });
  const assignSubject = useMutation({
    mutationFn: (variables: { subjectId: string; teacherId: string }) =>
      lms.assignSubjectTeacher(user, variables.subjectId, variables.teacherId),
    onSettled: async () => queryClient.invalidateQueries(),
  });
  return { approve, assignRole, assignSubject };
}
