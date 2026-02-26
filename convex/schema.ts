import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
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
    subjectIds: v.optional(v.array(v.id("subjects"))),
  }).index("by_email", ["email"]),
  class: defineTable({
    name: v.string(),
    mainTeacherId: v.id("users"),
  }),
  subjects: defineTable({
    name: v.string(),
    classId: v.id("class"),
    teacherId: v.id("users"),
  })
    .index("by_class", ["classId"])
    .index("by_teacher", ["teacherId"]),
  semesters: defineTable({
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  }),
  assignments: defineTable({
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
    .index("by_subject", ["subjectId"])
    .index("by_semester", ["semesterId"]),
  submissions: defineTable({
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
    .index("by_assignment", ["assignmentId"])
    .index("by_student", ["studentId"]),
  attendance: defineTable({
    subjectId: v.id("subjects"),
    semesterId: v.id("semesters"),
    studentId: v.id("users"),
    date: v.string(),
    status: v.union(v.literal("Present"), v.literal("Absent"), v.literal("Excused")),
  })
    .index("by_subject", ["subjectId"])
    .index("by_student", ["studentId"]),
  announcements: defineTable({
    title: v.string(),
    content: v.string(),
    createdBy: v.id("users"),
    attachment: v.optional(v.id("_storage")),
    scheduledAt: v.optional(v.string()),
    createdAt: v.string(),
    classId: v.id("class"),
  }).index("by_class", ["classId"]),
});
