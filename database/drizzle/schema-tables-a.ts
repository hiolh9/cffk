import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = integer("createdAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const updatedAt = integer("updatedAt", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

// NOTE: This is a partial file - NEED FULL CONTENT
