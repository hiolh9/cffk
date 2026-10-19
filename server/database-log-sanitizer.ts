const sensitiveKey = /^(sign|password|token|api[-_]?key|secret|secret[-_]?key|partner[-_]?id|partner[-_]?key|private[-_]?key|access[-_]?key|refresh[-_]?token|id[-_]?token|credentials|credentials[-_]?json|authorization|auth)$/i;
const sensitiveAssignment = /(["']?(?:sign|password|token|api[-_]?key|secret|secret[-_]?key|partner[-_]?id|partner[-_]?key|private[-_]?key|access[-_]?key|refresh[-_]?token|id[-_]?token|credentialsJson|authorization)["']?\s*[:=]\s*)(["']?)[^\s,;}&"']+\2/gi;

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKey.test(key))
        .map(([key, item]) => [key, sanitizeValue(item, seen)]),
    );
  }
  return value;
}

/** Removes only credentials/signatures before a value enters a database log. */
export function sanitizeDatabaseLogValue(value: unknown) {
  return sanitizeValue(value);
}

export function sanitizeDatabaseLogText(value: string) {
  return value.replace(sensitiveAssignment, "$1[REDACTED]");
}

export function sanitizeDatabaseLogJson(value: unknown) {
  return JSON.stringify(sanitizeDatabaseLogValue(value));
}
