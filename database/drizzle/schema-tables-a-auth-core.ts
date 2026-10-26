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

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt,
    updatedAt,
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const twoFactor = sqliteTable("twoFactor", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique().references(() => user.id),
  secret: text("secret").notNull(),
  backupCodes: text("backupCodes").notNull(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  failedVerificationCount: integer("failedVerificationCount").notNull().default(0),
  lockedUntil: integer("lockedUntil", { mode: "timestamp_ms" }),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
});

export const adminBootstrap = sqliteTable("adminBootstrap", {
  id: integer("id").primaryKey().default(1),
  userId: text("userId").notNull().references(() => user.id),
  createdAt,
});
