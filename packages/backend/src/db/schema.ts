import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  approved: boolean("approved").notNull().default(false),
  classId: text("class_id").notNull(),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  subjectId: text("subject_id"),
  taughtClassIds: jsonb("taught_class_ids").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mainTeacherExternalId: text("main_teacher_external_id"),
});

export const semesters = pgTable("semesters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  classId: text("class_id").notNull(),
  teacherExternalId: text("teacher_external_id").notNull(),
});

export const subjectTeachers = pgTable("subject_teachers", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  teacherExternalId: text("teacher_external_id").notNull(),
});

export const assignments = pgTable("assignments", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  classId: text("class_id").notNull(),
  semesterId: text("semester_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  deadline: text("deadline").notNull(),
  allowLate: boolean("allow_late").notNull().default(false),
  allowResubmit: boolean("allow_resubmit").notNull().default(false),
  totalScore: integer("total_score").notNull(),
  createdByExternalId: text("created_by_external_id").notNull(),
  assignmentType: text("assignment_type").notNull(),
  attachmentIds: jsonb("attachment_ids").$type<string[]>(),
});

export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull(),
  studentExternalId: text("student_external_id").notNull(),
  submissionType: text("submission_type").notNull(),
  payload: text("payload").notNull(),
  score: integer("score"),
  comment: text("comment"),
  submittedAt: text("submitted_at").notNull(),
  late: boolean("late").notNull().default(false),
});

export const attendance = pgTable("attendance", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  classId: text("class_id").notNull(),
  semesterId: text("semester_id").notNull(),
  studentExternalId: text("student_external_id").notNull(),
  date: text("date").notNull(),
  status: text("status").notNull(),
});

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdByExternalId: text("created_by_external_id").notNull(),
  attachment: text("attachment"),
  scheduledAt: text("scheduled_at"),
  createdAt: text("created_at").notNull(),
  classId: text("class_id").notNull(),
});

export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id"),
  participantExternalIds: jsonb("participant_external_ids").$type<string[]>(),
  lastMessageAt: text("last_message_at"),
  createdAt: text("created_at").notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  senderExternalId: text("sender_external_id").notNull(),
  content: text("content").notNull(),
  attachment: text("attachment"),
  createdAt: text("created_at").notNull(),
  editedAt: text("edited_at"),
  deleted: boolean("deleted").notNull().default(false),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  recipientExternalId: text("recipient_external_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  resourceId: text("resource_id"),
  resourceType: text("resource_type"),
  actorName: text("actor_name"),
  read: boolean("read").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export type DbUser = typeof users.$inferSelect;
