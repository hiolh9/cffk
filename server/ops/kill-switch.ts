import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { siteSetting } from "@/database/drizzle/schema";

export type OpsKillSwitches = {
  checkoutEnabled: boolean;
  autoFulfillEnabled: boolean;
};

const DEFAULTS: OpsKillSwitches = {
  checkoutEnabled: true,
  autoFulfillEnabled: true,
};

/**
 * Operational kill switches stored on siteSetting.
 * Defaults to ON (true) when columns are missing / not yet migrated.
 */
export async function getOpsKillSwitches(database: D1Database): Promise<OpsKillSwitches> {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({
        checkoutEnabled: siteSetting.checkoutEnabled,
        autoFulfillEnabled: siteSetting.autoFulfillEnabled,
      })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    if (!row) return { ...DEFAULTS };
    return {
      checkoutEnabled: row.checkoutEnabled !== false,
      autoFulfillEnabled: row.autoFulfillEnabled !== false,
    };
  } catch {
    // Column missing before migration: fail open for availability.
    return { ...DEFAULTS };
  }
}
