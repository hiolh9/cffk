import { createDrizzleDb } from "@/database/drizzle";
import { auditLog } from "@/database/drizzle/schema-accounting";

export async function writeAuditLog(
  database: D1Database,
  input: {
    actorUserId?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    note?: string;
  },
) {
  const db = createDrizzleDb(database);
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
    afterJson: input.after === undefined ? null : JSON.stringify(input.after),
    note: input.note ?? null,
    createdAt: new Date(),
  });
}
