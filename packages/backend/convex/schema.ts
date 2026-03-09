import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalId: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("main_teacher"),
      v.literal("specialized_teacher"),
      v.literal("administrative_student"),
      v.literal("regular_student"),
    ),
    approved: v.boolean(),
    classId: v.id("class"),
    externalClassId: v.optional(v.string()),
    bio: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
    profileImageUrl: v.optional(v.string()),
    subjectIds: v.optional(v.array(v.id("subjects"))), // A teacher should only have one subject
    externalSubjectId: v.optional(v.string()),
    externalTaughtClassIds: v.optional(v.array(v.string())),
    password: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_external_id", ["externalId"]),
  class: defineTable({
    externalId: v.optional(v.string()),
    name: v.string(),
    mainTeacherId: v.optional(v.id("users")),
  }).index("by_external_id", ["externalId"]),
  subjects: defineTable({
    externalId: v.optional(v.string()),
    name: v.string(),
    classId: v.id("class"),
    externalClassId: v.optional(v.string()),
    teacherId: v.id("users"), // A subject can have many teachers
  })
    .index("by_external_id", ["externalId"])
    .index("by_class", ["classId"])
    .index("by_teacher", ["teacherId"]),
  subjectTeachers: defineTable({
    externalId: v.optional(v.string()),
    externalClassId: v.optional(v.string()),
    externalSubjectId: v.optional(v.string()),
    externalTeacherId: v.optional(v.string()),
    classId: v.id("class"),
    subjectId: v.id("subjects"),
    teacherId: v.id("users"),
  })
    .index("by_external_id", ["externalId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_teacher", ["teacherId"])
    .index("by_subject_teacher", ["subjectId", "teacherId"]),
  semesters: defineTable({
    externalId: v.optional(v.string()),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  }).index("by_external_id", ["externalId"]),
  assignments: defineTable({
    externalId: v.optional(v.string()),
    externalSubjectId: v.optional(v.string()),
    externalClassId: v.optional(v.string()),
    externalSemesterId: v.optional(v.string()),
    externalCreatedBy: v.optional(v.string()),
    assignmentType: v.optional(v.union(v.literal("file"), v.literal("text"), v.literal("quiz"))),
    subjectId: v.id("subjects"),
    semesterId: v.id("semesters"),
    title: v.string(),
    description: v.string(),
    deadline: v.string(),
    allowLate: v.boolean(),
    allowResubmit: v.boolean(),
    totalScore: v.number(),
    createdBy: v.id("users"),
    attachmentStorageIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_external_id", ["externalId"])
    .index("by_external_class", ["externalClassId"])
    .index("by_external_subject", ["externalSubjectId"])
    .index("by_subject", ["subjectId"])
    .index("by_semester", ["semesterId"]),
  submissions: defineTable({
    externalId: v.optional(v.string()),
    externalAssignmentId: v.optional(v.string()),
    externalStudentId: v.optional(v.string()),
    submissionType: v.optional(v.union(v.literal("file"), v.literal("text"), v.literal("quiz"))),
    payload: v.optional(v.string()),
    assignmentId: v.id("assignments"),
    studentId: v.id("users"),
    score: v.optional(v.number()),
    comment: v.optional(v.string()),
    submittedAt: v.string(),
    late: v.boolean(),
    payloadText: v.optional(v.string()),
    payloadFileId: v.optional(v.id("_storage")),
    quizAnswers: v.optional(v.array(v.string())),
  })
    .index("by_external_id", ["externalId"])
    .index("by_external_assignment", ["externalAssignmentId"])
    .index("by_external_student", ["externalStudentId"])
    .index("by_assignment", ["assignmentId"])
    .index("by_student", ["studentId"]),
  attendance: defineTable({
    externalId: v.optional(v.string()),
    externalSubjectId: v.optional(v.string()),
    externalClassId: v.optional(v.string()),
    externalSemesterId: v.optional(v.string()),
    externalStudentId: v.optional(v.string()),
    subjectId: v.id("subjects"),
    semesterId: v.id("semesters"),
    studentId: v.id("users"),
    date: v.string(),
    status: v.union(v.literal("Present"), v.literal("Absent"), v.literal("Excused")),
  })
    .index("by_external_id", ["externalId"])
    .index("by_external_class", ["externalClassId"])
    .index("by_external_student", ["externalStudentId"])
    .index("by_subject", ["subjectId"])
    .index("by_student", ["studentId"]),
  announcements: defineTable({
    externalId: v.optional(v.string()),
    externalCreatedBy: v.optional(v.string()),
    externalClassId: v.optional(v.string()),
    externalAttachment: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    createdBy: v.id("users"),
    attachment: v.optional(v.id("_storage")),
    scheduledAt: v.optional(v.string()),
    createdAt: v.string(),
    classId: v.id("class"),
  })
    .index("by_external_id", ["externalId"])
    .index("by_external_class", ["externalClassId"])
    .index("by_class", ["classId"]),
  chats: defineTable({
    externalId: v.optional(v.string()),
    externalClassId: v.optional(v.string()),
    externalSubjectId: v.optional(v.string()),
    externalParticipantIds: v.optional(v.array(v.string())),
    type: v.union(v.literal("class"), v.literal("subject"), v.literal("direct")),
    classId: v.id("class"),
    subjectId: v.optional(v.id("subjects")),
    participantIds: v.optional(v.array(v.id("users"))),
    lastMessageAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_class", ["classId"])
    .index("by_type", ["type"]),
  messages: defineTable({
    externalId: v.optional(v.string()),
    externalChatId: v.optional(v.string()),
    externalSenderId: v.optional(v.string()),
    externalAttachment: v.optional(v.string()),
    chatId: v.id("chats"),
    senderId: v.id("users"),
    content: v.string(),
    attachmentId: v.optional(v.id("_storage")),
    createdAt: v.string(),
    editedAt: v.optional(v.string()),
    deleted: v.boolean(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_external_chat", ["externalChatId"])
    .index("by_chat", ["chatId"]),
});
