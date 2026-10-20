import { errorCode } from "./app-error";
import { errorMessagesPart1 } from "./error-messages-part1";
import { errorMessagesPart2 } from "./error-messages-part2";

export const errorMessages: Record<string, string> = {
  ...errorMessagesPart1,
  ...errorMessagesPart2,
  REQUEST_FAILED: "操作暂时无法完成，请稍后再试。",
  INTERNAL_ERROR: "操作暂时无法完成，请稍后再试。",
};

export function messageForErrorCode(code: string, fallback = "操作失败，请稍后重试。") {
  if (!code || code === "INTERNAL_ERROR") return fallback;
  return errorMessages[code] ?? fallback;
}

export function userErrorMessage(cause: unknown, fallback = errorMessages.REQUEST_FAILED) {
  const code = errorCode(cause);
  if (code === "REQUEST_FAILED" || code === "INTERNAL_ERROR") return fallback;
  return errorMessages[code] ?? fallback;
}
