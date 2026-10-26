/** Shared sensitive-data redaction for logs and error reports. */

const SENSITIVE_KEY =
  /(pass(word)?|secret|token|authorization|api[_-]?key|private|sign(ature)?|cvv|cvc|card[_-]?number|pan|otp|raw_body|cookie|session)/i;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const LONG_DIGIT_RE = /\b\d{12,19}\b/g;

export function redactString(value: string, maxLen = 256): string {
  let out = value
    .replace(EMAIL_RE, "[email]")
    .replace(LONG_DIGIT_RE, "[digits]");
  if (out.length > maxLen) out = `${out.slice(0, maxLen)}…[truncated:${value.length}]`;
  return out;
}

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[redacted]" : redactSensitive(item, depth + 1),
      ]),
    );
  }
  return String(value);
}
