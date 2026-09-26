import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  date,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
  customType,
} from "drizzle-orm/pg-core";

/* ---------------------------------- users --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    rollNumber: varchar("roll_number", { length: 40 }).notNull(),
    branch: varchar("branch", { length: 48 }).notNull(),
    semester: integer("semester").notNull().default(1),
    admissionYear: integer("admission_year").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 16 }).notNull().default("user"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    rollIdx: index("users_roll_idx").on(t.rollNumber),
  }),
);

/* -------------------------------- subjects -------------------------------- */

export const subjects = pgTable(
  "subjects",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 24 }),
  },
  (t) => ({ nameIdx: uniqueIndex("subjects_name_idx").on(t.name) }),
);

export const userSubjects = pgTable(
  "user_subjects",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.subjectId] }) }),
);

export const tags = pgTable(
  "tags",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 48 }).notNull(),
  },
  (t) => ({ nameIdx: uniqueIndex("tags_name_idx").on(t.name) }),
);

/* --------------------------------- posts ---------------------------------- */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull().default("resource"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    branch: varchar("branch", { length: 48 }),
    semester: integer("semester"),
    subject: varchar("subject", { length: 120 }),
    unit: varchar("unit", { length: 40 }),
    resourceType: varchar("resource_type", { length: 40 }),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    fileName: varchar("file_name", { length: 220 }),
    filePath: text("file_path"),
    fileSize: integer("file_size"),
    filePages: integer("file_pages"),
    mimeType: varchar("mime_type", { length: 120 }),
    thumbUrl: text("thumb_url"),
    views: integer("views").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),
    fulfilledBy: uuid("fulfilled_by").references(() => users.id, { onDelete: "set null" }),
    fulfilledPostId: uuid("fulfilled_post_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    authorIdx: index("posts_author_idx").on(t.authorId),
    kindIdx: index("posts_kind_idx").on(t.kind),
    createdIdx: index("posts_created_idx").on(t.createdAt),
    branchIdx: index("posts_branch_idx").on(t.branch, t.semester),
    subjectIdx: index("posts_subject_idx").on(t.subject),
  }),
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.postId, t.tagId] }) }),
);

export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.postId] }),
    postIdx: index("likes_post_idx").on(t.postId),
  }),
);

export const saves = pgTable(
  "saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.postId] }),
    postIdx: index("saves_post_idx").on(t.postId),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    postIdx: index("comments_post_idx").on(t.postId),
    parentIdx: index("comments_parent_idx").on(t.parentId),
  }),
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followerId, t.followingId] }),
    idx: index("follows_following_idx").on(t.followingId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 32 }).notNull(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 280 }).notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId, t.read),
    createdIdx: index("notifications_created_idx").on(t.createdAt),
  }),
);

export const reports = pgTable(
  "reports",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: varchar("target_type", { length: 24 }).notNull(),
    targetId: varchar("target_id", { length: 64 }).notNull(),
    label: varchar("label", { length: 200 }),
    reason: varchar("reason", { length: 400 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    resolverId: uuid("resolver_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("reports_status_idx").on(t.status),
    targetIdx: index("reports_target_idx").on(t.targetType, t.targetId),
  }),
);

export const streaks = pgTable("streaks", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  current: integer("current").notNull().default(0),
  highest: integer("highest").notNull().default(0),
  lastPostDate: date("last_post_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fileStorage = pgTable("file_storage", {
  id: varchar("id", { length: 255 }).primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  fileSize: integer("file_size").notNull(),
  data: customType<{ data: Buffer }>({
    dataType() {
      return "bytea";
    },
  })("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type FileStorageRow = typeof fileStorage.$inferSelect;
