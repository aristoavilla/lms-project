import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as lms from "../services/lmsService";
import type {
  Announcement,
  AttendanceStatus,
  Chat,
  ChatThread,
  FileAsset,
  Message,
  SubmissionType,
  User,
} from "../types";

export function useSubjects(user: User) {
  const classId = user.role === "super_admin" ? "" : user.classId;
  return useQuery({
    queryKey: ["subjects", classId],
    queryFn: () => lms.listSubjectsByClass(classId),
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
    queryKey: ["announcements", user.role, user.classId],
    queryFn: () => lms.listAnnouncementsForUser(user),
  });
}

export function useAttendance(user: User) {
  return useQuery({
    queryKey: ["attendance", user._id],
    queryFn: () => lms.listAttendance(user),
  });
}

export function useRanking(user: User, subjectId?: string, classId?: string) {
  return useQuery({
    queryKey: ["ranking", user._id, subjectId ?? "overall", classId ?? user.classId],
    queryFn: () =>
      subjectId
        ? lms.getSubjectRanking(user, subjectId, classId ?? user.classId)
        : lms.getOverallRanking(user, classId ?? user.classId),
    enabled: subjectId ? true : user.role === "main_teacher" || user.role === "super_admin",
  });
}

export function useBatchClassOverallRanking(user: User, classIds: string[]) {
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: ["ranking", "class-overall", user._id, classId],
      queryFn: () => lms.getOverallRanking(user, classId),
      enabled: user.role === "super_admin",
    })),
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
      await queryClient.invalidateQueries({ queryKey: ["assignment-submissions-many"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["submissions"] });
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
      classId: string;
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
  const announcementsKey = ["announcements", user.role, user.classId] as const;
  return useMutation<
    Announcement,
    Error,
    Pick<Announcement, "title" | "content" | "attachment" | "scheduledAt">,
    { previous?: Array<{ _id: string; title: string; content: string }> }
  >({
    mutationFn: lms.createAnnouncement.bind(null, user),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: announcementsKey });
      const previous = queryClient.getQueryData(announcementsKey) as
        | Array<{ _id: string; title: string; content: string }>
        | undefined;
      queryClient.setQueryData(announcementsKey, (old: unknown) => {
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
        queryClient.setQueryData(announcementsKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: announcementsKey });
    },
  });
}

export function useMarkAttendance(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      subjectId: string;
      classId: string;
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

export function useVisibleProfiles(user: User) {
  return useQuery({
    queryKey: ["profiles", user._id, user.role, user.classId],
    queryFn: () => lms.listVisibleProfiles(user),
  });
}

export function useUpdateProfile(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      name: string;
      bio: string;
      profileImage?: File | null;
    }) => lms.updateOwnProfile(user, variables),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user._id] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", user._id] });
    },
  });
}

export function useChatThreads(user: User, options?: { enabled?: boolean }) {
  return useQuery<ChatThread[]>({
    queryKey: ["chat-threads", user._id],
    queryFn: () => lms.listChatThreadsForUser(user),
    enabled: options?.enabled ?? true,
    refetchInterval: 2500,
  });
}

export function useChatMessages(user: User, chatId: string | null, options?: { enabled?: boolean }) {
  return useQuery<Message[]>({
    queryKey: ["chat-messages", user._id, chatId ?? "none"],
    queryFn: () => {
      if (!chatId) {
        return Promise.resolve([]);
      }
      return lms.listMessagesForChat(user, chatId);
    },
    enabled: Boolean(chatId) && (options?.enabled ?? true),
    refetchInterval: 1800,
  });
}

export function useMarkChatAsRead(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => lms.markChatAsRead(user, chatId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user._id] });
    },
  });
}

interface SendMessageInput {
  chatId?: string;
  type: Chat["type"];
  classId: string;
  subjectId?: string;
  recipientUserId?: string;
  content: string;
  attachment?: FileAsset;
}

export function useSendMessage(user: User) {
  const queryClient = useQueryClient();
  return useMutation<
    Message,
    Error,
    SendMessageInput,
    { previous?: Message[]; targetKey: readonly ["chat-messages", string, string] }
  >({
    mutationFn: (variables: SendMessageInput) => lms.sendMessage(user, variables),
    onMutate: async (variables) => {
      const targetKey = ["chat-messages", user._id, variables.chatId ?? "none"] as const;
      await queryClient.cancelQueries({ queryKey: targetKey });
      const previous = queryClient.getQueryData<Message[]>(targetKey);

      if (variables.chatId) {
        const optimisticMessage: Message = {
          _id: `optimistic-${Date.now()}`,
          chatId: variables.chatId,
          senderId: user._id,
          content: variables.content.trim() || "Attachment",
          attachment: variables.attachment,
          createdAt: new Date().toISOString(),
          deleted: false,
        };
        queryClient.setQueryData<Message[]>(targetKey, (old) => [...(old ?? []), optimisticMessage]);
      }

      return { previous, targetKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous && context.targetKey) {
        queryClient.setQueryData(context.targetKey, context.previous);
      }
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user._id] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", user._id, created.chatId] });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user._id] });
    },
  });
}

export function useEditMessage(user: User, chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { messageId: string; content: string }) =>
      lms.editMessage(user, variables.messageId, variables.content),
    onSuccess: async () => {
      if (chatId) {
        await queryClient.invalidateQueries({ queryKey: ["chat-messages", user._id, chatId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user._id] });
    },
  });
}

export function useDeleteMessage(user: User, chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => lms.softDeleteMessage(user, messageId),
    onSuccess: async () => {
      if (chatId) {
        await queryClient.invalidateQueries({ queryKey: ["chat-messages", user._id, chatId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user._id] });
    },
  });
}

export function useDirectContacts(user: User, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["chat-direct-contacts", user._id],
    queryFn: () => lms.listDirectContacts(user),
    enabled: (options?.enabled ?? true) && user.role !== "super_admin",
  });
}
