import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const createdAt = integer("createdAt", { mode: "timestamp_ms" }).notNull();
export const updatedAt = integer("updatedAt", { mode: "timestamp_ms" }).notNull();

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    emailChangeRequestedAt: integer("emailChangeRequestedAt", { mode: "timestamp_ms" }),
    emailChangePendingEmail: text("emailChangePendingEmail"),
    emailChangeLastSentAt: integer("emailChangeLastSentAt", { mode: "timestamp_ms" }),
    disabledAt: integer("disabledAt", { mode: "timestamp_ms" }),
    image: text("image"),
    twoFactorEnabled: integer("twoFactorEnabled", { mode: "boolean" }).notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("user_email_lower_unique").on(sql`lower(${table.email})`)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt,
    updatedAt,
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);
