/** Product-level custom buyer fields shown at checkout. */

export type BuyerFormFieldType = "text" | "email" | "textarea" | "number" | "password";

export type BuyerFormField = {
  /** Stable key for API / supplier mapping, e.g. game_uid */
  key: string;
  /** UI label, e.g. Game ID */
  label: string;
  type: BuyerFormFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  /** Pass through to supplier payload when true (default true) */
  passToSupplier?: boolean;
};

export type BuyerFormDefinition = {
  version: 1;
  fields: BuyerFormField[];
};

const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

function isSimpleEmail(value: string) {
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  return domain.includes(".") && !value.includes(" ") && value.length <= 254;
}

export function parseBuyerFormJson(raw: string | null | undefined): BuyerFormDefinition {
  if (!raw?.trim()) return { version: 1, fields: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<BuyerFormDefinition>;
    const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    return {
      version: 1,
      fields: fields
        .filter((f): f is BuyerFormField =>
          Boolean(f && typeof f === "object" && typeof (f as BuyerFormField).key === "string"),
        )
        .map((f) => ({
          key: String(f.key).trim(),
          label: String(f.label || f.key).trim(),
          type: (["text", "email", "textarea", "number", "password"] as const).includes(
            f.type as BuyerFormFieldType,
          )
            ? (f.type as BuyerFormFieldType)
            : "text",
          required: Boolean(f.required),
          placeholder: f.placeholder ? String(f.placeholder) : undefined,
          description: f.description ? String(f.description) : undefined,
          passToSupplier: f.passToSupplier !== false,
        }))
        .filter((f) => KEY_RE.test(f.key) && f.label),
    };
  } catch {
    return { version: 1, fields: [] };
  }
}

export function serializeBuyerForm(def: BuyerFormDefinition): string {
  return JSON.stringify({ version: 1, fields: def.fields.slice(0, 20) });
}

export type BuyerFormValues = Record<string, string>;

export function validateBuyerFormValues(
  def: BuyerFormDefinition,
  values: Record<string, unknown> | null | undefined,
):
  | { ok: true; values: BuyerFormValues }
  | { ok: false; fieldKey: string; reason: "required" | "invalid" } {
  const out: BuyerFormValues = {};
  const src = values && typeof values === "object" ? values : {};
  for (const field of def.fields) {
    const raw = src[field.key];
    const str = raw == null ? "" : String(raw).trim();
    if (!str) {
      if (field.required) return { ok: false, fieldKey: field.key, reason: "required" };
      continue;
    }
    if (field.type === "email" && !isSimpleEmail(str)) {
      return { ok: false, fieldKey: field.key, reason: "invalid" };
    }
    if (field.type === "number" && !Number.isFinite(Number(str))) {
      return { ok: false, fieldKey: field.key, reason: "invalid" };
    }
    if (str.length > 500) return { ok: false, fieldKey: field.key, reason: "invalid" };
    out[field.key] = str;
  }
  return { ok: true, values: out };
}

/** Subset for supplier API (only passToSupplier fields). */
export function buyerFormForSupplier(
  def: BuyerFormDefinition,
  values: BuyerFormValues,
): BuyerFormValues {
  const out: BuyerFormValues = {};
  for (const field of def.fields) {
    if (field.passToSupplier === false) continue;
    if (values[field.key] != null && values[field.key] !== "") out[field.key] = values[field.key];
  }
  return out;
}
