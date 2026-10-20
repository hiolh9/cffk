import { errorMessagesPart1 } from "./error-messages-part1";
import { errorMessagesPart2 } from "./error-messages-part2";

export const errorMessages: Record<string, string> = {
  ...errorMessagesPart1,
  ...errorMessagesPart2,
};

export function messageForErrorCode(code: string, fallback = "操作失败，请稍后重试。") {
  if (!code || code === "INTERNAL_ERROR") return fallback;
  return errorMessages[code] ?? fallback;
}
