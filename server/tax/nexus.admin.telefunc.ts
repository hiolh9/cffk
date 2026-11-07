// server/tax/nexus.admin.telefunc.ts
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { DEFAULT_NEXUS_RULES, evaluateTaxForNewOrder, sumRolling12mGrossMyr } from "./nexus-engine";
import { exportExemptOrdersCsv, exportMyLocalSalesCsv, rolling12mByRegion } from "./nexus-reports";

export const onGetTaxNexusDashboard = telefuncAction(async () => {
  const { database } = requireAdmin();
  const rows = await rolling12mByRegion(database);
  const rules = DEFAULT_NEXUS_RULES;
  return {
    rows: rows.map((r) => {
      const rule = rules[r.region];
      return {
        ...r,
        thresholdMyr: rule?.thresholdMyrApprox ?? null,
        taxType: rule?.taxType ?? (r.region === "UNKNOWN" ? null : "Export_Exempt"),
        progressPct:
          rule && rule.thresholdMyrApprox > 0
            ? Math.min(100, Math.round((r.grossMyrApprox / rule.thresholdMyrApprox) * 100))
            : null,
      };
    }),
  };
});

export const onExportMyLocalSalesCsv = telefuncAction(async (input: { yearMonth: string }) => {
  const { database } = requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(input?.yearMonth || "")) appError("DATE_INVALID");
  return { csv: await exportMyLocalSalesCsv(database, input.yearMonth) };
});

export const onExportExemptSalesCsv = telefuncAction(async (input: { yearMonth: string }) => {
  const { database } = requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(input?.yearMonth || "")) appError("DATE_INVALID");
  return { csv: await exportExemptOrdersCsv(database, input.yearMonth) };
});

export const onPreviewOrderTax = telefuncAction(async (input: {
  orderAmountMyr: number;
  ipCountry?: string;
  cardCountry?: string;
}) => {
  const { database } = requireAdmin();
  return evaluateTaxForNewOrder(database, input);
});
